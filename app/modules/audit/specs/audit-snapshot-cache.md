# Audit Snapshot Cache

## Objetivo

Eliminar el recomputo del `AuditSnapshot` completo en cada request HTTP. Hoy `resolveAuditSnapshot` (`presentation/http/auditRequest.ts`) corre `checkArchitecture` + parseo php-parser de todos los `.php`/`.inc` + los 6 analizadores nativos en cada carga (~7s en un repo de ~1000 archivos), aunque el resultado sea identico entre cambios de codigo. Esta spec agrega un cache en memoria invalidado por un *fingerprint* barato del repo: primera carga ~7s, siguientes instantaneas, y se auto-invalida cuando el codigo cambia. El scan de compatibilidad (Docker) ya tiene su propio cache; esta capa lo envuelve, asi que un hit evita tambien los 46s de Docker.

Alcance: cache en proceso (se pierde al reiniciar el server). La persistencia en SQLite es una capa L2 posterior, fuera de esta spec.

## Fingerprint del repo

Senal barata que cambia si y solo si el contenido escaneado pudo cambiar. Se calcula sobre los mismos archivos que escanea el audit (mismo `phpRoot`, `phpExtensions`, `ignoredPaths`), pero **sin leer ni parsear**: solo `stat` por archivo.

- Para cada archivo: `(rutaRelativa, mtimeMs, size)`.
- `fingerprintFromStats(entries)` (puro): ordena por ruta y produce un hash estable (`sha1`) de la lista. Independiente del orden de entrada.
- mtime+size es el mismo criterio que usan `make`/`rsync`. Un cambio de contenido casi siempre mueve el mtime; el caso raro de "cambiar contenido preservando mtime" (`touch -r`) es un riesgo aceptado. Lo inverso (mtime cambia sin cambiar contenido, p. ej. un `checkout`) solo causa un recomputo de mas: seguro, nunca sirve datos viejos.
- No depende de git (el `modulesPath` puede apuntar a cualquier carpeta, ver `config-absolute-paths`).

La parte de `stat`/walk es I/O (vive en infraestructura, `computeRepoFingerprint`); el hash (`fingerprintFromStats`) es puro y testeable.

## Cache (puro)

`createAuditSnapshotCache(): AuditSnapshotCache` en `application/use-cases/`. Sin I/O; memoiza por clave:

```ts
type AuditSnapshotCache = {
  resolve(key: string, fingerprint: string, compute: () => Promise<AuditSnapshot>): Promise<AuditSnapshot>;
};
```

- `key`: identidad logica de la consulta, `"<target>|<module>|<phpVersion>"`. Distinto target/module/version => entrada distinta.
- Hit: existe una entrada para `key` y su `fingerprint` coincide con el recibido => devuelve el `Promise` guardado **sin** llamar a `compute`.
- Miss (no existe o fingerprint distinto): llama a `compute()`, guarda `{ fingerprint, pending }` y lo devuelve.
- **Anti-stampede**: se guarda el `Promise` en vuelo, no el valor resuelto. Dos requests concurrentes con el mismo `key`+`fingerprint` comparten un solo computo.
- **No cachea rechazos**: si `compute()` falla, la entrada se elimina (si sigue siendo la misma) para que el proximo request reintente. Un fallo de Docker/parseo no deja el cache envenenado.

## Integracion en `resolveAuditSnapshot`

`AuditControllerDeps` gana dos campos opcionales:

- `snapshotCache?: AuditSnapshotCache`
- `fingerprint?: (repoPath: string, extensions: string[], ignoredPaths: string[]) => Promise<string>`

`resolveAuditSnapshot` queda:

- Arma `compute = async () => { check + compat + auditProject }` (lo caro de hoy, sin cambios).
- Si `snapshotCache` y `fingerprint` estan inyectados y `phpRoot !== null`: calcula `fp = await fingerprint(phpRoot, exts, ignoredPaths)` y devuelve `snapshotCache.resolve(key, fp, compute)`.
- Si no (deps no inyectadas, o `phpRoot === null` para target `react` donde no hay parseo PHP caro): devuelve `compute()` directo, comportamiento actual intacto.

Ambos campos son opcionales: los tests existentes de los controllers y el modulo `plan` (que no los inyecta) siguen funcionando sin cambios, recomputando como hoy.

## Composition root (`presentation/routes/api.ts`)

Instancia un unico `createAuditSnapshotCache()` y un `computeRepoFingerprint` (infra) por proceso, y los inyecta en `deps`. El cache de compat existente se mantiene; las dos capas componen (un hit de snapshot evita correr ambos).

## Casos invalidos o de borde

- `phpRoot === null` (target react): no se cachea por fingerprint (no hay raiz PHP que `stat`ear); se computa directo. Es barato igual (sin parseo PHP).
- Fingerprint cambia entre requests (alguien edito un archivo): miss => recomputo, se actualiza la entrada.
- `compute()` rechaza: la entrada se evita/elimina; el siguiente request recomputa.
- Repo vacio (cero archivos): `fingerprintFromStats([])` devuelve un hash estable de lista vacia; valido.
- Dos requests concurrentes mismo key+fingerprint: una sola ejecucion de `compute`.

## Criterios de Aceptacion

- Dos `resolve` con el mismo `key` y `fingerprint` ejecutan `compute` **una sola vez**; el segundo devuelve el snapshot cacheado.
- Dos `resolve` con el mismo `key` y `fingerprint` **distinto** ejecutan `compute` dos veces.
- Requests concurrentes con mismo `key`+`fingerprint` comparten un unico `Promise` (compute una vez).
- Si `compute` rechaza, el siguiente `resolve` con mismo key/fingerprint vuelve a llamar a `compute`.
- `fingerprintFromStats` da el mismo hash para la misma lista en cualquier orden, y un hash distinto si cambia ruta, mtime o size de algun archivo.
- Con las deps inyectadas, dos requests seguidos sin tocar el repo: el segundo NO recomputa (medible: `compute`/`auditProject` llamado una vez).

## Notas de implementacion

- `createAuditSnapshotCache` (puro) en `application/use-cases/AuditSnapshotCache.ts`. `fingerprintFromStats` (puro) en `infrastructure/cache/fingerprintFromStats.ts`; ambos al 100% de mutation score.
- `computeRepoFingerprint` (I/O: walk + `statSync`) en `infrastructure/cache/computeRepoFingerprint.ts`; se excluye de Stryker igual que `DockerPhpcsScanner`/`createDrizzleDatabase`. Reusa el walk filtrado del `SourceTreeReader` para `stat`ear exactamente los archivos escaneados.
- L2 SQLite (sobrevive reinicios) y compartir el cache con el modulo `plan` quedan como mejoras posteriores documentadas, no en esta spec.
