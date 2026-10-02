import { readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BoundedContextMap } from "../../../../../app/modules/migration/domain/value-objects/BoundedContextMap.js";
import { SqliteBoundedContextMapRepository } from "../../../../../app/modules/migration/infrastructure/persistence/SqliteBoundedContextMapRepository.js";

const migration = (name: string) => readFileSync(join(process.cwd(), "database/migrations", name), "utf8");

let connection: Database.Database;
let repository: SqliteBoundedContextMapRepository;

function sampleMap(): BoundedContextMap {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    modules: [{ key: "tours", name: "Tours", validated: false, layers: { domain: [{ path: "Tours/Domain/Tour.php" }], application: [], infrastructure: [], presentation: [] } }],
  };
}

beforeEach(() => {
  connection = new Database(":memory:");
  connection.exec(migration("004_create_bounded_context_maps.sql"));
  connection.exec(migration("002_create_plan_task_states.sql"));
  connection.exec(migration("005_plan_task_states_by_target.sql"));
  connection.exec(migration("006_project_scoped_state.sql"));
  repository = new SqliteBoundedContextMapRepository(drizzle(connection));
});

afterEach(() => connection.close());

describe("SqliteBoundedContextMapRepository", () => {
  it("sin mapa guardado devuelve null", () => {
    expect(repository.getMap("laravel", "/php")).toBeNull();
  });

  it("guarda y recupera el mapa por target y proyecto", () => {
    repository.saveMap("laravel", "/php", sampleMap());

    expect(repository.getMap("laravel", "/php")).toEqual(sampleMap());
  });

  it("saveMap sobre el mismo target y proyecto reemplaza (upsert)", () => {
    repository.saveMap("laravel", "/php", sampleMap());
    repository.saveMap("laravel", "/php", { generatedAt: "t", modules: [] });

    expect(repository.getMap("laravel", "/php")?.modules).toEqual([]);
  });

  it("dos proyectos con el mismo target no se pisan, ni dos targets del mismo proyecto", () => {
    repository.saveMap("react", "/legacy", sampleMap());
    repository.saveMap("react", "/nuevo", { generatedAt: "n", modules: [] });
    repository.saveMap("react-design", "/legacy", { generatedAt: "d", modules: [] });

    expect(repository.getMap("react", "/legacy")).toEqual(sampleMap());
    expect(repository.getMap("react", "/nuevo")?.generatedAt).toBe("n");
    expect(repository.getMap("react-design", "/legacy")?.generatedAt).toBe("d");
    expect(repository.getMap("react-design", "/nuevo")).toBeNull();
  });
});

describe("migracion 006_project_scoped_state (mapas)", () => {
  it("conserva los mapas existentes con proyecto vacio", () => {
    const legacy = new Database(":memory:");
    legacy.exec(migration("004_create_bounded_context_maps.sql"));
    legacy.exec(migration("002_create_plan_task_states.sql"));
    legacy.exec(migration("005_plan_task_states_by_target.sql"));
    legacy
      .prepare("INSERT INTO bounded_context_maps (target, document, updated_at) VALUES (?, ?, ?)")
      .run("laravel", JSON.stringify(sampleMap()), "2026-06-01T00:00:00.000Z");

    legacy.exec(migration("006_project_scoped_state.sql"));

    const repo = new SqliteBoundedContextMapRepository(drizzle(legacy));
    expect(repo.getMap("laravel", "")).toEqual(sampleMap());
    expect(repo.getMap("laravel", "/php")).toBeNull();
    legacy.close();
  });
});
