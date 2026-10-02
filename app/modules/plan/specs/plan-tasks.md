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
| `add-characterization-tests` | testing | `untested-complex-method` | — |
| `add-component-tests` | testing | `untested-component` con severidad `high` | — |
| `reduce-n-plus-one` | database | `n-plus-one-query` | `add-characterization-tests` |
| `extract-data-layer` | database | `raw-sql-outside-infrastructure`, `duplicate-sql` | `add-characterization-tests`, `close-sql-injections` |
| `break-god-classes` | complexity | `large-class` | `add-characterization-tests`, `add-component-tests` |
| `isolate-http-layer` | api_access | `http-in-component`, `duplicate-endpoint`, `hardcoded-api-url` | `add-component-tests` |
| `remove-jquery` | coupling | `jquery-usage`, `direct-dom-access` | `add-component-tests` |
| `replace-base-class-inheritance` | coupling | `base-class-inheritance` | `add-component-tests`, `isolate-http-layer` |
| `split-large-components` | complexity | `large-component`, `long-render`, `large-state` | `add-component-tests` |
| `validate-risk-reduction` | validation | 0 (siempre, si hay alguna otra) | todas las demas |

Las tareas basadas en reglas solo aparecen si el stack produce esas reglas: un proyecto Laravel no
genera las de React y viceversa (salvo `close-code-injection` y `break-god-classes`, que aplican a
los dos).

## Hallazgos por tarea (`findingsForTask(snapshot, taskKey)`)

- Tarea con selectores: los hallazgos del snapshot que coinciden con alguno (maximo 100 items;
  `total` es el conteo completo).
- `exclude-third-party`: los `skippedFiles`. `resolve-duplicate-migrations`: los pares `_new`.
- Tarea desconocida: vacio.

## Estado por target

El estado de cada tarea (`pending | in_progress | done | blocked`) se guarda por `(target, taskKey)`:
marcar una tarea en React no la marca en Laravel.

- `PlanTaskStateRepository.getStates(target)` / `setState(target, taskKey, state)`.
- `updateTaskState(repository, target, taskKey, state)` valida estado y `taskKey` como antes.
- `buildPlan(snapshot, repository)` usa `repository.getStates(snapshot.target)`.
- `PlanController.update` persiste con el `target` del query (default `laravel`).
- Migracion `005_plan_task_states_by_target.sql`: tabla `plan_task_states_by_target` con PK
  `(target, task_key)`; copia los estados existentes como `target = 'laravel'` (no se pierde el avance
  ya marcado). La tabla vieja queda sin uso.

## Layout del grafo (`planLayout`)

- Columna = etapa (profundidad en el DAG de dependencias), `x = etapa * 320`.
- Fila dentro de la etapa en orden de roadmap, `y = fila * 250`: la tarjeta (titulo de 2 lineas,
  descripcion de 3 y dos filas de estados) mide ~225px; con menos espacio las tarjetas de una misma
  etapa se pisan (visible en React, que tiene 5 tareas en la etapa 1).

## Criterios de aceptacion

- Cada tarea nueva aparece con su metrica cuando hay hallazgos de sus reglas, y no aparece sin ellos.
- `add-component-tests` cuenta solo `untested-component` high (los medium no).
- Las dependencias de la tabla se respetan y se podan a las incluidas.
- `findingsForTask` devuelve exactamente los hallazgos que coinciden con los selectores (incluido el
  filtro por severidad).
- Estados de dos targets con la misma `taskKey` no se pisan; la migracion conserva los existentes
  como `laravel`.
- Validacion manual: `/plan.json?target=react` sobre el proyecto real devuelve el roadmap React.
