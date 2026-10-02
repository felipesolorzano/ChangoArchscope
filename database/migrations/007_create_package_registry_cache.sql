-- Ultima respuesta de npm / Packagist por paquete (modulo dependencies). Global, no por proyecto:
-- un paquete es el mismo en cualquier proyecto. info = JSON de PackageInfo o "null" (no existe).
CREATE TABLE IF NOT EXISTS package_registry_cache (
  ecosystem TEXT NOT NULL,
  name TEXT NOT NULL,
  info TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (ecosystem, name)
);
