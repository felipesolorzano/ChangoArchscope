import { readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqlitePlanTaskStateRepository } from "../../../../../app/modules/plan/infrastructure/persistence/SqlitePlanTaskStateRepository.js";

const MIGRATIONS = join(process.cwd(), "database/migrations");
const migration = (name: string) => readFileSync(join(MIGRATIONS, name), "utf8");

let connection: Database.Database;
let repository: SqlitePlanTaskStateRepository;

beforeEach(() => {
  connection = new Database(":memory:");
  connection.exec(migration("002_create_plan_task_states.sql"));
  connection.exec(migration("005_plan_task_states_by_target.sql"));
  repository = new SqlitePlanTaskStateRepository(drizzle(connection));
});

afterEach(() => {
  connection.close();
});

describe("SqlitePlanTaskStateRepository", () => {
  it("getStates devuelve un objeto vacio cuando no hay estados guardados", () => {
    expect(repository.getStates("laravel")).toEqual({});
  });

  it("setState guarda y getStates lo devuelve indexado por task_key", () => {
    repository.setState("laravel", "close-sql-injections", "in_progress");
    repository.setState("laravel", "extract-data-layer", "blocked");

    expect(repository.getStates("laravel")).toEqual({
      "close-sql-injections": "in_progress",
      "extract-data-layer": "blocked",
    });
  });

  it("setState sobre una task existente actualiza su estado (upsert, no duplica)", () => {
    repository.setState("laravel", "close-sql-injections", "pending");
    repository.setState("laravel", "close-sql-injections", "done");

    expect(repository.getStates("laravel")).toEqual({ "close-sql-injections": "done" });
  });

  it("la misma task en dos targets no se pisa", () => {
    repository.setState("laravel", "validate-risk-reduction", "done");
    repository.setState("react", "validate-risk-reduction", "in_progress");
    repository.setState("react", "validate-risk-reduction", "blocked");

    expect(repository.getStates("laravel")).toEqual({ "validate-risk-reduction": "done" });
    expect(repository.getStates("react")).toEqual({ "validate-risk-reduction": "blocked" });
  });
});

describe("migracion 005_plan_task_states_by_target", () => {
  it("copia los estados existentes como laravel", () => {
    const legacy = new Database(":memory:");
    legacy.exec(migration("002_create_plan_task_states.sql"));
    legacy
      .prepare("INSERT INTO plan_task_states (task_key, state, updated_at) VALUES (?, ?, ?)")
      .run("close-sql-injections", "done", "2026-06-01T00:00:00.000Z");

    legacy.exec(migration("005_plan_task_states_by_target.sql"));

    const repo = new SqlitePlanTaskStateRepository(drizzle(legacy));
    expect(repo.getStates("laravel")).toEqual({ "close-sql-injections": "done" });
    expect(repo.getStates("react")).toEqual({});
    legacy.close();
  });
});
