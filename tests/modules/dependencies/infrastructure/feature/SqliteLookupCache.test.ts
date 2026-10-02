import { readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteLookupCache } from "../../../../../app/modules/dependencies/infrastructure/persistence/SqliteLookupCache.js";

let connection: Database.Database;

beforeEach(() => {
  connection = new Database(":memory:");
  connection.exec(readFileSync(join(process.cwd(), "database/migrations/008_create_dependency_lookup_cache.sql"), "utf8"));
});

afterEach(() => {
  connection.close();
});

describe("SqliteLookupCache", () => {
  it("guarda JSON por fuente y llave, reemplaza y separa fuentes", () => {
    const osv = new SqliteLookupCache<string[]>(drizzle(connection), "osv");
    const eol = new SqliteLookupCache<string[]>(drizzle(connection), "endoflife");

    expect(osv.get("npm:lodash")).toBeNull();

    osv.set("npm:lodash", ["GHSA-1"], "2026-10-01T00:00:00.000Z");
    osv.set("npm:lodash", ["GHSA-2"], "2026-10-02T00:00:00.000Z");
    eol.set("npm:lodash", ["otro"], "2026-10-02T00:00:00.000Z");

    expect(osv.get("npm:lodash")).toEqual({ value: ["GHSA-2"], fetchedAt: "2026-10-02T00:00:00.000Z" });
    expect(eol.get("npm:lodash")).toEqual({ value: ["otro"], fetchedAt: "2026-10-02T00:00:00.000Z" });
  });
});
