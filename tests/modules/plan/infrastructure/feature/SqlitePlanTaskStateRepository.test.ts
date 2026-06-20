import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqlitePlanTaskStateRepository } from "../../../../../app/modules/plan/infrastructure/persistence/SqlitePlanTaskStateRepository.js";

let connection: Database.Database;
let repository: SqlitePlanTaskStateRepository;

beforeEach(() => {
  connection = new Database(":memory:");
  connection.exec(`
    CREATE TABLE plan_task_states (
      task_key TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
  `);
  repository = new SqlitePlanTaskStateRepository(drizzle(connection));
});

afterEach(() => {
  connection.close();
});

describe("SqlitePlanTaskStateRepository", () => {
  it("getStates devuelve un objeto vacio cuando no hay estados guardados", () => {
    expect(repository.getStates()).toEqual({});
  });

  it("setState guarda y getStates lo devuelve indexado por task_key", () => {
    repository.setState("close-sql-injections", "in_progress");
    repository.setState("extract-data-layer", "blocked");

    expect(repository.getStates()).toEqual({
      "close-sql-injections": "in_progress",
      "extract-data-layer": "blocked",
    });
  });

  it("setState sobre una task existente actualiza su estado (upsert, no duplica)", () => {
    repository.setState("close-sql-injections", "pending");
    repository.setState("close-sql-injections", "done");

    expect(repository.getStates()).toEqual({ "close-sql-injections": "done" });
  });
});
