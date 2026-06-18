import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
export function createSqliteConnection(options) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    return new Database(options.databasePath);
}
