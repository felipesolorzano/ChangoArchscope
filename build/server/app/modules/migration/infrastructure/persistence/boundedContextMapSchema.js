import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const boundedContextMaps = sqliteTable("bounded_context_maps", {
    target: text("target").primaryKey(),
    document: text("document").notNull(),
    updatedAt: text("updated_at").notNull(),
});
