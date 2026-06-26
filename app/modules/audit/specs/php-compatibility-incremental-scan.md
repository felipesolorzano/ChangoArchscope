# PHP Compatibility Incremental Scan

## Objetivo

Hoy cada re-scan de compatibilidad corre phpcs sobre **todo** el repo (~55s en ~2000 archivos), aunque solo se haya editado un archivo. Esta spec agrega un scanner incremental: mantiene resultados por-archivo y, en cada scan, solo vuelve a correr phpcs sobre los archivos que cambiaron (mtime/size), reutilizando lo demas. Tras editar un archivo, el re-scan baja de ~55s a ~1-2s.

No cambia los hallazgos producidos (mismo phpcs, mismas reglas), solo evita recomputar lo que no cambio. Implementa el mismo puerto `PhpCompatibilityScanner` (`scan(repoPath, targetPhp, extensions)`), asi que es un swap de implementacion; el `DockerPhpcsScanner` de scan completo se queda para el CLI (corre una sola vez, no gana nada con incrementalidad).

## Estado por-archivo

El scanner guarda en memoria, por `targetPhp` (las reglas cambian entre versiones de PHP): `Map<rutaRelativa, { mtimeMs, size, issues: PhpCompatibilityIssue[] }>`. Vive en el proceso; se pierde al reiniciar (igual que los caches actuales).

## Flujo de `scan`

1. Docker disponible + imagen lista (igual que `DockerPhpcsScanner`); si no, `unavailable` (sin lanzar).
2. `stat` de los archivos escaneados (walk por `extensions`, sin leer contenido) -> `FileStat[]` `(rutaRelativa, mtimeMs, size)`. Mismo conjunto que escanea phpcs sobre `/repo`.
3. `diffFileStats(cacheStats, current)` (puro) -> `{ changed, deleted }`. `changed` = nuevos o con mtime/size distinto; `deleted` = estaban en cache y ya no existen.
4. Quitar `deleted` del cache.
5. Si hay `changed`:
   - **Cold** (cache vacio) o **muchos** cambios (> umbral, evita desbordar ARG_MAX): correr phpcs sobre el directorio `/repo` completo.
   - Si no: correr phpcs **solo** sobre los archivos cambiados (`/repo/<ruta>` como args).
   - Parsear el reporte con `parsePhpcsReportByFile` (puro): `Map<rutaRelativa, issues[]>` incluyendo archivos con `[]` (escaneados sin hallazgos).
   - Actualizar el cache: para cada archivo (re)escaneado, `cache[ruta] = { mtime, size, issues: porArchivo.get(ruta) ?? [] }`. El `?? []` registra que un archivo que antes tenia hallazgos y se corrigio ahora queda en cero.
6. `issues` = concatenacion de los `issues` de todas las entradas del cache, en orden estable por ruta.
7. `{ status: "ok", targetPhp, issues }`.

phpcs sale con codigo != 0 cuando hay hallazgos; eso es exito. Solo un fallo real (no se pudo correr / reporte ilegible) -> `unavailable`.

## Piezas puras (testeables, 100% mutation)

- `diffFileStats(cached, current)`: clasifica changed/deleted. En `infrastructure/compat/`.
- `parsePhpcsReportByFile(raw)`: agrupa el JSON de phpcs por archivo incluyendo los de cero hallazgos. `parsePhpcsReport` (lista plana, ya existente) se redefine como el aplanado de este, para tener una sola fuente de verdad de la normalizacion.

La orquestacion (walk+stat, `docker run` del subconjunto, manejo de tmp) es I/O: vive en `IncrementalDockerPhpcsScanner`, excluida de Stryker como los otros adapters.

## Composition root

`api.ts` usa `IncrementalDockerPhpcsScanner` (con el `reader`) dentro del wrapper de compat existente. El cache de snapshot (por fingerprint) sigue arriba: en un edit, el snapshot invalida, llama a compat, y el scanner incremental solo re-escanea el archivo tocado.

## Casos de borde

- Cold (primer scan): todos "changed" -> scan completo de `/repo` (los ~55s iniciales, inevitables una vez).
- Editar 1 archivo: 1 changed -> phpcs sobre 1 archivo (~1-2s).
- Archivo corregido a cero hallazgos: el reporte lo incluye con `messages: []` -> cache pasa a `[]` -> desaparece de la lista. (Este era el bug que el usuario veia: el archivo seguia mostrando hallazgos viejos.)
- Archivo borrado: sale del cache, sus hallazgos desaparecen.
- Cambiar `targetPhp`: mapa de cache distinto por version; la nueva version arranca cold.
- Muchos archivos cambiados de golpe (p. ej. `git checkout`): si superan el umbral, scan completo en vez de pasar miles de paths.

## Criterios de Aceptacion

- `diffFileStats`: un archivo con mtime o size distinto aparece en `changed`; uno nuevo aparece en `changed`; uno ausente del actual aparece en `deleted`; uno identico no aparece en ninguno.
- `parsePhpcsReportByFile`: agrupa por archivo (sin prefijo `/repo/`), incluye archivos con `messages: []` como `[]`, y descarta mensajes que no son de `PHPCompatibility`.
- Tras (re)escanear, un archivo que paso de N a 0 hallazgos ya no aporta issues al resultado.
- El resultado total es el mismo que un scan completo equivalente (mismos issues), solo que reusando los no cambiados.

## Notas de implementacion

- `IncrementalDockerPhpcsScanner` en `infrastructure/compat/`, implementa `PhpCompatibilityScanner`. Reusa `ensureImage`/`dockerAvailable` (puede compartir helper con `DockerPhpcsScanner` o duplicar lo minimo). Walk+stat reusa el patron de `computeRepoFingerprint`.
- Umbral de "scan completo" por cantidad de cambios: constante (p. ej. 200).
- Pendiente futuro (no en esta spec): el audit nativo tambien re-parsea todo en un miss (~7s); hacerlo incremental por-archivo seria el siguiente paso. Y aplicar `ignoredPaths`/`--ignore` para no escanear `vendor`.
