# Tareas del plan (`generatePlan` + `findingsForTask`) — Laravel y React

## Objetivo

Derivar del `AuditSnapshot` un roadmap de remediacion (tareas + dependencias) para cualquiera de los
dos stacks, y poder listar los hallazgos concretos que respaldan cada tarea. `plan` decide QUE hacer
y en que orden; `audit` solo diagnostica.

## Entradas

- `PlanSignals` (las arma `auditSnapshotToSignals`, adaptador entre bounded contexts):
  - `findingCounts: Record<rule, Record<severity, number>>` — hallazgos por regla y severidad.
  - `categoryCounts: Record<category, number>`.
  - `duplicatePairs: number` — pares `X` / `X_new` en `riskBreakdown.byFile`.
  - `skippedFiles: number` — archivos que no parsearon.

## Selectores de reglas (`planTaskRules.ts`)

`TASK_RULES: Record<taskKey, TaskRuleSelector[]>`, con `TaskRuleSelector = { rule, severities? }`.
Un hallazgo coincide con un selector si `finding.rule === rule` y (sin `severities`, o su severidad
esta en `severities`). Es la UNICA fuente: la metrica de la tarea y los hallazgos del panel salen de
los mismos selectores.

- `countSelected(signals, selectors)` = suma de `findingCounts[rule][severity]` de los hallazgos que
  coinciden.

## Tareas (en orden de roadmap)

Cada tarea se incluye solo si su metrica es > 0. `dependsOn` se poda a las tareas incluidas.

| key | categoria | metrica | dependsOn |
|---|---|---|---|
| `exclude-third-party` | scope | `skippedFiles` | — |
| `close-sql-injections` | security | `sql-concatenation` | — |
| `close-code-injection` | security | `eval-usage`, `new-function` | — |
| `close-xss-sinks` | security | `dangerously-set-inner-html`, `inner-html-assignment` | — |
| `resolve-duplicate-migrations` | debt | `duplicatePairs` | — |
| `remove-manual-copies` | debt | `manual-copy-file` | — |
| `remove-unused-files` | debt | `possibly-unused-file` | `remove-manual-copies` |
| `break-import-cycles` | architecture | `import-cycle` (XRay X1) | `add-characterization-tests`, `add-component-tests` |
| `remove-unused-exports` | debt | `unused-export` (XRay X2) | `remove-unused-files` |
| `add-characterization-tests` | testing | `untested-complex-method` | — |
| `add-component-tests` | testing | `untested-component` con severidad `high` | — |
| `reduce-n-plus-one` | database | `n-plus-one-query` | `add-characterization-tests` |
| `extract-data-layer` | database | `raw-sql-outside-infrastructure`, `duplicate-sql` | `add-characterization-tests`, `close-sql-injections` |
| `break-god-classes` | complexity | `large-class` | `add-characterization-tests`, `add-component-tests` |
| `isolate-http-layer` | api_access | `http-in-component`, `duplicate-endpoint`, `hardcoded-api-url` | `add-component-tests` |
| `remove-jquery` | coupling | `jquery-usage`, `direct-dom-access` | `add-component-tests` |
| `replace-base-class-inheritance` | coupling | `base-class-inheritance` | `add-component-tests`, `isolate-http-layer` |
| `apply-legacy-codemods` | legacy_api | `unsafe-lifecycle`, `legacy-react-dom-api`, `string-ref`, `removed-php-function` (XRay X6) | `add-characterization-tests`, `add-component-tests` |
| `migrate-deprecated-apis` | legacy_api | `with-router`, `deprecated-library`, `deprecated-php-function` (XRay X6) | `apply-legacy-codemods`, `add-characterization-tests`, `add-component-tests` |
| `split-large-components` | complexity | `large-component`, `long-render`, `large-state` | `add-component-tests` |
| `validate-risk-reduction` | validation | 0 (siempre, si hay alguna otra) | todas las demas |

Las tareas basadas en reglas solo aparecen si el stack produce esas reglas: un proyecto Laravel no
genera las de React y viceversa (salvo `close-code-injection` y `break-god-classes`, que aplican a
los dos).

## Tareas de dependencias (F5 de `docs/dependencies-plan.md`)

- `PlanSignals.dependencies?: { counts: Record<taskKey, number>; items: Record<taskKey, PlanFinding[]> }`
  (lo arma `dependencyReportToSignals` a partir del reporte de `dependencies` generado SIN red, desde
  su cache: el Plan nunca espera a npm/OSV; ver `app/modules/dependencies/specs/usage-and-plan.md`).
  Sin `dependencies` las metricas son 0.
- Nuevas plantillas (metrica = `counts[key]`), en este lugar del roadmap:

| key | categoria | dependsOn |
|---|---|---|
| `fix-vulnerable-packages` | dependencies | — (despues de `close-xss-sinks`) |
| `update-unsupported-runtime` | dependencies | — |
| `remove-unused-packages` | dependencies | — |
| `replace-abandoned-packages` | dependencies | `add-characterization-tests`, `add-component-tests` |
| `apply-safe-updates` | dependencies | `fix-vulnerable-packages`, `remove-unused-packages` |
| `upgrade-major-versions` | dependencies | `apply-safe-updates`, `update-unsupported-runtime`, `add-characterization-tests`, `add-component-tests` |

  (las cuatro primeras van antes de `resolve-duplicate-migrations`; las dos ultimas despues de
  `split-large-components`, antes de `validate-risk-reduction`).
- `findingsForTask(snapshot, taskKey, dependencies?)`: para estas tareas devuelve
  `dependencies.items[taskKey]` (maximo 100; `total` completo); sin `dependencies`, vacio.
- `PlanController` pide las señales a un puerto `DependencySignalsProvider.getSignals(target)` en
  show, update y findings; si falla, el plan sale sin tareas de dependencias (no rompe el plan).
- `buildPlan(snapshot, repository, project, dependencies?)`.

## Pares de migracion a medias (`findDuplicateMigrationPairs`, puro, `domain/services`)

Fuente UNICA de `duplicatePairs` (metrica) y de los items de `resolve-duplicate-migrations` (panel):

- Entrada: las rutas de `riskBreakdown.byFile`.
- El basename se parte en el PRIMER punto: `stem` + `extension` (`Trafic_new.lib.inc` → `Trafic_new` +
  `.lib.inc`; sin punto, extension vacia).
- Un archivo es la mitad nueva de un par si su `stem` termina en `_new` y existe (en cualquier carpeta)
  un archivo cuyo basename es `stem` sin `_new` + la misma extension.
- Devuelve `{ file, original }` por cada archivo `_new` que cumple, en el orden de entrada
  (`original` = basename del archivo viejo). `duplicatePairs` = su cantidad.

## Hallazgos por tarea (`findingsForTask(snapshot, taskKey)`)

- Tarea con selectores: los hallazgos del snapshot que coinciden con alguno (maximo 100 items;
  `total` es el conteo completo).
- `exclude-third-party`: los `skippedFiles`. `resolve-duplicate-migrations`: los pares `_new`.
- Tarea desconocida: vacio.

## Estado por target y proyecto

El estado de cada tarea (`pending | in_progress | done | blocked`) se guarda por
`(target, project, taskKey)`: marcar una tarea en React no la marca en Laravel, y el avance de un
proyecto no aparece en otro al cambiar `modulesPath` (proyecto = raiz del stack, como en
`app/modules/migration/specs/map-persistence.md`).

- `PlanTaskStateRepository.getStates(target, project)` / `setState(target, project, taskKey, state)`.
- `updateTaskState(repository, target, project, taskKey, state)` valida estado y `taskKey` como antes.
- `buildPlan(snapshot, repository, project)` usa `repository.getStates(snapshot.target, project)`.
- `PlanController` resuelve el proyecto con `deps.projectOf(target)` (target del query, default
  `laravel`) en show/update.
- Migracion `006_project_scoped_state.sql`: tabla `plan_task_states_by_project` con PK
  `(target, project, task_key)`; copia los estados de `plan_task_states_by_target` con `project = ''`.
- Migracion `005_plan_task_states_by_target.sql`: tabla `plan_task_states_by_target` con PK
  `(target, task_key)`; copia los estados existentes como `target = 'laravel'` (no se pierde el avance
  ya marcado). La tabla vieja queda sin uso.

## Layout del grafo (`planLayout`)

- Columna = etapa (profundidad en el DAG de dependencias), `x = etapa * 320`.
- Fila dentro de la etapa en orden de roadmap, `y = fila * 250`: la tarjeta (titulo de 2 lineas,
  descripcion de 3 y dos filas de estados) mide ~225px; con menos espacio las tarjetas de una misma
  etapa se pisan (visible en React, que tiene 5 tareas en la etapa 1).

## Fases con quality gates (`PlanGraph.phases`, XRay X6)

Ver `plan-phases.md`.

## Checklist auditado (`PlanGraph.checks`)

- `buildPlan` agrega `checks: [{ category, label, findings }]`: las categorias que audita el stack del
  snapshot (`auditCategoriesFor(target)` de `audit`, consumido como contrato publicado, igual que el
  `AuditSnapshot`) con su cantidad de hallazgos (`summary.by_category`, 0 si no hay). Permite mostrar
  en verde lo auditado cuando no quedan tareas.

## Criterios de aceptacion

- Cada tarea nueva aparece con su metrica cuando hay hallazgos de sus reglas, y no aparece sin ellos.
- `add-component-tests` cuenta solo `untested-component` high (los medium no).
- Las dependencias de la tabla se respetan y se podan a las incluidas.
- `findingsForTask` devuelve exactamente los hallazgos que coinciden con los selectores (incluido el
  filtro por severidad).
- Estados de dos targets con la misma `taskKey` no se pisan; la migracion conserva los existentes
  como `laravel`.
- Validacion manual: `/plan.json?target=react` sobre el proyecto real devuelve el roadmap React.
