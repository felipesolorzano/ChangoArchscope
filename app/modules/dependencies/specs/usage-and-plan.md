# Uso en el codigo, grupos y señales para el Plan (F5)

## Objetivo

Saber cuanto se usa cada paquete (esfuerzo de actualizarlo, o si conviene quitarlo), que paquetes se
actualizan juntos, y entregarle al Plan el trabajo de actualizacion como tareas.
Plan: `docs/dependencies-plan.md`.

## Uso (`domain/services/packageUsage.ts`, puro)

- `referencedPackages(source)`: conjunto de paquetes citados en el texto: cada literal entre comillas
  simples, dobles o backticks sin espacios se reduce a su paquete (`"react-dom/client"` →
  `react-dom`, `"@a/b/c"` → `@a/b`, `"lodash"` → `lodash`). Se calcula una vez por archivo.
- `isReferenced(source, name)`: `referencedPackages(source)` contiene `name`. `"react"` no cuenta para
  `react-dom` y viceversa.
- `isTooling(name)`: paquetes que se usan sin importarse (configuracion, CLI, tipos): prefijos
  `@types/`, `@babel/`, `@typescript-eslint/`, `@testing-library/`, `@svgr/`, `@vitejs/`, `@vitest/`,
  `@jest/`, `eslint`, `babel-`, `jest`, `webpack`, `postcss`, `stylelint`, `prettier`, `ts-`;
  sufijos `-loader`, `-plugin`; exactos `typescript`, `vite`, `vitest`, `sass`, `node-sass`, `tsx`.
- `usageOf(name, dev, references, manifestConfig)` → `{ files, inManifest, unused }`, con
  `references` = un `referencedPackages` por archivo:
  - `files`: cuantos conjuntos lo contienen.
  - `inManifest`: `manifestConfig` (texto del manifiesto sin sus secciones de dependencias) contiene
    el nombre como palabra (scripts, `babel`, `jest`, `eslintConfig`...): no precedido por letra,
    digito, `@`, `/`, `.`, `_` o `-`, ni seguido por letra, digito, `.`, `_` o `-` (`react` no cuenta
    dentro de `react-scripts`; `react/jsx-runtime` si cuenta).
  - `unused`: `files === 0 && !inManifest && !dev && !isTooling(name)`. Los de desarrollo nunca se
    marcan: se usan por CLI, configuracion o carga indirecta (`stryker`, `gulp-load-plugins`...).

## Grupos (`domain/services/upgradeGroups.ts`, puro)

`upgradeGroup(ecosystem, name)`: clave del grupo de paquetes que conviene actualizar juntos, o `null`:

- npm: `react`, `react-dom`, `react-test-renderer`, `react-is`, `@types/react`, `@types/react-dom` →
  `react`; `eslint` y `eslint-*` y `@typescript-eslint/*` → `eslint`; `jest`, `jest-*`, `babel-jest`,
  `ts-jest`, `@jest/*` → `jest`; `vite`, `vitest`, `@vitejs/*`, `@vitest/*` → `vite`; `webpack`,
  `webpack-*` → `webpack`; `gulp`, `gulp-*` → `gulp`; cualquier otro con scope (`@x/y`) → `@x`.
- composer: `laravel/*` e `illuminate/*` → `laravel`; `symfony/*` → `symfony`; otro → el vendor
  (`vendor/pkg` → `vendor`).
- Sin regla → `null`.

## Medicion (`application/use-cases/measureUsage.ts`)

`measureUsage({ dependencies, reader })` → `Map<"ecosystem:name|manifest", Usage>`:

- Solo npm (Composer queda sin medir: `usage: null` en el reporte).
- Por cada `package.json` con dependencias: fuentes = `reader.walkFiles(<carpeta del manifiesto>,
  [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"], ["**/node_modules", "**/vendor", "**/.*",
  "**/build", "**/dist", "**/coverage"])`, leidas una vez; `manifestConfig` = el JSON del manifiesto
  sin `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`.
- Un manifiesto ilegible no aporta medicion (sus paquetes quedan `usage: null`).

## Reporte (extiende `buildDependencyReport`)

- Recibe `usage: Map<…, Usage>`; cada dependencia agrega `usage` (`{ files, inManifest, unused }` o
  `null`) y `group` (`upgradeGroup`).
- `summary.unused`: dependencias con `usage.unused`.

## Generacion del reporte (`application/use-cases/generateDependencyReport.ts`)

Extrae del controlador la orquestacion (detectar → registros + OSV + endoflife.date → uso → reporte)
para que el Plan la reuse:
`generateDependencyReport(deps, { target, requested, refresh, offline })`.

- `offline: true` (lo usa el Plan): no consulta la red; lo que no esta en cache queda sin valor
  (`error: "sin datos en cache"`), lo cacheado se usa aunque este vencido (`stale` si vencio).
  `resolveCachedLookups` acepta `offline` con esa regla.

## Señales para el Plan (`plan/application/services/dependencyReportToSignals.ts`)

Traduce el reporte a `PlanSignals.dependencies = { counts, items }` (ver
`app/modules/plan/specs/plan-tasks.md`, "Tareas de dependencias"):

| Tarea | Cuenta | Item (`file` = manifiesto, `line` 0) |
|---|---|---|
| `fix-vulnerable-packages` | dependencias con vulnerabilidades | rule `dependency-vulnerable`, severity = max (`moderate` → `medium`), message `"<name> <current> → <recommended o ->: <n> vulns (<CVE o id de la primera>)"` |
| `update-unsupported-runtime` | runtimes con `support.isEol` | file `""`, rule `runtime-eol`, severity `high`, message `"<Kind> <selected>: sin soporte desde <eol>"` (`eol` fecha) o `"<Kind> <selected>: sin soporte"`; Kind = PHP, Node, npm |
| `replace-abandoned-packages` | `abandoned` + `deprecated` | rule `dependency-<status>`, severity `high`, message `"<name> <current>: <replacement, o deprecation, o "abandonado">"` |
| `remove-unused-packages` | `usage.unused` | rule `dependency-unused`, severity `low`, message `"<name>: sin referencias en el codigo"` |
| `apply-safe-updates` | `patch` + `minor` | rule `dependency-<status>`, severity `low`, message `"<name> <current> → <recommended>"` |
| `upgrade-major-versions` | `major` | rule `dependency-major`, severity `medium`, message `"<name> <current> → <recommended>"` + `" (grupo <group>)"` si tiene |

## Criterios de aceptacion

- `isReferenced` con comillas, backticks, subrutas y sin falsos positivos por prefijo.
- `isTooling`/`usageOf` y `upgradeGroup` con los ejemplos.
- `measureUsage` lee cada fuente una vez, ignora carpetas de build y no mide Composer.
- Reporte con `usage`, `group` y `summary.unused`; `offline` no llama a la red.
- `dependencyReportToSignals` arma conteos e items de cada tarea.
