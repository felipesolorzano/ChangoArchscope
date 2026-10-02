-- Mapas de bounded contexts y estado del plan por PROYECTO (raiz del stack), no solo por target:
-- al cambiar modulesPath a otro proyecto no deben aparecer los datos del anterior. Las filas previas
-- quedan con project = '' (proyecto desconocido) y se pueden re-importar.
CREATE TABLE IF NOT EXISTS bounded_context_maps_by_project (
  target TEXT NOT NULL,
  project TEXT NOT NULL,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (target, project)
);

INSERT OR IGNORE INTO bounded_context_maps_by_project (target, project, document, updated_at)
  SELECT target, '', document, updated_at FROM bounded_context_maps;

CREATE TABLE IF NOT EXISTS plan_task_states_by_project (
  target TEXT NOT NULL,
  project TEXT NOT NULL,
  task_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (target, project, task_key)
);

INSERT OR IGNORE INTO plan_task_states_by_project (target, project, task_key, state, updated_at)
  SELECT target, '', task_key, state, updated_at FROM plan_task_states_by_target;
