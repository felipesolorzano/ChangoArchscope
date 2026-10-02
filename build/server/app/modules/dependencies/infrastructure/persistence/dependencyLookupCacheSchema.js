// Stryker disable all: schema declarativo de drizzle evaluado al importar (la llave primaria solo la usa
// drizzle-kit); lo valida SqliteLookupCache.test contra la migracion 008 real.
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Ver migracion 008.
export const dependencyLookupCache = sqliteTable("dependency_lookup_cache", {
    source: text("source").notNull(),
    key: text("key").notNull(),
    payload: text("payload").notNull(),
    fetchedAt: text("fetched_at").notNull(),
}, (table) => [primaryKey({ columns: [table.source, table.key] })]);
