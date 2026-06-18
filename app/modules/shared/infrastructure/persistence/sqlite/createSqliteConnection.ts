import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type SqliteConnectionOptions = {
  databasePath: string;
};

export function createSqliteConnection(options: SqliteConnectionOptions): Database.Database {
  mkdirSync(dirname(options.databasePath), { recursive: true });

  return new Database(options.databasePath);
}
