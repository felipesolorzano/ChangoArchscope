# Fuente del proyecto para el agente (`GET /bounded-context-source.json`)

## Objetivo

Decirle al agente externo DONDE esta el proyecto y QUE archivos estan en alcance para que arme
el mapa de bounded contexts, tanto para el target Laravel/PHP como para el target React.

## Entradas

- `target` (string del query, default `laravel`).
- Config por stack (la arma la composition root desde `chango-archscope.config.mjs`):
  - `laravel`: `{ root: modulesPath, extensions: phpExtensions, ignoredPaths }`.
  - `react`: `{ root: modulesPath, extensions: [".ts", ".tsx", ".js", ".jsx"], ignoredPaths }`.
- `listFiles(root, extensions, ignoredPaths)`: puerto que enumera archivos (en produccion,
  `SourceTreeReader.walkFiles`).

## Reglas

- El stack se deriva del target:
  - `react` y `react-design` → stack **react**.
  - Cualquier otro target (`laravel`, `design`, u otros historicos) → stack **laravel**.
- La respuesta usa la config del stack elegido y enumera sus archivos con `listFiles`.
- `target` se devuelve tal cual llego (no se reescribe al stack).

## Salida

```jsonc
{ "target": "react", "root": "/abs/src", "extensions": [".ts", ".tsx", ".js", ".jsx"],
  "ignoredPaths": ["**/__tests__/**"], "files": ["/abs/src/pages/a.js"] }
```

## Casos invalidos

- Sin errores propios: un target desconocido cae al stack laravel (comportamiento historico).

## Capas

- `migration/application/use-cases/resolveProjectSource.ts`: logica pura (recibe config por stack +
  `listFiles`).
- `migration/presentation/routes/api.ts`: composition root (config real + `NodeFsSourceTreeReader`).

## Criterios de aceptacion

- `react` devuelve root/extensiones/ignoredPaths de react y los archivos listados con ellos.
- `react-design` usa el mismo stack react, pero responde `target: "react-design"`.
- `laravel`, `design` y un target desconocido usan el stack laravel.
- `listFiles` se llama con exactamente `(root, extensions, ignoredPaths)` del stack elegido.
