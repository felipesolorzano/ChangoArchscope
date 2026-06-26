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
  php_compatibility verde lima, mixed neutro.
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
