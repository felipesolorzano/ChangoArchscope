# Vulnerabilidades y fin de soporte (F4, backend)

## Objetivo

Agregar al reporte de dependencias (F2) las vulnerabilidades conocidas de cada paquete (OSV) y el
estado de soporte (endoflife.date) de los runtimes y de los frameworks reconocidos, para priorizar
que actualizar primero. Plan: `docs/dependencies-plan.md`.

## Value objects (`domain/value-objects/Security.ts`)

```ts
type Severity = "critical" | "high" | "moderate" | "low" | "unknown";
type AffectedRange = { introduced: string; fixed: string | null; lastAffected: string | null };
type Advisory = { id; aliases: string[]; summary: string; severity: Severity; ranges: AffectedRange[]; versions: string[] };
type SupportCycle = { cycle: string; latest: string | null; releaseDate: string | null; eol: string | boolean; support: string | boolean | null };
type Vulnerability = { id; cve: string | null; summary; severity: Severity; fixedIn: string | null };
type SecurityAssessment = { vulnerabilities: Vulnerability[]; maxSeverity: Severity | null; recommendedAffected: boolean };
type SupportStatus = { product: string; cycle: string; eol: string | boolean; isEol: boolean; latestInCycle: string | null };
```

## Reglas puras (`domain/services`)

- `isAffected(version, advisory)` (`advisoryMatching.ts`): version normalizada (`normalizeVersion`;
  invalida → `false`). Las versiones de la advisory ya vienen normalizadas (ver `osvDocument`).
  Afectada si esta en `versions` o dentro de algun rango: `>= introduced` y, si hay `fixed`,
  `< fixed`; si no, si hay `lastAffected`, `<= lastAffected`; sin ninguno, sin limite superior.
- `assessSecurity(current, recommended, advisories)`:
  - `vulnerabilities`: las advisories que afectan `current` (ninguna si `current` es `null`), con
    `cve` = primer alias que empieza con `CVE-` (o `null`), `fixedIn` = el menor `fixed` mayor que
    `current` entre sus rangos (o `null`). Orden: severidad (critical, high, moderate, low, unknown)
    y despues `id`.
  - `maxSeverity`: la mas alta de `vulnerabilities` o `null`.
  - `recommendedAffected`: `true` si `recommended` no es `null` y alguna advisory lo afecta.
- `supportStatus(product, version, cycles, today)` (`supportStatus.ts`): el ciclo cuyo `cycle` es igual
  a la version o es prefijo por segmentos (`"8.3"` para `8.3.6`, `"3"` para `3.7.1`, nunca `"8.3"`
  para `8.30.0`); si varios coinciden, el mas largo. Sin version o sin ciclo → `null`.
  `isEol`: `eol === true`, o `eol` es fecha y `eol <= today` comparando texto (`today` es un instante
  ISO o una fecha `YYYY-MM-DD`; las fechas de endoflife.date son `YYYY-MM-DD`). `latestInCycle` = `latest`.
- `supportProductFor(ecosystem, name)` / `runtimeProduct(kind)` (`supportProducts.ts`): producto de
  endoflife.date. Runtimes: `php` → `php`, `node` → `nodejs`, `npm` → ninguno. Paquetes npm: `react`,
  `vue`, `@angular/core` → `angular`, `jquery`, `jquery-ui`, `bootstrap`, `eslint`, `express`,
  `electron`, `next` → `nextjs`, `nuxt`. Composer: `laravel/framework` → `laravel`,
  `symfony/symfony` y `symfony/http-kernel` → `symfony`, `drupal/core` → `drupal`,
  `cakephp/cakephp` → `cakephp`. Cualquier otro → `null`.

## Puertos y cache generica (`application`)

- `AdvisoryDatabase.fetch(ecosystem, name): Promise<Advisory[]>` (lanza si falla).
- `SupportCalendar.fetch(product): Promise<SupportCycle[] | null>` (`null` = producto desconocido).
- `LookupCache<T>`: `get(key) → { value: T; fetchedAt } | null`, `set(key, value, fetchedAt)`.
- `resolveCachedLookups<T>({ keys, fetch, cache, now, ttlMs, refresh, concurrency })` →
  `Map<key, { value: T | null; fetchedAt; error; stale }>` con las mismas reglas que
  `resolvePackageInfos` (F2: cache fresca, refresh, stale ante falla, sin repetir llaves, limite de
  concurrencia). `resolvePackageInfos` pasa a usarla sin cambiar su contrato.

## Adaptadores (`infrastructure`)

- `FetchJson` acepta `(url, init?)` con `init = { method: "POST", body }` (JSON).
- `OsvAdvisoryDatabase`: `POST https://api.osv.dev/v1/query` con
  `{ package: { name, ecosystem: "npm" | "Packagist" } }` (+ `page_token` mientras la respuesta
  traiga `next_page_token`). Status fuera de 2xx → lanza. Mapeo (`osvDocument.ts`, puro): por cada
  vuln, solo los `affected` del mismo paquete y ecosistema (sin `package` o sin `affected` → se
  ignoran; si no queda ninguno, la vuln se descarta); `ranges` de tipo `SEMVER` o `ECOSYSTEM`,
  recorriendo `events` en orden: cada `introduced` abre un rango que cierra el siguiente `fixed` o
  `last_affected` (si no hay, queda abierto); todas las versiones de los rangos se normalizan
  (`"0"` → `"0.0.0"`) y un rango con alguna que no se puede leer se descarta; `versions` = union de
  `affected[].versions` normalizadas (las ilegibles se descartan); `severity` = `database_specific.severity` en minusculas (`medium` →
  `moderate`; ausente u otro → `unknown`); `aliases` (o `[]`); `summary` (o `details` recortado a
  200 caracteres, o `""`).
- `EndOfLifeCalendar`: `GET https://endoflife.date/api/<product>.json`; 404 → `null`; otro status
  fuera de 2xx → lanza; mapea cada ciclo a `SupportCycle` (`cycle` como string; `latest`,
  `releaseDate`, `support` → `null` si faltan).
- `SqliteLookupCache<T>(db, source)`: migracion `008_create_dependency_lookup_cache.sql`, tabla
  `dependency_lookup_cache(source, key, payload TEXT JSON, fetched_at, PK(source, key))`.
  Fuentes: `osv` (llave `ecosystem:name`) y `endoflife` (llave = producto).

## Reporte (`buildDependencyReport`, extendido)

Recibe ademas `advisories: Map<"ecosystem:name", Lookup<Advisory[]>>`,
`calendars: Map<product, Lookup<SupportCycle[] | null>>` y `today` (instante ISO de la consulta):

- Cada dependencia agrega `security` (`assessSecurity(current, recommended, advisories)`; sin lookup
  o con valor `null` → vacio), `advisoryError` (error de la consulta o `null`) y `support`
  (`supportStatus` con el producto del paquete y su `current`, o `null`).
- Cada runtime agrega `support` (de su version `selected`) y `cycles`: los ciclos del calendario de
  su producto como `{ cycle, latest, eol, isEol }` (vacio si no hay producto o calendario).
- `summary` agrega `vulnerable` (dependencias con al menos una vulnerabilidad),
  `bySeverity: Record<Severity, number>` (por `maxSeverity`, los 5 con 0) y `endOfLife`
  (dependencias con `support.isEol`).

## Endpoint

`/dependencies.json` consulta OSV para cada paquete y endoflife.date para los productos de los
runtimes y de los paquetes reconocidos, con la misma cache (24 h, `refresh=1`) y concurrencia.

## Criterios de aceptacion

- `isAffected`/`assessSecurity` con rangos `fixed`, `last_affected`, abiertos, `introduced` distinto
  de `"0"`, lista `versions`, orden por severidad y `recommendedAffected`.
- `supportStatus`: prefijo por segmentos, ciclo mas largo, `eol` booleano y fecha (vencida/vigente).
- `osvDocument`: filtra por paquete, arma rangos desde eventos, severidad y aliases; paginacion.
- `EndOfLifeCalendar`: 404 → null, error → lanza, mapeo con faltantes.
- Cache SQLite generica por fuente; `resolveCachedLookups` con las reglas de F2.
- Reporte: vulnerabilidades, soporte de paquetes y runtimes, `cycles` y resumen.
