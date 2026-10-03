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

Regla de base del flujo: nunca se cambian codigo y versiones a la vez. Lo que tiene reemplazo en la
version ACTUAL se migra antes de actualizar; lo que solo existe en la version nueva, despues.

| key | categoria | reglas | dependsOn |
|---|---|---|---|
| `apply-legacy-codemods` | legacy_api | `unsafe-lifecycle`, `find-dom-node`, `string-ref`, `removed-php-function` | `add-characterization-tests`, `add-component-tests` |
| `migrate-deprecated-apis` | legacy_api | `with-router`, `deprecated-library`, `deprecated-php-function` | `apply-legacy-codemods`, `add-characterization-tests`, `add-component-tests` |
| `apply-post-upgrade-codemods` | legacy_api | `legacy-react-dom-api` (`render`/`hydrate`/`unmountComponentAtNode` → `createRoot`, requiere React 18) | `upgrade-major-versions`, `add-component-tests` |

`apply-legacy-codemods` y `migrate-deprecated-apis` van en el roadmap despues de
`replace-base-class-inheritance`; `apply-post-upgrade-codemods` despues de `upgrade-major-versions`.
Titulos: "Aplicar codemods compatibles (antes de actualizar)" ("Con los tests en verde: lifecycles,
string refs, findDOMNode y funciones PHP eliminadas tienen reemplazo en la version actual."), "Migrar
APIs y librerias deprecadas" ("withRouter, moment/request/react-ga, utf8_encode: migracion manual
guiada por el panel Codemods, antes de subir versiones.") y "Aplicar codemods de la version nueva"
("Despues de subir React: ReactDOM.render / hydrate → createRoot.").

## Gates

`{ key, label, value, target, comparator, format, status }`:

- `comparator`: `"max"` (pasa si `value <= target`) o `"min"` (pasa si `value >= target`).
- `format`: `"count"`, `"percent"` o `"level"` (0 ninguna, 1 baja, 2 media, 3 alta).
- `status`: `"passed"`, `"failed"` o `"unknown"` (`value` nulo: no hay datos, p. ej. sin reporte de
  dependencias en cache o sin nivel de proteccion).
- Un gate de reglas suma los hallazgos de los selectores (`countSelected`) de las tareas que nombra.
- Un gate de dependencias toma `dependencies.counts[tarea]`; sin `dependencies` es `null`.

## Fases (`domain/services/planPhases.ts`, puro)

Orden del flujo: limpiar → proteger → arreglar codigo sin tocar versiones → actualizar paquetes de
menor a mayor → adoptar lo que exige la version nueva → complejidad y validacion.

| # | key | titulo | meta | gates (`stack` si no aplica a los dos) | tareas |
|---|---|---|---|---|---|
| 0 | `baseline` | Linea base | Todo el codigo propio se analiza | `parse-errors` "Archivos que no parsean" = `skippedFiles` ≤ 0 | `exclude-third-party` |
| 1 | `cleanup` | Limpieza | Sin copias, archivos muertos ni migraciones a medias | `manual-copies` "Copias manuales" ≤ 0; `unused-files` "Archivos sin uso" ≤ 0; `duplicate-migrations` "Migraciones a medias (_new)" = `duplicatePairs` ≤ 0; `unused-exports` "Exports sin uso" ≤ 0 (react); `unused-packages` "Paquetes sin uso" ≤ 0 | `remove-manual-copies`, `remove-unused-files`, `resolve-duplicate-migrations`, `remove-unused-exports`, `remove-unused-packages` |
| 2 | `safety-net` | Red de seguridad | Lo mas riesgoso tiene tests antes de tocarlo | `protection-level` "Nivel de proteccion" ≥ 1 (level); `top-risk-untested` "Sin tests entre los 10 mas riesgosos" = `topRiskUntested` ≤ 0 | `add-characterization-tests`, `add-component-tests` |
| 3 | `security` | Seguridad del codigo | Sin inyecciones ni sinks XSS, con los tests como red | `injections` "Inyecciones (SQL, eval, Function)" reglas de `close-sql-injections` + `close-code-injection` ≤ 0; `xss-sinks` "Sinks XSS" reglas de `close-xss-sinks` ≤ 0 (react) | `close-sql-injections`, `close-code-injection`, `close-xss-sinks` |
| 4 | `architecture` | Arquitectura | Sin ciclos de imports | `import-cycles` "Ciclos de imports" ≤ 0 | `break-import-cycles` |
| 5 | `pre-upgrade-apis` | APIs legacy (antes de actualizar) | Migrar lo que ya tiene reemplazo en la version actual | `removed-apis` "APIs eliminadas con reemplazo actual" reglas de `apply-legacy-codemods` ≤ 0; `deprecated-apis` "APIs y librerias deprecadas" reglas de `migrate-deprecated-apis` ≤ 0 | `apply-legacy-codemods`, `migrate-deprecated-apis` |
| 6 | `layers` | Desacople y capas | jQuery, herencia, HTTP y datos en su capa | `jquery` "jQuery / DOM directo" reglas de `remove-jquery` ≤ 0 (react); `base-classes` "Herencia de clases base" reglas de `replace-base-class-inheritance` ≤ 0 (react); `http-layer` "HTTP en componentes / duplicado / URL fija" ≤ 0 (react); `n-plus-one` "Consultas N+1" ≤ 0 (laravel); `data-layer` "SQL fuera de infraestructura / duplicado" ≤ 0 (laravel) | `isolate-http-layer`, `remove-jquery`, `replace-base-class-inheritance`, `reduce-n-plus-one`, `extract-data-layer` |
| 7 | `safe-updates` | Paquetes vulnerables y patch/minor | Actualizaciones que no rompen, con los tests en verde | `vulnerable-packages` "Paquetes vulnerables" ≤ 0; `safe-updates` "Actualizaciones patch/minor pendientes" ≤ 0 | `fix-vulnerable-packages`, `apply-safe-updates` |
| 8 | `major-upgrades` | Runtime y versiones major | Un salto a la vez, con tests verdes antes y despues | `unsupported-runtime` "Runtime sin soporte" ≤ 0; `major-updates` "Saltos de version mayor pendientes" ≤ 0; `abandoned-packages` "Paquetes abandonados" ≤ 0 | `update-unsupported-runtime`, `upgrade-major-versions`, `replace-abandoned-packages` |
| 9 | `post-upgrade-apis` | APIs de la version nueva | Adoptar lo que exige la version nueva | `post-upgrade-apis` "APIs a migrar despues de actualizar" reglas de `apply-post-upgrade-codemods` ≤ 0 (react) | `apply-post-upgrade-codemods` |
| 10 | `validation` | Complejidad y validacion | Sin piezas gigantes y la mayoria del codigo sano | `god-classes` "Clases gigantes" reglas de `break-god-classes` ≤ 0; `large-components` "Componentes grandes" reglas de `split-large-components` ≤ 0 (react); `healthy-files` "Archivos sanos" = `healthyPercent` ≥ 80 (percent) | `break-god-classes`, `split-large-components`, `validate-risk-reduction` |

Los gates de reglas y de duplicados usan `format: "count"`; los de dependencias tambien.

`planPhases(signals, stack, taskKeys)` → `PlanPhase[]` (las 11, en orden):

- `{ number, key, title, goal, status, current, gates, tasks }`; `gates` = solo los que aplican al
  `stack`; `tasks` = las de la tabla que estan en `taskKeys` (las del plan generado), en ese orden.
- `status`: `"not-applicable"` sin gates; `"failed"` si algun gate fallo; `"unknown"` si ninguno fallo
  y alguno no tiene datos; `"passed"` si todos pasaron.
- `current`: `true` solo en la primera fase `failed` o `unknown`. Si todas pasan (o no aplican),
  ninguna es actual.

## Grafo por fases (layout y flechas)

- `planLayout(tasks, phaseOf)`: columna = posicion de la fase de la tarea entre las fases que tienen
  tareas (sin huecos), `x = columna * 320`; fila en orden de roadmap dentro de la columna,
  `y = fila * 250`. `stage` = columna. Una tarea sin fase va a una columna final.
- `phaseOf` sale de `planPhases(...).tasks`.
- `PlanGraph.lanes: [{ phase, title, status, current, x }]`: un encabezado por columna (fase con
  tareas), en orden.
- Flechas: reduccion transitiva de `dependsOn` entre las tareas incluidas (si A→B y B→C, no se dibuja
  A→C). `dependsOn` de cada tarea no cambia.

## Bloqueo automatico (`domain/services/planLocks.ts`, puro)

El flujo se hace cumplir: no se puede empezar lo que todavia no toca.

`planLocks({ tasks, phases, states })` → `Record<taskKey, string | null>` (motivo del bloqueo):

- Dependencias: las de `dependsOn` cuyo estado no es `"done"` → `"Espera a: <hasta 3 titulos separados
  por ', '>"` + `" (+<resto>)"` si hay mas.
- Fase abierta: la primera fase no cerrada. Una fase esta cerrada si su `status` es `passed` o
  `not-applicable`, si no tiene tareas en el plan, o si todas sus tareas estan `"done"` (salida manual
  cuando un gate no llega a la meta por falsos positivos). Una tarea de una fase posterior a la abierta
  → `"Hasta cerrar la fase <n> · <titulo>"`.
- Si aplican los dos, gana el de dependencias; sin bloqueo, `null`. Una tarea sin fase solo se bloquea
  por dependencias.
- `PlanGraphNode.lockReason: string | null` (lo arma `buildPlanGraph` con los estados).
- Cambiar una tarea bloqueada a `in_progress` o `done` falla (`assertTaskUnlocked(graph, taskKey,
  state)` en `PlanController.update`, antes de guardar): `La tarea "<titulo>" esta bloqueada. <motivo>.`
  (HTTP 400 como los demas errores). `pending` y `blocked` siempre se permiten; una tarea que no esta
  en el plan no se valida (la valida `updateTaskState` como antes).

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
- Bloqueo: por dependencias, por fase abierta (cerrada por gates, por no tener tareas o por tareas
  hechas), prioridad del motivo y rechazo de `in_progress`/`done` en el update.
- Validacion real: brandsites y mc con su fase actual y gates.
