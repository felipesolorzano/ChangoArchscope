# Componentes de Migracion / Diseño (contrato de render)

Tests de componente con `react-dom/server` (sin DOM). Las interacciones pasan por `migrationStore`.

## `MigrationCanvas({ loading, error, empty, nodes, edges })`

- `loading` → "Cargando mapa de bounded contexts...". `error` → el mensaje.
- `empty` → "Aún no hay mapa…" con la referencia a `docs/bounded-context-map-schema.md`.
- Con mapa → lienzo de React Flow.

## Nodos

- `BcModuleCard`: nombre, descripcion (si hay), "N archivos", y "Validado" o "Validar" segun
  `module.validated` (con la clase `bc-module--ok` si esta validado).
- `BcLayerCard`: nombre legible de la capa y su conteo.
- `BcFileCard`: nombre del archivo (sin carpetas), la nota si hay, y un selector con las 4 capas con la
  capa actual seleccionada.

## `MigrationExplorer({ dependencies })`

- Vista general: miga "Mapa de bounded contexts"; con mapa, "N módulos · K validados" y la ayuda de la
  vista (`viewHint(view)`: "click en un módulo…" en overview, "usa el selector…" en modulo).
- Mientras carga, el lienzo muestra el estado de carga.

## `useMigrationController`

Se compone de `useBoundedContextMap` (carga y guardado optimista) y la navegacion overview/modulo. Las
transformaciones del mapa son puras y exportadas: `applyMoveFile(map, moduleKey, from, path, to)`
(mover un archivo de capa; sin cambios si no existe) y `toggleModuleValidated(map, moduleKey)`.
