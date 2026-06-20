CREATE TABLE IF NOT EXISTS plan_task_states (
  task_key TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT NOT NULL
);
