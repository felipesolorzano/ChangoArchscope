import { resolve } from "node:path";

import { runSqliteMigrations } from "../../infrastructure/persistence/sqlite/runSqliteMigrations.js";

const databasePath = resolve(process.cwd(), "database/architecture-toolkit.sqlite");
const migrationsDirectory = resolve(process.cwd(), "database/migrations");

const result = runSqliteMigrations({
  databasePath,
  migrationsDirectory,
});

if (result.appliedMigrations.length === 0) {
  console.log("SQLite migrations: no pending migrations.");
} else {
  console.log(`SQLite migrations applied: ${result.appliedMigrations.join(", ")}`);
}
