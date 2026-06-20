import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const planTaskStates = sqliteTable("plan_task_states", {
  taskKey: text("task_key").primaryKey(),
  state: text("state").notNull(),
  updatedAt: text("updated_at").notNull(),
});
