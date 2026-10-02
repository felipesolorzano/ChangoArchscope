import { readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqlitePackageInfoCache } from "../../../../../app/modules/dependencies/infrastructure/persistence/SqlitePackageInfoCache.js";
import type { PackageInfo } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";

let connection: Database.Database;
let cache: SqlitePackageInfoCache;

const info: PackageInfo = {
  ecosystem: "npm",
  name: "react",
  abandoned: null,
  releases: [{ version: "18.3.1", deprecated: null, requires: { node: ">=0.10.0" }, publishedAt: "2024-04-26T00:00:00.000Z" }],
};

beforeEach(() => {
  connection = new Database(":memory:");
  connection.exec(readFileSync(join(process.cwd(), "database/migrations/007_create_package_registry_cache.sql"), "utf8"));
  cache = new SqlitePackageInfoCache(drizzle(connection));
});

afterEach(() => {
  connection.close();
});

describe("SqlitePackageInfoCache", () => {
  it("sin fila devuelve null", () => {
    expect(cache.get("npm", "react")).toBeNull();
  });

  it("guarda y devuelve la info con su fecha; separa por ecosistema", () => {
    cache.set("npm", "react", info, "2026-10-02T00:00:00.000Z");

    expect(cache.get("npm", "react")).toEqual({ info, fetchedAt: "2026-10-02T00:00:00.000Z" });
    expect(cache.get("composer", "react")).toBeNull();
  });

  it("reemplaza la fila y guarda tambien info null (no existe)", () => {
    cache.set("npm", "react", info, "2026-10-01T00:00:00.000Z");
    cache.set("npm", "react", null, "2026-10-02T00:00:00.000Z");

    expect(cache.get("npm", "react")).toEqual({ info: null, fetchedAt: "2026-10-02T00:00:00.000Z" });
  });
});
