CREATE TABLE IF NOT EXISTS migration_class_overrides (
  class_id TEXT PRIMARY KEY,
  context_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_contexts (
  key TEXT PRIMARY KEY,
  name TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
