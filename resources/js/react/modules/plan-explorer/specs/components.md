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
