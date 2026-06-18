import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createSqliteConnection } from "./createSqliteConnection.js";

export type RunSqliteMigrationsOptions = {
  databasePath: string;
  migrationsDirectory: string;
};

export type RunSqliteMigrationsResult = {
  appliedMigrations: string[];
};

type SchemaMigrationRow = {
  id: string;
};

export function sortSqlMigrationFileNames(fileNames: string[]): string[] {
  return fileNames.filter((fileName) => fileName.endsWith(".sql")).sort();
}

export function runSqliteMigrations(options: RunSqliteMigrationsOptions): RunSqliteMigrationsResult {
  mkdirSync(options.migrationsDirectory, { recursive: true });

  const database = createSqliteConnection({ databasePath: options.databasePath });

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        executed_at TEXT NOT NULL
      );
    `);

    const executedRows = database
      .prepare("SELECT id FROM schema_migrations")
      .all() as SchemaMigrationRow[];
    const executedMigrationIds = new Set(executedRows.map((row) => row.id));
    const migrationFiles = sortSqlMigrationFileNames(readdirSync(options.migrationsDirectory));
    const appliedMigrations: string[] = [];

    for (const migrationFile of migrationFiles) {
      if (executedMigrationIds.has(migrationFile)) {
        continue;
      }

      const migrationSql = readFileSync(join(options.migrationsDirectory, migrationFile), "utf8");

      database.exec("BEGIN");
      database.exec(migrationSql);
      database
        .prepare("INSERT INTO schema_migrations (id, executed_at) VALUES (?, ?)")
        .run(migrationFile, new Date().toISOString());
      database.exec("COMMIT");

      appliedMigrations.push(migrationFile);
    }

    return { appliedMigrations };
  } finally {
    database.close();
  }
}
