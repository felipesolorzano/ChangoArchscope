-- Cache generica de consultas externas del modulo dependencies (OSV, endoflife.date). Global, no por
-- proyecto. source = origen ("osv", "endoflife"); payload = JSON de la respuesta ya mapeada.
CREATE TABLE IF NOT EXISTS dependency_lookup_cache (
  source TEXT NOT NULL,
  key TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (source, key)
);
