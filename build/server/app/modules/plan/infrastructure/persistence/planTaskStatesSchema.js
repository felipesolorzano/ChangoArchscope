import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Estado por (target, task_key): ver migracion 005. La tabla vieja `plan_task_states` queda sin uso.
export const planTaskStates = sqliteTable("plan_task_states_by_target", {
    target: text("target").notNull(),
    taskKey: text("task_key").notNull(),
    state: text("state").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.target, table.taskKey] })]);
