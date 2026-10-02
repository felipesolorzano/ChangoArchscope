import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Estado por (target, proyecto, task_key): ver migracion 006. Las tablas previas quedan sin uso.
export const planTaskStates = sqliteTable(
  "plan_task_states_by_project",
  {
    target: text("target").notNull(),
    project: text("project").notNull(),
    taskKey: text("task_key").notNull(),
    state: text("state").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.target, table.project, table.taskKey] })],
);
