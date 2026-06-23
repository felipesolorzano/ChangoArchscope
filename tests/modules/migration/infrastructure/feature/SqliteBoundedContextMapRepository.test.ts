import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BoundedContextMap } from "../../../../../app/modules/migration/domain/value-objects/BoundedContextMap.js";
import { SqliteBoundedContextMapRepository } from "../../../../../app/modules/migration/infrastructure/persistence/SqliteBoundedContextMapRepository.js";

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
  connection.exec("CREATE TABLE bounded_context_maps (target TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL);");
  repository = new SqliteBoundedContextMapRepository(drizzle(connection));
});

afterEach(() => connection.close());

describe("SqliteBoundedContextMapRepository", () => {
  it("sin mapa guardado devuelve null", () => {
    expect(repository.getMap("laravel")).toBeNull();
  });

  it("guarda y recupera el mapa por target", () => {
    repository.saveMap("laravel", sampleMap());

    expect(repository.getMap("laravel")).toEqual(sampleMap());
  });

  it("saveMap sobre el mismo target reemplaza (upsert)", () => {
    repository.saveMap("laravel", sampleMap());
    repository.saveMap("laravel", { generatedAt: "t", modules: [] });

    expect(repository.getMap("laravel")?.modules).toEqual([]);
  });
});
