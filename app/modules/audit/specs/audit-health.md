# Mapa de salud (Audit)

## Objetivo

Que la auditoria muestre SIEMPRE el proyecto entero: lo sano en verde y lo problematico por
severidad. Hasta ahora el snapshot y el grafo solo conocian archivos CON hallazgos, asi que un proyecto
limpio se veia vacio. El backend expone tambien los archivos escaneados sin hallazgos.

## Snapshot: `scannedFiles`

- `AuditSnapshot.scannedFiles: string[]`: rutas absolutas de los archivos que analizaron los
  analizadores nativos (PHP parseados + JS/TS parseados, sin los de `testRoots`), ordenadas. `[]` si no
  hubo analisis nativo (p. ej. react sin parser JS).
- `buildAuditSnapshot` lo recibe en el contexto (`scannedFiles`, default `[]`).

## Grafo (`buildAuditGraph`)

- Todo nodo `root`, `app` y `file` lleva `health: { files, withFindings }`: archivos escaneados que
  representa y cuantos tienen hallazgos (un nodo `rule` no lo lleva).
  - root: todos los `scannedFiles` y las entradas de `byFile`.
  - app: los de esa app (primer segmento de la ruta relativa a `sourceRoot`).
  - file: `{ files: 1, withFindings: 1 }` si tiene hallazgos, si no `{ 1, 0 }`.
  - `files` cuenta la union de `scannedFiles` y `byFile` (un archivo con hallazgos de arquitectura que no
    paso por el parser tambien cuenta).
- Vista `overview` con `sourceRoot`: ademas de las apps de `byModule`, una app por cada carpeta de
  `scannedFiles` sin hallazgos (`metrics` 0, `tone: "none"`, `drill: true`), despues de las de
  `byModule` y en orden alfabetico.
- Vista `app`: los archivos con hallazgos (como antes) y, si quedan lugares hasta `APP_FILE_LIMIT`, los
  archivos sanos de la app en orden alfabetico (tamaño minimo, `tone: "none"`).
- Vista `file` de un archivo sano: solo el nodo del archivo (sin reglas), con `health { 1, 0 }`.

## Salud (`buildAuditHealth(snapshot, sourceRoot, target)`, puro)

```ts
{
  summary: { files, healthy, withFindings, healthyPercent },   // healthyPercent entero (0-100)
  checks: [{ category, label, findings }],                      // categorias auditadas para el stack
  groups: [{ key, label, files, withFindings, tiles: [{ path, label, findings, risk, tone, accent }] }]
}
```

- Universo de archivos = union de `scannedFiles` y `byFile` (sin repetir).
- `summary.healthyPercent` = `round(healthy / files * 100)`; 100 si no hay archivos.
- `checks`: una entrada por categoria del stack, en este orden, con su cantidad de hallazgos
  (`summary.by_category`, 0 si no hay):
  - comunes: `security` Seguridad, `architecture_violation` Arquitectura, `coupling_module`
    Acoplamiento entre módulos, `complexity` Complejidad, `coupling_low_level` Acoplamiento de bajo
    nivel, `dead_code` Código muerto, `testing` Tests;
  - `laravel` agrega `database` Base de datos y `php_compatibility` Compatibilidad PHP;
  - `react` agrega `api_access` API / HTTP.
- `groups`: un grupo por primer segmento de la ruta relativa a `sourceRoot` (los archivos sueltos en la
  raiz van al grupo `""`, label "(raíz)"), ordenados por `key`. Cada grupo con su cantidad de archivos,
  cuantos tienen hallazgos, y un tile por archivo ordenado por ruta: `path` relativa (posix), `label`
  basename, `findings`/`risk` de su `byFile` (0 si sano), `tone` = `toneForSeverity` y `accent` =
  `dominantAccent` de su entrada (`none`/`mixed` si sano).

## Endpoint

- `GET /audit-health.json?target=&module=&php=` → `buildAuditHealth` sobre el snapshot cacheado (mismo
  `resolveAuditSnapshot` que `/audit-graph.json`), con `sourceRoot` = raiz del stack.
- Proxy de Vite para desarrollo.

## Criterios de aceptacion

- Un snapshot con archivos escaneados sin hallazgos produce apps y archivos `tone: "none"` con `health`.
- `buildAuditHealth` cuenta sanos/con hallazgos, arma los checks del stack y agrupa los tiles.
- Un proyecto sin hallazgos devuelve 100% sano, checks en 0 y todos sus archivos como tiles.
