# Incremental Native Scan (+ shared deps con Plan)

## Objetivo

En un cache-miss de snapshot (se edito un archivo), el audit nativo hoy re-lee y re-parsea con php-parser **todos** los archivos (~7s en ~1000), aunque solo cambio uno. Esta spec cachea el `PhpFileStructure` por archivo y solo re-parsea los que cambiaron (mtime/size), bajando el recompute nativo de ~7s a <1s. Combinado con el scan de compat incremental, un reload tras editar baja de ~9s a ~2-3s.

Ademas, el modulo `plan` recomputa el mismo snapshot (~7s) en cada carga porque no comparte los caches del audit. Se extrae una **fabrica singleton de deps** que ambos (audit y plan) usan, de modo que comparten el snapshot cache, el fingerprint y los scanners incrementales (nativo y compat). Como ambos consultan con `module=null` y sin `php`, comparten la misma entrada de cache `laravel||`.

## Scan nativo incremental

`IncrementalPhpFileScanner` (infra, stateful) reemplaza a `scanPhpFiles` en el camino del servidor. Mantiene `Map<rutaCompleta, { mtimeMs, size, result }>` donde `result` es el `PhpFileStructure` parseado o un `PhpParseFailure`.

`scan(phpRoot, extensions, ignoredPaths): PhpScanResult`:
1. Walk + `stat` de los archivos (mismo `walkFiles` filtrado que hoy) -> `FileStat[]`.
2. `diffFileStats(cacheStats, current)` (puro, ya existente) -> `{ changed, deleted }`.
3. Quitar `deleted` del cache.
4. Para cada `changed`: `reader.readText` + `parser.parse`; si lanza, se guarda como `PhpParseFailure`. Se actualiza el cache con el nuevo `{mtime, size, result}`.
5. Ensamblar el resultado recorriendo el cache **ordenado por ruta** (estable, igual que `walkFiles`): `files` = los `PhpFileStructure`, `skipped` = los `PhpParseFailure`.

Sigue siendo sincrono (php-parser, `statSync`, `readText` son sincronos), asi que `auditProject` no cambia su naturaleza. Los 6 analizadores corren sobre el `PhpFileStructure[]` ensamblado como hoy (son baratos; el costo era el parseo). Los analizadores globales (`dead_code`/`database`/`testing`) siguen viendo el conjunto completo.

Correctitud: un archivo con mismo (mtime, size) se asume sin cambios y se reusa su estructura. El caso raro de cambiar contenido preservando mtime/size (`touch -r`) es un riesgo aceptado, igual que el fingerprint. mtime cambiado sin cambio real solo causa un re-parse de mas (seguro).

## Inyeccion

- `AuditProjectInput` y `AuditControllerDeps` ganan `scanFiles?: (phpRoot, extensions, ignoredPaths) => PhpScanResult`.
- `auditProject`: usa `scanFiles` si esta inyectado; si no, cae a `scanPhpFiles(reader, parser, ...)` (comportamiento puro actual, intacto para tests y CLI).
- `resolveAuditSnapshot` pasa `deps.scanFiles` a `auditProject`.

## Fabrica singleton de deps

`getAuditDeps()` construye una sola vez (por proceso) el `AuditControllerDeps` completo: `getConfig`, `reader`, `parser`, `check`, `resolveCompatibility` (wrapper + `IncrementalDockerPhpcsScanner`), `snapshotCache`, `fingerprint`, `scanFiles` (del `IncrementalPhpFileScanner`). Memoizado a nivel modulo.

- `audit/presentation/routes/api.ts` lo usa para sus controllers.
- `plan/presentation/routes/api.ts` lo usa para su `AuditSnapshotProvider` (`getSnapshot(target) => resolveAuditSnapshot(deps, target, null)`), reemplazando las deps minimas que construia. Asi el plan hereda el cache y los scanners incrementales: si el audit ya cargo `laravel||`, el plan responde al instante, y viceversa.

El CLI (`bin/chango-archscope.mjs`) NO usa la fabrica: corre una sola vez, usa `scanPhpFiles` puro y `DockerPhpcsScanner` completo (sin estado que reusar).

## Casos de borde

- Cold: todos changed -> parsea todo (los ~7s iniciales una vez).
- Editar 1 archivo: 1 changed -> re-parsea 1 (<1s); el resto se reusa.
- Archivo con error de parseo: se cachea como `skipped`; si se corrige (cambia mtime), se re-evalua.
- Archivo borrado: sale del cache, sus findings desaparecen.
- Plan y audit concurrentes con misma clave: el `snapshotCache` comparte el Promise (anti-stampede), un solo computo.

## Criterios de Aceptacion

- `IncrementalPhpFileScanner.scan` devuelve el mismo `{files, skipped}` que `scanPhpFiles` para el mismo arbol (mismas estructuras, mismo orden por ruta).
- Tras un primer scan, editar 1 archivo re-parsea solo ese (verificable: el parser se invoca 1 vez en el segundo scan).
- Un archivo borrado entre scans desaparece de `files`/`skipped`.
- `auditProject` sin `scanFiles` se comporta exactamente como hoy (usa `scanPhpFiles`).
- Plan y audit comparten la entrada `laravel||` del snapshot cache (un solo computo para ambos).

## Notas de implementacion

- `IncrementalPhpFileScanner` en `infrastructure/`, I/O (read+stat), excluido de Stryker. La clasificacion changed/deleted reusa `diffFileStats` (puro, ya al 100% mutation).
- La fabrica singleton vive donde audit y plan puedan importarla sin romper limites (plan ya importa de `audit/presentation/http`).
- Pendiente futuro: cachear tambien salidas de analizadores por archivo (hoy se re-corren todos, pero son baratos); excluir `vendor` (`ignoredPaths`/`--ignore`); SQLite L2.
