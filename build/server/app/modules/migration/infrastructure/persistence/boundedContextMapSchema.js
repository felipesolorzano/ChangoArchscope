import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Mapa por (target, proyecto): ver migracion 006. La tabla vieja `bounded_context_maps` queda sin uso.
export const boundedContextMaps = sqliteTable("bounded_context_maps_by_project", {
    target: text("target").notNull(),
    project: text("project").notNull(),
    document: text("document").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.target, table.project] })]);
