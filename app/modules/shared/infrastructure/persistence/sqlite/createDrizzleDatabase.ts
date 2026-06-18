import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export function createDrizzleDatabase(database: BetterSqliteDatabase) {
  return drizzle(database);
}
