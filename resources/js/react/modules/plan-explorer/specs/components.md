# Componentes del Plan (contrato de render)

Tests de componente con `react-dom/server` (`renderToStaticMarkup`, sin DOM): verifican lo que cada
componente muestra para un estado dado. Las interacciones viven en stores/hooks.

## `PlanCanvas({ loading, error, empty, nodes, edges })`

- `loading` → "Cargando plan de remediacion...". `error` → el mensaje de error.
- Sin loading/error y `empty` → "Sin tareas: la auditoria no encontro deuda accionable." y, si hay
  `checks`, el checklist auditado: una fila por categoria con "✓" (clase `--ok`) o su cantidad (clase
  `--bad`).
- Sin loading/error y con tareas → el lienzo de React Flow (`.react-flow`).

## `PlanFindingsDrawer({ graph, focusedTaskKey, findings, loading })`

- Sin `focusedTaskKey` no renderiza nada.
- Titulo = titulo de la tarea enfocada en `graph`, o la `taskKey` si no esta.
- `loading` → "Cargando hallazgos...".
- Hallazgos vacios → "Esta tarea no tiene hallazgos concretos asociados."
- Con hallazgos: contador `findingsCountLabel` ("Mostrando N de TOTAL" si hay mas de los listados; si no
  "TOTAL hallazgos"), y por item severidad, nombre de archivo (sin carpetas), `:linea` solo si
  `line > 0`, y mensaje.
- `findingsCountLabel(findings)` es puro y exportado.

## `PlanTaskCard` (nodo de React Flow)

- Categoria, titulo y descripcion de la tarea.
- Metrica y "Ver hallazgos →" solo si `metric > 0`.
- Un boton por estado (Pendiente, En progreso, Hecho, Bloqueado); el del estado actual marcado activo.

## `PlanExplorer({ dependencies, target })`

- Encabezado "Plan de remediacion" con "N tareas derivadas de la auditoria" y el progreso por estado
  (`PlanProgress`: un item por estado con su conteo).
- Mientras carga, el lienzo muestra el estado de carga.

## Hooks

- `usePlanController` se compone de `usePlanGraph` (grafo, carga, error, recarga y cambio de estado) y
  `useTaskFindings` (tarea enfocada y sus hallazgos). Mismo contrato que antes.

## Red de seguridad (XRay X3)

`/protection.json?target=` (ver `app/modules/protection/specs/protection-baseline.md`) →
`{ root, tests: { testFiles, sourceFiles }, coverage, mutation, e2e, level }`.

- `PlanProvider.getProtection(target)`; `HttpPlanProvider` con `protectionUrl` (target en la query;
  error HTTP → lanza con el status). `createPlanExplorerDependencies({ planUrl, taskUrl,
  protectionUrl })`; el shell usa `"/protection.json"`.
- `usePlanController` carga tambien la proteccion (`protection`, `null` mientras carga o si falla:
  no rompe el plan).
- Helpers puros (`presentation/constants/protectionView.ts`):
  - `protectionLevelLabel(level)`: Ninguna, Baja, Media, Alta. `protectionLevelColor`: none `#dc2626`,
    low `#ea580c`, medium `#ca8a04`, high `#16a34a`.
  - `protectionParts(baseline)`: `["<testFiles> archivos de test · <sourceFiles> fuente",
    "Cobertura <percent>%" | "Cobertura: sin reporte", "Mutation <score>%" | "Mutation: sin reporte",
    "E2E <passed>/<passed+failed>" | "E2E: sin reporte"]`.
- `ProtectionStrip({ protection })` en el encabezado de Plan (nada si es `null`): "Red de seguridad:
  <nivel>" con el color del nivel, las partes separadas, y con nivel `none` la ayuda "Sin red de
  seguridad: empezar por tests de caracterizacion".

## Que proteger primero (XRay X4)

`/characterization.json?target=` (ver `app/modules/characterization/specs/characterization-targets.md`)
→ `{ targets: [{ file, kind, score, risk, importers, untested, endpoints, skeletons: [{ kind, path,
content }] }] }`.

- `PlanProvider.getCharacterization(target)` (`characterizationUrl`, target en la query, error HTTP →
  lanza con el status); `createPlanExplorerDependencies({ …, characterizationUrl })`; el shell usa
  `"/characterization.json"`.
- Store Zustand `planDrawerStore` (X5, reemplaza a `characterizationStore`): `drawer`:
  `"characterization" | "codemods" | "phases" | null` (default `null`: un solo panel abierto a la vez) y
  `setDrawer`; `getServerState` = `getState` (render estatico de los tests).
- Helpers puros (`presentation/constants/characterizationView.ts`):
  - `targetKindLabel`: page → "Pagina", component → "Componente", php → "PHP".
  - `skeletonLabel`: rtl → "Test RTL", msw → "Handlers MSW", playwright → "Playwright", phpunit →
    "PHPUnit".
  - `targetReasons(target)`: `"riesgo <risk>"`; `"importado por <n>"` si `importers > 0`;
    `"<n> sin test: <hasta 3 nombres separados por ', '>"` + `" (+<resto>)"` si hay mas de 3;
    `"<n> endpoint(s)"` si hay endpoints (`"1 endpoint"` / `"N endpoints"`).
- `ProtectionStrip`: boton "Que proteger primero" (abre el panel).
- `CharacterizationList({ plan })` (presentacional): sin objetivos, "No hay objetivos: todo lo
  riesgoso ya tiene evidencia de test"; si no, un item por objetivo con `file`, la etiqueta del kind,
  `score`, las razones unidas por `" · "` y un boton por esqueleto (`skeletonLabel`) con `title` = su
  `path`.
- `CharacterizationDrawer({ provider, target })`: solo con `drawer === "characterization"`; al abrir pide el plan (una vez por
  montaje); "Calculando objetivos…" mientras carga, el error si falla, y la lista; boton "Cerrar".
  Click en un esqueleto lo descarga (`infrastructure/browser/downloadText(path, content)`: Blob +
  ancla con `download` = nombre del archivo; adaptador de navegador, fuera de mutation).

## Codemods (XRay X5)

`/codemods.json?target=` (ver `app/modules/codemods/specs/codemod-candidates.md`) → `{ candidates:
[{ pattern, title, tool, command, note, files: [{ file, occurrences, testedBy }], occurrences,
protectedFiles }] }`.

- `PlanProvider.getCodemods(target)` (`codemodsUrl`, target en la query, error HTTP → lanza
  `"No se pudieron calcular los candidatos a codemod (<status>)"`); `createPlanExplorerDependencies({
  …, codemodsUrl })`; el shell usa `"/codemods.json"`.
- `ProtectionStrip`: boton "Codemods" (`setDrawer("codemods")`) junto a "Que proteger primero"
  (`setDrawer("characterization")`).
- Helpers puros (`presentation/constants/codemodView.ts`):
  - `codemodToolLabel(candidate)`: `"Automatico · <tool>"` o `"Manual"` sin tool.
  - `codemodSummary(candidate)`: `"<n> archivo(s) · <m> ocurrencia(s) · <p>/<n> con tests"`
    (singular con 1).
  - `codemodWarning(candidate)`: `null` si todos los archivos tienen tests; si no
    `"Caracterizar antes: <n - p> archivo(s) sin tests"`.
- `CodemodList({ plan })` (presentacional): sin candidatos, "No hay APIs legacy con reemplazo
  conocido"; si no, un item por candidato con `title`, la etiqueta de la herramienta, el resumen, el
  aviso (si hay), la nota (si no esta vacia), el `command` en un `<code>` con boton "Copiar" (si hay)
  y un `<details>` "Archivos" con cada `file`, sus ocurrencias y "con tests" / "sin tests" (`title` =
  los tests separados por `", "`).
- `CodemodDrawer({ provider, target })`: solo con `drawer === "codemods"`; al abrir pide el plan
  (una vez por montaje); "Buscando APIs legacy…" mientras carga, el error si falla, y la lista; boton
  "Cerrar". "Copiar" usa `infrastructure/browser/copyText(text)` (`navigator.clipboard.writeText`;
  adaptador de navegador, fuera de mutation).

## Fases y quality gates (XRay X6)

`PlanGraph.phases?: PlanPhase[]` (ver `app/modules/plan/specs/plan-phases.md`): `{ number, key, title,
goal, status, current, gates: [{ key, label, value, target, comparator, format, status }], tasks }`.

- Helpers puros (`presentation/constants/phaseView.ts`):
  - `phaseStatusLabel`: passed → "Cumplida", failed → "Pendiente", unknown → "Sin datos",
    not-applicable → "No aplica". `phaseStatusColor`: verde `#16a34a`, rojo `#dc2626`, gris
    `#64748b`, gris tenue `#475569`.
  - `gateValue(gate)`: `null` → "sin datos"; percent → `"<n>%"`; level → "Ninguna"/"Baja"/"Media"/
    "Alta" (0–3); count → el numero.
  - `gateTarget(gate)`: `"≤ <target>"` o `"≥ <target>"` con el mismo formato que el valor.
  - `currentPhase(phases)`: la fase con `current`, o `null`.
- `PhaseIndicator({ phases })` (en la cabecera del Plan, debajo de la franja de proteccion): sin fases no renderiza; con fase actual
  `"Fase <n> · <titulo>"`; sin fase actual `"Todas las fases cumplidas"`; boton "Fases"
  (`setDrawer("phases")`).
- `PhaseList({ phases, taskTitles })` (presentacional): un item por fase con `"<n>. <titulo>"`, el
  estado (etiqueta y color), la meta, cada gate `"<label>: <valor> (meta <objetivo>)"` con su estado
  (✓ passed, ✗ failed, ? unknown) y, si tiene, `"Tareas: <titulos unidos por ' · '>"`
  (`taskTitles[key]`, la key si no hay titulo); la fase actual lleva la clase `plan-phases__item--current`.
- `PhaseDrawer({ graph })`: solo con `drawer === "phases"`; titulo "Fases y quality gates", boton
  "Cerrar"; sin `graph`/`phases`, "Calculando fases…"; si no, `PhaseList` con los titulos de las
  tareas del grafo. No pide nada: las fases vienen en `/plan.json`.

## Flujo por fases en el grafo (XRay X6)

- `PlanGraph.lanes?: [{ phase, title, status, current, x }]`: un encabezado por columna.
- `toPlanLaneNodes(lanes)` (adaptador React Flow): nodo `lane:<phase>` de tipo `planLane` en
  `{ x, y: -110 }`, no arrastrable ni seleccionable, con la lane como `data`.
- `PlanLaneHeader` (presentacional): `"Fase <n>"`, el titulo y la etiqueta de estado
  (`phaseStatusLabel`, color `phaseStatusColor`); la fase actual lleva la clase
  `plan-lane--current`.
- El minimapa colorea los encabezados con el color de su estado y las tareas con el de su estado.
- Codemods: cada candidato muestra `codemodTimingLabel` ("Antes de actualizar" /
  "Despues de actualizar") junto a la herramienta.

## Bloqueo automatico (XRay X6)

- `PlanGraphNode.lockReason?: string | null` (ver `plan-phases.md`, "Bloqueo automatico").
- `PlanTaskCard`: con `lockReason`, la tarjeta lleva la clase `plan-task--locked`, muestra
  `"🔒 <motivo>"` y los botones "En progreso" y "Hecho" quedan deshabilitados (con el motivo como
  `title`); "Pendiente" y "Bloqueado" siguen activos.
- Si el servidor rechaza el cambio, el error se muestra como hoy (`setError`).

## Siguiente paso (XRay X6)

- `PlanGraphNode.next?: boolean` (ver `plan-phases.md`, "Siguiente paso").
- `PlanTaskCard`: con `next`, clase `plan-task--next` y la marca "▶ Siguiente paso".
- `PhaseIndicator({ phases, next })` (`next` = el nodo con `next`, o `null`): si hay, boton
  `"Siguiente: <titulo>"` (clase `plan-phases__next`) que abre sus hallazgos (`openTask` del store de
  interacciones del plan). Sin fases no renderiza nada (como antes).

## Carril de hotfix (XRay X6)

- La fase `-1` (hotfix) se muestra sin numero: `phaseHeading(phase)` = `"<n>. <titulo>"`, o solo el
  titulo si `n < 0`; `laneLabel(phase)` = `"Fase <n>"`, o `"Hotfix"` si `n < 0` (encabezado del grafo).
- `PhaseList` usa `phaseHeading`; `PlanLaneHeader` usa `laneLabel`.

## Flechas: orden o dependencias (XRay X6)

- `PlanGraph.edges` = el orden ("termina → sigue"); `PlanGraph.dependencyEdges?` = dependencias reales.
- Store Zustand `planViewStore`: `showDependencies` (default `false`) y `toggleDependencies`.
- Boton `"Ver dependencias"` / `"Ver orden"` (clase `plan-protection__action`) en el indicador de fase;
  el grafo dibuja `dependencyEdges` o `edges` segun el store.
