# Architecture Explorer: componentes y mapeo a React Flow

Tests de componente con `react-dom/server` (sin DOM) y tests unitarios de las funciones puras.

## Funciones puras de React Flow (`infrastructure/react-flow/architectureFlowMapping.ts`)

- `toArchitectureFlowEdges(edges)`: un edge de React Flow por edge del grafo, con flecha cerrada. Ids
  repetidos reciben sufijo `:1`, `:2`… (el primero queda igual). Los `crossModule` van animados, con
  label "module import" y estilo naranja (`#f97316`, ancho 2.4); los demas con label = tipo del edge y
  estilo gris (`#64748b`, ancho 1.2).
- `toArchitectureFlowNodes(nodes, edges, focusedNodeId, savedPositions)`: nodo `architectureNode`
  arrastrable con `data` = nodo y `selected` solo para el enfocado. Posicion: la de foco
  (`focusPositionsFor`) si hay foco; si no, la guardada por drag; si no, la de grilla (`positionFor`).
- `focusPositionsFor` (ya existente, caracterizado): entrantes en la columna x=80, salientes en x=840,
  los que son ambas cosas debajo del foco en x=460, el foco en x=460; cada columna ordenada por capa
  (modulos primero), modulo y label, con 112px entre filas desde y=80.

- `groupNodes` / `positionFor` (grilla sin foco, caracterizado): una columna por modulo (orden
  alfabetico, 420px), desplazada 72px por capa (modulo 0, Domain 1 … Presentation 4, archivo sin capa
  0); el modulo en y=0 y sus archivos apilados cada 92px desde y=140 por grupo modulo+capa.

## Componentes

- `Stat`: label y valor.
- `ArchitectureNodeCard`: label; meta "Module" para modulos o "<modulo> / <capa|File>" para archivos;
  rol si hay; clase por capa (`architecture-node-domain`…, `-module`, `-file` por defecto).
- `ArchitectureCanvas`: boton "Panel" solo con el sidebar cerrado; "Cargando grafo..." / error / lienzo.
  `minimapNodeColor(node)` (puro): color de la capa del nodo, el de `module` para modulos, y gris
  `#94a3b8` para archivos sin capa o con una capa sin color.
- `ArchitectureCheckModal`: titulo "Architecture check" y el modulo (o "Todos los módulos");
  "Ejecutando check..." / error; con resultado: PASS o REVISAR, las 4 metricas, y por modulo su
  estado, archivos revisados y las listas de violaciones/acoplamientos (`IssueList`: "Sin hallazgos"
  si esta vacia; si no, capa → modulo destino, archivo:linea, mensaje, import y recomendacion).
- `ArchitectureSidebar`: selectores de modulo y capa, busqueda, botones Actualizar/Check, metricas
  (solo con grafo), caja de foco "Conexiones de <label>" (solo con nodo enfocado), leyenda e inspector
  (solo con nodo seleccionado).
- `ArchitectureExplorer`: al montar muestra el sidebar y "Cargando grafo...".

## Hooks y filtro

- `useArchitectureFlowGraph` usa las funciones puras de arriba (mismo contrato).
- `useArchitectureGraphController` se compone de la carga del grafo y del estado de filtros; el nodo
  seleccionado lo calcula `selectedNodeFor(filteredNodes, focusedNode, query)` (puro): el enfocado si
  hay; si no, el primero cuyo path contiene la busqueda (sin mayusculas ni espacios extremos); si no,
  null.
- `filterArchitectureGraph`: mismo comportamiento, partido en el subgrafo de foco y el filtro por
  modulo/capa/busqueda.

# App (shell)

- `App`: el selector de stack (Laravel/React, con `aria-pressed` en el activo) y las 5 pestañas
  (Arquitectura activa al inicio), y la vista de Arquitectura montada.
- Cada vista se monta con la clave `viewKey(view, target)` = `"<vista>:<stack>"` (pura): cambiar de
  stack o de pestaña reinicia el estado. En particular Migracion y Diseño usan el mismo componente y no
  deben compartir estado (navegacion, modulo abierto).
- `browserLocation.search()` devuelve "" si no hay `window` (render en servidor/tests).
