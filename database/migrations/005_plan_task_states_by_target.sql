-- Estado de las tareas del plan por stack: la misma tarea (p. ej. validate-risk-reduction) puede
-- estar hecha en Laravel y pendiente en React. Los estados previos quedan como target 'laravel'.
CREATE TABLE IF NOT EXISTS plan_task_states_by_target (
  target TEXT NOT NULL,
  task_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (target, task_key)
);

INSERT OR IGNORE INTO plan_task_states_by_target (target, task_key, state, updated_at)
  SELECT 'laravel', task_key, state, updated_at FROM plan_task_states;
