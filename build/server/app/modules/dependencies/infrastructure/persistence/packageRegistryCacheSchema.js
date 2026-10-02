// Stryker disable all: schema declarativo de drizzle evaluado al importar (la llave primaria solo la usa
// drizzle-kit); lo valida SqlitePackageInfoCache.test contra la migracion 007 real.
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Ver migracion 007.
export const packageRegistryCache = sqliteTable("package_registry_cache", {
    ecosystem: text("ecosystem").notNull(),
    name: text("name").notNull(),
    info: text("info").notNull(),
    fetchedAt: text("fetched_at").notNull(),
}, (table) => [primaryKey({ columns: [table.ecosystem, table.name] })]);
