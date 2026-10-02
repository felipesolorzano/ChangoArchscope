# Persistencia de mapas de bounded contexts por proyecto

## Objetivo

Un mapa (`laravel`, `design`, `react`, `react-design`) describe UN proyecto concreto. Si se cambia
`modulesPath` en `chango-archscope.config.mjs` para analizar otro proyecto, los mapas del anterior no
deben aparecer en las pestañas Migracion/Diseño del nuevo (antes se guardaban solo por target y se
mezclaban).

## Reglas

- Proyecto = raiz absoluta del stack del target: `config.laravel.modulesPath` para `laravel`/`design`
  (y cualquier target no React), `config.react.modulesPath` para `react`/`react-design`.
  `projectRootFor(target, stacks)` (puro, en `resolveProjectSource.ts`) lo resuelve con la misma regla
  de stack que `resolveProjectSource`.
- `BoundedContextMapRepository.getMap(target, project)` / `saveMap(target, project, map)`: clave
  `(target, project)`.
- `BoundedContextMapController` (show/save) resuelve el proyecto con `deps.projectOf(target)`.
- Migracion `006_project_scoped_state.sql`: tabla `bounded_context_maps_by_project` con PK
  `(target, project)`; copia las filas existentes con `project = ''` (proyecto desconocido: no se
  muestran en ningun proyecto; se re-importan con `PUT /bounded-context-map`, ver `docs/maps/`).

## Criterios de aceptacion

- `projectRootFor`: `react`/`react-design` → raiz react; `laravel`/`design`/otro → raiz laravel.
- Dos proyectos con el mismo target no se pisan; el mismo proyecto con dos targets tampoco.
- `show` y `save` usan el proyecto del target pedido.
- La migracion conserva los mapas existentes con `project = ''`.
