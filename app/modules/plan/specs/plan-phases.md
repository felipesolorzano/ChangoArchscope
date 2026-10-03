# Fases con quality gates (XRay X6)

## Objetivo

Ordenar la modernizacion en fases 0–10 con metas medibles que se validan solas contra las metricas
actuales: nadie marca una fase como hecha, pasa cuando sus gates pasan. La fase actual es la primera
que no pasa. Complementa las tareas (`plan-tasks.md`): cada fase dice que tareas mueven sus gates.
Plan: `docs/xray-plan.md`.

## Señales nuevas (`PlanSignals`)

Las arma la capa de aplicacion (`auditSnapshotToSignals` + `buildPlan`); el dominio no conoce `audit`
ni `protection`:

- `topRiskUntested: number` — de los 10 archivos con mas riesgo (`riskBreakdown.byFile` por `value`
  descendente, empate por ruta) que estan en `scannedFiles` y no tienen `manual-copy-file` ni
  `possibly-unused-file`, cuantos no tienen tests (`snapshot.testedBy`, XRay X5).
- `healthyPercent: number` — `buildAuditHealth(snapshot, project, target).summary.healthyPercent`
  (el mismo porcentaje del panel de salud de Auditoria).
- `protectionLevel: "none" | "low" | "medium" | "high" | null` — nivel de `protection` (XRay X3);
  `null` si no se pudo calcular.

## Tareas nuevas (APIs legacy de XRay X5)

| key | categoria | reglas | dependsOn |
|---|---|---|---|
| `apply-legacy-codemods` | legacy_api | `unsafe-lifecycle`, `legacy-react-dom-api`, `string-ref`, `removed-php-function` | `add-characterization-tests`, `add-component-tests` |
| `migrate-deprecated-apis` | legacy_api | `with-router`, `deprecated-library`, `deprecated-php-function` | `apply-legacy-codemods`, `add-characterization-tests`, `add-component-tests` |

En el roadmap van despues de `replace-base-class-inheritance` y antes de `split-large-components`.
Titulos: "Aplicar codemods de APIs eliminadas" ("Correr los codemods de Codemods (React 19 / PHP 8)
sobre lo ya protegido: lifecycles, ReactDOM.render, string refs, funciones PHP eliminadas.") y
"Migrar APIs y librerias deprecadas" ("withRouter, moment/request/react-ga, utf8_encode: migracion
manual guiada por el panel Codemods.").

## Gates

`{ key, label, value, target, comparator, format, status }`:

- `comparator`: `"max"` (pasa si `value <= target`) o `"min"` (pasa si `value >= target`).
- `format`: `"count"`, `"percent"` o `"level"` (0 ninguna, 1 baja, 2 media, 3 alta).
- `status`: `"passed"`, `"failed"` o `"unknown"` (`value` nulo: no hay datos, p. ej. sin reporte de
  dependencias en cache o sin nivel de proteccion).
- Un gate de reglas suma los hallazgos de los selectores (`countSelected`) de las tareas que nombra.
- Un gate de dependencias toma `dependencies.counts[tarea]`; sin `dependencies` es `null`.

## Fases (`domain/services/planPhases.ts`, puro)

| # | key | titulo | meta | gates (`stack` si no aplica a los dos) | tareas |
|---|---|---|---|---|---|
| 0 | `baseline` | Linea base | Todo el codigo propio se analiza | `parse-errors` "Archivos que no parsean" = `skippedFiles` ≤ 0 | `exclude-third-party` |
| 1 | `security` | Seguridad | Sin inyecciones, sinks XSS, paquetes vulnerables ni runtime sin soporte | `injections` "Inyecciones (SQL, eval, Function)" reglas de `close-sql-injections` + `close-code-injection` ≤ 0; `xss-sinks` "Sinks XSS" reglas de `close-xss-sinks` ≤ 0 (react); `vulnerable-packages` "Paquetes vulnerables" ≤ 0; `unsupported-runtime` "Runtime sin soporte" ≤ 0 | `close-sql-injections`, `close-code-injection`, `close-xss-sinks`, `fix-vulnerable-packages`, `update-unsupported-runtime` |
| 2 | `cleanup` | Limpieza | Sin copias, archivos muertos ni migraciones a medias | `manual-copies` "Copias manuales" ≤ 0; `unused-files` "Archivos sin uso" ≤ 0; `duplicate-migrations` "Migraciones a medias (_new)" = `duplicatePairs` ≤ 0; `unused-exports` "Exports sin uso" ≤ 0 (react); `unused-packages` "Paquetes sin uso" ≤ 0 | `remove-manual-copies`, `remove-unused-files`, `resolve-duplicate-migrations`, `remove-unused-exports`, `remove-unused-packages` |
| 3 | `safety-net` | Red de seguridad | Lo mas riesgoso tiene tests antes de tocarlo | `protection-level` "Nivel de proteccion" ≥ 1 (level); `top-risk-untested` "Sin tests entre los 10 mas riesgosos" = `topRiskUntested` ≤ 0 | `add-characterization-tests`, `add-component-tests` |
| 4 | `architecture` | Arquitectura | Sin ciclos de imports | `import-cycles` "Ciclos de imports" ≤ 0 | `break-import-cycles` |
| 5 | `removed-apis` | APIs eliminadas | Nada que rompa al subir de version | `removed-apis` "Usos de APIs eliminadas" reglas de `apply-legacy-codemods` ≤ 0 | `apply-legacy-codemods` |
| 6 | `deprecated-apis` | APIs y librerias deprecadas | Sin APIs deprecadas ni paquetes abandonados | `deprecated-apis` "Usos de APIs deprecadas" reglas de `migrate-deprecated-apis` ≤ 0; `abandoned-packages` "Paquetes abandonados" ≤ 0 | `migrate-deprecated-apis`, `replace-abandoned-packages` |
| 7 | `decoupling` | Desacople | Sin jQuery ni herencia de clases base propias | `jquery` "jQuery / DOM directo" reglas de `remove-jquery` ≤ 0 (react); `base-classes` "Herencia de clases base" reglas de `replace-base-class-inheritance` ≤ 0 (react) | `remove-jquery`, `replace-base-class-inheritance` |
| 8 | `data-http` | Datos y HTTP | Acceso a datos y HTTP en su capa | `n-plus-one` "Consultas N+1" ≤ 0 (laravel); `data-layer` "SQL fuera de infraestructura / duplicado" ≤ 0 (laravel); `http-layer` "HTTP en componentes / duplicado / URL fija" ≤ 0 (react) | `reduce-n-plus-one`, `extract-data-layer`, `isolate-http-layer` |
| 9 | `complexity` | Complejidad | Sin clases ni componentes gigantes | `god-classes` "Clases gigantes" reglas de `break-god-classes` ≤ 0; `large-components` "Componentes grandes" reglas de `split-large-components` ≤ 0 (react) | `break-god-classes`, `split-large-components` |
| 10 | `upgrade` | Actualizacion y validacion | Versiones al dia y la mayoria del codigo sano | `major-updates` "Saltos de version mayor pendientes" ≤ 0; `healthy-files` "Archivos sanos" = `healthyPercent` ≥ 80 (percent) | `apply-safe-updates`, `upgrade-major-versions`, `validate-risk-reduction` |

Los gates de reglas y de duplicados usan `format: "count"`; los de dependencias tambien.

`planPhases(signals, stack, taskKeys)` → `PlanPhase[]` (las 11, en orden):

- `{ number, key, title, goal, status, current, gates, tasks }`; `gates` = solo los que aplican al
  `stack`; `tasks` = las de la tabla que estan en `taskKeys` (las del plan generado), en ese orden.
- `status`: `"not-applicable"` sin gates; `"failed"` si algun gate fallo; `"unknown"` si ninguno fallo
  y alguno no tiene datos; `"passed"` si todos pasaron.
- `current`: `true` solo en la primera fase `failed` o `unknown`. Si todas pasan (o no aplican),
  ninguna es actual.

## Integracion

- `PlanGraph.phases: PlanPhase[]` en `/plan.json` (y en la respuesta de actualizar una tarea).
- `buildPlan(snapshot, repository, project, dependencies?, protectionLevel?)`.
- `PlanController` pide el nivel a un puerto opcional `ProtectionLevelProvider.getLevel(target)`; si
  falta o falla, `protectionLevel` es `null` (el plan no se rompe). Las rutas lo arman con
  `buildProtectionBaseline` y `protectionStackOf(config, target)` (nuevo helper de `protection`
  que tambien usa `ProtectionController`).

## Criterios de aceptacion

- Cada gate con su valor, comparador y estado (incluidos `unknown` por falta de datos y el borde
  `value = target`); gates por stack.
- Estados de fase y fase actual (incluye todo pasado y fases que no aplican).
- `tasks` filtradas a las del plan; tareas nuevas con sus reglas y dependencias.
- Señales `topRiskUntested` (top 10, exclusiones, solo escaneados) y `healthyPercent`.
- Validacion real: brandsites y mc con su fase actual y gates.
