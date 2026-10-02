# Audit Explorer (React)

## Objetivo

Pantalla React que consume `/audit-graph.json` (grafo backend-driven, ver
`app/modules/audit/specs/audit-graph.md`) y lo pinta con React Flow como un mapa de riesgo.
El backend ya manda nodos con `position`, `size` y codificacion visual; el cliente **no
calcula layout**: solo mapea el grafo a nodos/edges de React Flow y los renderiza.

## Capas

- `domain/value-objects/AuditGraph.ts`: tipos espejo del `AuditGraph` backend.
- `application/contracts/AuditGraphProvider.ts` + `use-cases/loadAuditGraph.ts`: puerto y caso de uso.
- `application/dtos/AuditGraphDto.ts`: `toAuditGraph(dto)` normaliza la respuesta HTTP.
- `infrastructure/api`: `fetchAuditJson`, `HttpAuditGraphProvider` (arma URL con `target`).
- `infrastructure/factory/createAuditExplorerDependencies.ts`.
- `infrastructure/react-flow/auditFlowAdapter.ts`: **funcion pura** que mapea
  `AuditGraphNode[] -> RF Node[]` (usando `node.position` tal cual) y `AuditGraphEdge[] -> RF Edge[]`.
- `presentation/constants/auditView.ts`: **mapas puros** `toneFill(tone)` y `accentStroke(accent)`
  (colores aptos para daltonicos) y `severityBarSegments(mix)`.
- `presentation/store/auditExplorerStore.ts`: store Zustand con `focusedNodeId` y sus acciones
  (estado compartido entre canvas y drawer; regla del proyecto: no pasar setters por props).
- `presentation/hooks/useAuditGraphController.ts`: carga el grafo (loading/error), expone el grafo.
- `presentation/components`: `AuditCanvas` (ReactFlow), `AuditNodeCard` (nodo visual),
  `AuditLegend`, `AuditDetailDrawer`.
- `presentation/pages/AuditExplorer.tsx` + css.

## Codificacion visual (overview)

- **Tamano** del nodo = `node.size` (ya viene del backend, ∝ risk en escala log).
- **Relleno** = `toneFill(node.tone)` (severidad dominante): critical/high rojos, medium ambar,
  low amarillo tenue, none gris.
- **Borde** = `accentStroke(node.accent)` (categoria dominante): security rojo, database azul,
  complexity morado, testing ambar, dead_code gris, coupling_low_level teal,
  php_compatibility verde lima, api_access rosa, mixed neutro.
- **Mini-barra apilada** dentro del nodo con `severityBarSegments(node.severityMix)` (high/medium/low).
- **Badges** (`node.badges`) como etiquetas colgando del nodo.
- **Metrica** visible: `findings` y `risk`.
- Edges `contains` raiz->app como lineas suaves.

## Comportamiento

- Al montar, `useAuditGraphController` llama a `loadAuditGraph(provider, target)`; mientras
  carga muestra estado "Cargando"; ante error muestra el mensaje.
- Click en un nodo: setea `focusedNodeId` en el store; el `AuditDetailDrawer` muestra los
  detalles del nodo enfocado (label, metrics, severityMix, badges).
- Cambio de pantalla Arquitectura/Auditoria: tabs en el modulo `app` (no router).

## Helpers puros (con test + mutation dirigido)

- `auditFlowAdapter`: `toFlowNodes(nodes)` y `toFlowEdges(edges)`.
- `auditView`: `toneFill`, `accentStroke`, `severityBarSegments`.

Las vistas pesadas (`AuditCanvas`, `AuditNodeCard`, `AuditExplorer`) no entran al mutation
general (regla de React de `docs/development-rules.md`): se valida la logica via los helpers puros.

## Criterios de aceptacion

- `toFlowNodes` mapea cada `AuditGraphNode` a un RF Node con `position` identica y `type: "auditNode"`.
- `toFlowEdges` mapea cada `AuditGraphEdge` a un RF Edge con `source`/`target`/`id` preservados.
- `toneFill`/`accentStroke` devuelven un color por cada valor del enum y un fallback para desconocidos.
- `severityBarSegments` devuelve segmentos proporcionales high/medium/low que suman 100% (o vacio si todo 0).
- `toAuditGraph` preserva nodos/edges/summary del DTO.

## Categorias por stack (target React, Fase 4)

`auditCategoriesFor(target)` (`presentation/constants/auditCategories.ts`, puro) devuelve las
categorias `{ accent, label }` que tienen sentido para el stack, en este orden:

- `laravel`: Compatibilidad PHP, Seguridad, Base de datos, Complejidad, Testing, Codigo muerto,
  Acoplamiento.
- `react`: Seguridad, API / HTTP (`api_access`), Complejidad, Testing, Codigo muerto, Acoplamiento.

El filtro de categoria antepone "Todas las categorias"; la leyenda agrega "Mixto" al final.

Criterios de aceptacion:

- `auditCategoriesFor("laravel")` incluye `php_compatibility` y `database`, no `api_access`.
- `auditCategoriesFor("react")` incluye `api_access`, no `php_compatibility` ni `database`.
- `accentStroke("api_access")` es un color propio, distinto de `mixed` y de los demas acentos.

## Contrato de render de los componentes (tests con `react-dom/server`)

- `AuditCanvas`: "Cargando mapa de auditoria..." / el error / el lienzo de React Flow.
- `AuditNodeCard`: label, hallazgos y "risk N" formateados (`1,234`), la mini-barra solo si hay
  severidades, y los badges solo si hay.
- `AuditDetailDrawer`: nada si no hay nodo enfocado; si hay: tipo, label, hallazgos y risk, leyenda
  "High/Medium/Low N", seccion "Señales" solo con badges, seccion "Hallazgos" solo con findings (con
  "mostrando N de TOTAL" si hay mas) y "Click para profundizar…" solo si `drill`.
- `AuditFilters`: el selector "PHP objetivo" solo con `laravel`; el de categoria con "Todas las
  categorias" + `auditCategoriesFor(target)`.
- `AuditLegend`: un item por categoria del stack mas "Mixto".
- `AuditExplorer`: miga (`AuditBreadcrumb`), boton "Escaneando…"/"Refrescar" segun carga, y el toggle
  "Mapa por apps"/"Heatmap global" (`AuditViewToggle`) solo en overview/heatmap. La linea de resumen la
  arma `summaryText(graph, view)` (pura): "N hallazgos · risk R · K <unidad>", con K = nodos menos la
  raiz (todos en heatmap) y unidad apps/archivos/reglas segun la vista, mas " · click en un nodo para
  profundizar" salvo en la vista archivo.
