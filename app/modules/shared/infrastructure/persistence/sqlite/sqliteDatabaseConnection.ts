import type { Database as BetterSqliteDatabase } from "better-sqlite3";

let currentDatabase: BetterSqliteDatabase | undefined;

export function setSqliteDatabaseConnection(database: BetterSqliteDatabase): void {
  currentDatabase = database;
}

export function getSqliteDatabaseConnection(): BetterSqliteDatabase {
  if (currentDatabase === undefined) {
    throw new Error("SQLite database connection has not been registered.");
  }

  return currentDatabase;
}

export function clearSqliteDatabaseConnection(): void {
  currentDatabase = undefined;
}
