# Registros de paquetes, cache y reporte por runtime (F2)

## Objetivo

Consultar npm y Packagist para cada paquete detectado (F1), guardar lo consultado en SQLite para no
repetir la descarga y devolver el reporte clasificado segun el runtime elegido (PHP / Node / npm),
con el detectado como default. Plan general: `docs/dependencies-plan.md`.

## Puertos (`application/contracts`)

- `PackageRegistry.fetch(ecosystem, name): Promise<PackageInfo | null>`: `null` si el paquete no
  existe en el registro; lanza si la consulta falla (red, timeout, HTTP distinto de 2xx/404).
- `PackageInfoCache`: `get(ecosystem, name): { info: PackageInfo | null; fetchedAt: string } | null`
  y `set(ecosystem, name, info, fetchedAt)`. Guarda tambien `info: null` (no existe).

## Mapeo de documentos (`infrastructure/registry`, puro)

- `mapNpmDocument(name, json)` (documento completo de `registry.npmjs.org/<name>`):
  - Una release por entrada de `versions`: `version`; `deprecated` = el string si es string no
    vacio, si no `null`; `requires` = `engines.node` → `node` y `engines.npm` → `npm`, solo si son
    string (paquetes viejos traen arrays); `publishedAt` = `time[version]` o `null`.
  - `abandoned: null` (npm no lo tiene; usa `deprecated` por version).
- `expandMinified(entries)` (formato `composer/2.0` de Packagist): cada entrada hereda las claves de la
  anterior ya expandida; una clave con valor `"__unset"` se elimina.
- `mapPackagistDocument(name, json)` (`repo.packagist.org/p2/<name>.json`):
  - Entradas `packages[name]` expandidas; una release por entrada: `version`, `deprecated: null`,
    `requires.php` = `require.php` si existe, `publishedAt` = `time` o `null`.
  - `abandoned` = el de la primera entrada (la mas nueva): string (reemplazo) o `true`; si no,
    `null`. Sin `packages[name]` → `releases: []`.

## Adaptador HTTP (`infrastructure/registry/HttpPackageRegistry.ts`)

- Recibe `fetchJson(url) → Promise<{ status, body }>` (default: `fetch` global con timeout de 20 s,
  en `fetchJson.ts`, fuera de mutation por ser I/O de red).
- URLs: npm `https://registry.npmjs.org/<name>` con la `/` de un nombre con scope codificada
  (`@babel/core` → `@babel%2Fcore`); Packagist `https://repo.packagist.org/p2/<name en minusculas>.json`.
- `404` → `null`; otro status fuera de 2xx → lanza `Error("HTTP <status> en <url>")`; 2xx → mapea.

## Cache SQLite (`infrastructure/persistence/SqlitePackageInfoCache.ts`)

- Migracion `007_create_package_registry_cache.sql`: tabla `package_registry_cache(ecosystem, name,
  info TEXT (JSON), fetched_at TEXT, PRIMARY KEY (ecosystem, name))`.
- `set` inserta o reemplaza; `get` devuelve `null` si no hay fila.
- Es global (no por proyecto): un paquete es el mismo en cualquier proyecto.

## Resolucion (`application/use-cases/resolvePackageInfos.ts`)

`resolvePackageInfos({ dependencies, registry, cache, now, ttlMs, refresh, concurrency })` →
`Promise<Map<string, PackageLookup>>` con llave `"<ecosystem>:<name>"` y
`PackageLookup = { info, fetchedAt, error, stale }`:

- Una consulta por paquete distinto (aunque aparezca en varios manifiestos).
- Cache fresca (`now - fetchedAt < ttlMs`) y sin `refresh` → se usa sin consultar
  (`{ info, fetchedAt, error: null, stale: false }`).
- Si no: se consulta; exito → se guarda en cache con `fetchedAt = now` y se devuelve.
- Falla de la consulta: con cache (de cualquier edad) → `{ info: cache, fetchedAt: cache,
  error: mensaje, stale: true }`; sin cache → `{ info: null, fetchedAt: null, error: mensaje,
  stale: false }`. Una falla no detiene las demas.
- Nunca mas de `concurrency` consultas al mismo tiempo.
- TTL por defecto (lo fija el controlador): 24 h; `concurrency`: 8.

## Reporte (`application/use-cases/buildDependencyReport.ts`, puro)

`buildDependencyReport({ inventory, lookups, requested, generatedAt })` →

```ts
{
  generatedAt, root, manifests, skipped,
  runtimes: Array<DetectedRuntime & { selected: string | null }>,
  dependencies: Array<DependencyReport & { fetchedAt: string | null; lookupError: string | null; stale: boolean }>,
  summary: { total, byStatus: Record<DependencyStatus, number>, limitedByRuntime, lookupErrors },
}
```

- `requested`: versiones pedidas por query (`{ php?, node?, npm? }`, crudas). `selected` de cada runtime
  = `normalizeVersion(requested[kind])` si es valida; si no, la detectada (`version`). Un `kind` pedido
  que no esta en `runtimes` se ignora.
- Cada dependencia se clasifica con `classifyDependency(dep, lookup.info, seleccion)`, donde la
  seleccion tiene solo los `kind` con `selected` no nulo.
- `lookupError`: el error de la consulta; si no hubo error pero el registro no conoce el paquete
  (`info: null`), `"no encontrado en el registro"`; si no, `null`. Sin lookup para la llave: igual
  que no encontrado.
- `summary.byStatus` trae los 7 estados (0 si no hay); `limitedByRuntime` y `lookupErrors` cuentan
  dependencias. Orden de `dependencies`: el del inventario.

## Endpoint

`GET /dependencies.json?target=&php=&node=&npm=&refresh=1`:

- Detecta (F1, en cada llamada), resuelve contra registro + cache y devuelve el reporte.
- `php`, `node`, `npm` se toman solo si vienen una vez (string); repetidos (array) se ignoran.
- `refresh=1` ignora la cache fresca (vuelve a consultar todo); cualquier otro valor no.
- Errores inesperados → `next(error)`.

## Capas

- `application`: puertos, `resolvePackageInfos`, `buildDependencyReport`.
- `infrastructure`: `npmDocument`, `packagistDocument`, `HttpPackageRegistry`, `fetchJson`,
  `SqlitePackageInfoCache` + schema, migracion 007.
- `presentation`: `DependenciesController` (async) y rutas.

## Criterios de aceptacion

- `mapNpmDocument` con `deprecated`, `engines` string/array y `time`; nombre con scope en la URL.
- `expandMinified` hereda y respeta `__unset`; `mapPackagistDocument` toma `abandoned` de la mas nueva.
- `HttpPackageRegistry`: 404 → null, 500 → lanza, 200 → mapea, URLs correctas.
- Cache SQLite: guarda, reemplaza y devuelve `info: null`.
- `resolvePackageInfos`: cache fresca, vencida, `refresh`, falla con y sin cache, deduplicacion y
  limite de concurrencia.
- `buildDependencyReport`: runtime pedido vs detectado (y pedido invalido), resumen y `lookupError`.
- Controlador: pasa `php/node/npm` y `refresh` al caso de uso.
