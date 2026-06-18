import { drizzle } from "drizzle-orm/better-sqlite3";
export function createDrizzleDatabase(database) {
    return drizzle(database);
}
