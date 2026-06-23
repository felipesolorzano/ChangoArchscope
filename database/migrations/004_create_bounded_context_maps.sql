CREATE TABLE IF NOT EXISTS bounded_context_maps (
  target TEXT PRIMARY KEY,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
