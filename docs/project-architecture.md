# Arquitectura del Proyecto

El proyecto usa dos entornos separados:

- `app/modules`: codigo modular del backend/CLI en Node.js.
- `resources/js/react`: codigo modular del frontend en React.

Ambos entornos siguen la misma filosofia de arquitectura: **SDD**, **TDD**, **DDD**, **arquitectura hexagonal** y **mutation testing**. Esta arquitectura es deliberadamente la misma que la de Chango Modeler (otro proyecto del workspace): mismo `core/`, mismas capas por modulo, misma convencion de rutas.

El backend y el frontend pueden tener responsabilidades distintas, pero comparten las mismas reglas de diseno: modularidad, capas claras, dependencias hacia adentro y pruebas guiadas por specs.

El flujo obligatorio de trabajo esta documentado en `docs/development-rules.md`.

## Diferencia de naturaleza con Chango Modeler

Chango Modeler es una aplicacion web. Chango Archscope es, ademas, un **paquete CLI distribuible** (`bin/chango-archscope.mjs` con los comandos `init`, `serve`, `graph`, `check`) que se instala en otros proyectos para analizar su arquitectura. Esto produce dos diferencias intencionales frente a Chango Modeler:

- El binario CLI no ejecuta TypeScript directamente: requiere el JavaScript compilado en `build/server/`. Por eso existe `npm run build:node` y el script de ciclo de vida `prepublishOnly` lo ejecuta antes de publicar el paquete.
- Los endpoints JSON de arquitectura (`/graph.json`, `/check.json`) se registran desde `presentation/routes/web.ts` del modulo `architecture` (no desde `presentation/routes/api.ts`), para que sigan respondiendo en la raiz (`/graph.json`) en vez de bajo el prefijo `/api` que aplica `core/http/createHttpApp.ts` a las rutas de `api`. Este es el contrato HTTP publico que ya documentaba `docs/overview.md`.

## Regla Base

La direccion de dependencias es:

```text
presentation / infrastructure
        -> application
        -> domain
```

`domain` y `application` no deben conocer frameworks ni detalles tecnicos.

En Node.js, esto significa que `domain` y `application` no deben depender de Express, Fastify, base de datos, ORMs, colas, HTTP ni servicios externos. El acceso a sistema de archivos para analizar proyectos externos tampoco vive ahi: `domain` define el puerto `SourceTreeReader` y `infrastructure` lo implementa con `node:fs` (`NodeFsSourceTreeReader`).

En React, esto significa que `domain` y `application` no deben depender de React, DOM, React Flow, componentes visuales, fetch, localStorage ni librerias de UI.

## Estructura General

El proyecto se divide en estas raices principales:

```text
app/
└── modules/
core/
bin/
bootstrap/
routes/
resources/
├── views/
└── js/
    └── react/
public/
database/
config/
tests/
```

Cada entorno organiza su codigo por modulos.

La carpeta `core/` contiene el framework interno del proyecto. Ahi viven piezas globales como el servidor HTTP, helpers de vistas, renderizado Edge, rutas base, middleware y utilidades transversales. `core` no debe contener reglas de negocio del producto (analisis de arquitectura).

La carpeta `bin/` contiene el entrypoint del paquete npm (`chango-archscope.mjs`). Resuelve flags de CLI y delega en `bootstrap/server.ts` (compilado) y en los casos de uso del modulo `architecture`.

La carpeta `bootstrap/` contiene los entrypoints que arrancan procesos reales, como el servidor HTTP. Ahi se inicializan rutas, configuracion y listeners.

La carpeta `routes/` centraliza el registro de rutas del sistema:

- `routes/api.ts`: monta las rutas API de los modulos (vacio por ahora; ningun modulo expone API bajo `/api` todavia).
- `routes/web.ts`: monta rutas web del servidor, incluyendo las rutas del core y las del modulo `architecture`.

Cada modulo backend expone sus rutas desde `presentation/routes`; `routes/api.ts` o `routes/web.ts` son quienes las cargan. Las rutas globales del framework interno se exponen desde `core/routes`.

Reglas para rutas:

- El registro central vive solo en `routes/api.ts` y `routes/web.ts`.
- El registro central solo importa archivos de rutas de modulos o rutas del `core`.
- El registro central no debe importar repositorios, base de datos, ORM, adapters ni casos de uso.
- Cada modulo expone `presentation/routes/api.ts` y/o `presentation/routes/web.ts` segun si su contrato HTTP debe vivir bajo `/api` o en la raiz.
- Los exports de rutas no deben usar prefijo `create`; usar nombres como `architectureWebRoutes`, `coreWebRoutes`.
- Las dependencias tecnicas del modulo, como el lector de sistema de archivos o la configuracion resuelta, se resuelven dentro del archivo de rutas del modulo o dentro de su composition local (ver `architectureConfigStore` para compartir la configuracion cargada por el CLI sin cambiar la firma de las factories de rutas).

## Backend: `app/modules`

El codigo modular del backend vive en:

```text
app/modules/
```

`app/modules` contiene modulos de negocio del backend (analisis de arquitectura). La configuracion vive en `config/node` y el unico `package.json` vive en la raiz.

El build de backend se genera en:

```text
build/server/
```

`build/server` es salida compilada de TypeScript. No se edita a mano. Se regenera con `npm run build:node` y es lo que consume `bin/chango-archscope.mjs` en tiempo de ejecucion.

El arranque del servidor HTTP vive en:

```text
bootstrap/server.ts
```

Estructura esperada:

```text
app/modules/
├── shared/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
└── {modulo}/
    ├── specs/
    ├── domain/
    │   ├── entities/
    │   ├── value-objects/
    │   ├── events/
    │   ├── repositories/
    │   ├── services/
    │   └── errors/
    ├── application/
    │   ├── use-cases/
    │   ├── commands/
    │   ├── queries/
    │   ├── dtos/
    │   └── ports/
    ├── infrastructure/
    │   ├── persistence/
    │   ├── repositories/
    │   ├── services/
    │   └── providers/
    └── presentation/
        ├── routes/
        │   ├── api.ts
        │   └── web.ts
        ├── http/
        │   ├── controllers/
        │   ├── requests/
        │   └── responses/
        └── cli/
```

Modulos actuales:

- `shared`: piezas transversales (conexion y migraciones SQLite, formateo de errores HTTP). `domain` y `application` estan intencionalmente vacios por ahora (solo `.gitkeep`).
- `architecture`: analizadores de arquitectura Laravel/PHP y React/TypeScript.
  - `domain/repositories/SourceTreeReader.ts`: puerto para listar directorios, recorrer archivos, leer texto y comprobar si una ruta es un archivo.
  - `domain/value-objects/`: tipos del grafo (`ArchitectureGraph`), del reporte de validacion (`ArchitectureCheckReport`), de la configuracion (`ArchitectureConfig`) y del target (`ArchitectureTarget`).
  - `domain/services/`: utilidades puras (`architecturePathUtils`, `resolveSourceFileCandidate`) sin acceso a filesystem.
  - `application/analyzers/`: `laravelAnalyzer`, `reactAnalyzer`, `phpImports`, `tsImports`, `reports`; reciben el `SourceTreeReader` como parametro en vez de importar `node:fs`.
  - `application/buildArchitectureGraph.ts` y `application/checkArchitecture.ts`: casos de uso que despachan por `target`.
  - `infrastructure/filesystem/NodeFsSourceTreeReader.ts`: implementacion real del puerto con `node:fs`.
  - `infrastructure/config/`: carga y merge de `chango-archscope.config.mjs` (`config.ts`, `defaultConfig.ts`) y el singleton `architectureConfigStore.ts` que comparte la configuracion ya resuelta por el CLI con las rutas.
  - `presentation/routes/web.ts`: expone `/graph.json` y `/check.json`.

## Core: Framework Interno

El codigo global que no pertenece a un modulo de negocio vive en:

```text
core/
```

La documentacion especifica del framework interno deberia vivir en `docs/framework/` si crece (hoy se documenta aqui mismo).

Estructura actual:

```text
core/
├── http/
│   ├── controllers/
│   ├── middleware/
│   │   └── viewMiddleware.ts
│   ├── types/
│   │   └── express.d.ts
│   └── createHttpApp.ts
├── routes/
│   └── web.ts
└── views/
    ├── renderAppLayout.ts
    ├── view.ts
    └── viteAssetManifest.ts
```

Responsabilidades de `core`:

- Crear y configurar la app HTTP (`createHttpApp`).
- Registrar middleware global, incluyendo `response.view(...)`.
- Servir archivos publicos (`public/`).
- Renderizar el layout Edge (`resources/views/layout/app.edge`).
- Cargar assets compilados de Vite desde el manifest (`public/build/.vite/manifest.json`).
- Definir rutas globales no asociadas a un modulo de negocio (hoy solo `/`).

Reglas de `core`:

- No meter logica de analisis de arquitectura.
- No depender de modulos concretos salvo para piezas transversales compartidas como manejo de errores (`app/modules/shared/presentation/http/formatHttpError.ts`).
- No guardar casos de uso del producto.
- Si algo empieza a representar un dominio, debe vivir en `app/modules/{modulo}`.

Responsabilidades del backend/CLI:

- Exponer el grafo y el reporte de validacion de arquitectura (HTTP y CLI).
- Analizar proyectos Laravel/PHP y React/TypeScript externos.
- Validar reglas de capas y acoplamiento entre modulos.
- Servir la UI React Flow que visualiza el grafo.

## Frontend: `resources/js/react`

El codigo modular del frontend vive en:

```text
resources/js/react/
```

`resources/js/react` contiene el codigo fuente del frontend, reportes, tests y codigo modular. La configuracion de Vite y TypeScript vive en `config/react`.

El build de React se genera en:

```text
public/build/
```

`public/build` es salida compilada de Vite. No se edita a mano. Se regenera con `npm run build:react`.

React no tiene un `index.html` propio en `resources/js/react`. El HTML principal lo renderiza el backend desde `resources/views/layout/app.edge`. El entry de Vite es `resources/js/react/modules/app/presentation/main.tsx`.

Estructura esperada:

```text
resources/js/react/
├── modules/
│   ├── shared/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   └── {modulo}/
│       ├── specs/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value-objects/
│       │   ├── events/
│       │   ├── services/
│       │   └── errors/
│       ├── application/
│       │   ├── use-cases/
│       │   ├── commands/
│       │   ├── queries/
│       │   ├── dtos/
│       │   └── ports/
│       ├── infrastructure/
│       │   ├── api/
│       │   ├── storage/
│       │   ├── react-flow/
│       │   └── services/
│       └── presentation/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           ├── routes/
│           └── state/
```

Modulos actuales:

- `app`: entry de Vite (`main.tsx`) y composicion de la pagina (`App.tsx`); monta `ArchitectureExplorer` con las URLs `/graph.json` y `/check.json`.
- `architecture-explorer`: dominio, casos de uso, adaptadores HTTP/React Flow y presentacion del explorador visual de arquitectura.

Responsabilidades del frontend:

- Renderizar el canvas visual con React Flow.
- Mostrar y filtrar modulos, archivos e imports del grafo de arquitectura.
- Ejecutar el chequeo de reglas de arquitectura y mostrar violaciones/acoplamientos.
- Consumir los endpoints JSON del backend.
- Mantener estado de UI.

## Vistas Server-Side

Las plantillas del servidor viven en:

```text
resources/views/
```

El flujo sigue el mismo patron que Chango Modeler, inspirado en Laravel:

- React se escribe en `resources/js/react`.
- Vite compila React hacia `public/build` usando `resources/js/react/modules/app/presentation/main.tsx` como entry y generando `public/build/.vite/manifest.json`.
- El servidor renderiza `resources/views/layout/app.edge` para toda peticion web.
- Esa plantilla carga los assets generados en `public/build` usando el manifest de Vite.

EdgeJS es la opcion usada para plantillas server-side porque encaja con el modelo mental de Blade: layouts, componentes, slots y archivos `.edge` dentro de `resources/views`.

### Layout Principal

El layout base vive en:

```text
resources/views/layout/app.edge
```

Ese archivo no define por si mismo variables como `pageContent`, `reactEntry` o `reactStyles`. Esas variables se inyectan desde el backend, en:

```text
core/views/renderAppLayout.ts
```

`renderAppLayout` funciona como el punto unico para renderizar paginas server-side con el layout principal. Hoy la unica ruta web del core (`/`) lo llama sin `view`, por lo que `pageContent` queda vacio y el layout monta React con:

```html
<div id="root"></div>
```

Si en el futuro se agregan vistas Edge especificas (por ejemplo para una pagina de ayuda o reportes), deben seguir estas reglas:

- Crear la vista dentro de `resources/views/{seccion}/{vista}.edge`.
- Registrar la ruta web en el modulo correspondiente, en `presentation/routes/web.ts`.
- Renderizarla desde controllers/handlers con `response.view("{seccion}::{vista}", datos)`.
- Usar `includeReactAssets: false` cuando la pagina no necesite montar React.
- No pasar HTML manual desde rutas; dejar que `renderAppLayout` construya `pageContent`.

## Capas

### Domain

Contiene negocio puro:

- Entidades.
- Value Objects.
- Eventos de dominio.
- Contratos de repositorio cuando pertenezcan al dominio (incluye puertos de infraestructura como `SourceTreeReader`).
- Servicios de dominio.
- Errores de dominio.

No debe usar:

- Frameworks.
- HTTP.
- Base de datos.
- Acceso directo a `node:fs` (eso vive detras del puerto `SourceTreeReader`).
- React.
- React Flow.
- DOM.
- Clientes externos.
- Estado global de UI.

### Application

Contiene casos de uso.

Responsabilidades:

- Orquestar reglas del dominio.
- Recibir DTOs, Commands o Queries.
- Usar contratos definidos en `domain` o `application/ports` (por ejemplo, recibir un `SourceTreeReader` como parametro en vez de importar la implementacion concreta).
- Retornar resultados simples o DTOs.

No debe usar controladores, componentes visuales, ORMs, fetch directo, localStorage, React hooks ni dependencias de infraestructura.

### Infrastructure

Contiene implementaciones tecnicas.

En Node.js:

- Repositorios reales.
- Persistencia (SQLite vía `better-sqlite3` + Drizzle).
- Adaptadores de sistema de archivos (`NodeFsSourceTreeReader`).
- Carga de configuracion externa (`chango-archscope.config.mjs`).
- Providers y wiring de dependencias.

En React:

- Clientes API.
- Adaptadores de React Flow.
- Persistencia local.
- Servicios tecnicos del navegador.
- Mappers entre modelos de dominio y estructuras visuales.

### Presentation

Contiene entrada y salida hacia usuarios o clientes.

En Node.js:

- Rutas HTTP.
- Controladores.
- Validadores de request.
- Serializadores de response.
- Comandos CLI (`presentation/cli`, y el propio `bin/chango-archscope.mjs` como composition root del CLI).

En React:

- Componentes.
- Paginas.
- Hooks de UI.
- Rutas.
- Estado visual.
- Layouts.

La capa `presentation` solo traduce:

```text
entrada externa -> command/query/dto -> use case -> salida externa
```

No debe contener reglas de negocio.

## Convenciones

- Un modulo no debe acceder directamente a la infraestructura interna de otro modulo.
- `shared` no debe importar modulos concretos como `architecture`.
- `app` puede componer modulos concretos y adaptadores reales.
- Si un modulo necesita algo externo, debe depender de un contrato.
- Los adaptadores tecnicos viven en `infrastructure`.
- La UI vive en `presentation`.
- React Flow vive en `resources/js/react/**/infrastructure/react-flow` o en componentes de presentation cuando sea estrictamente visual.
- Las reglas de negocio viven en `domain`.
- Los casos de uso viven en `application`.
- Las specs viven dentro del modulo que describen.
- Los tests viven en `tests/modules/{modulo}/{capa}/{tipo}` dentro de cada entorno.
- Los nombres de modulos deben ser consistentes entre backend y frontend cuando representen el mismo dominio, y siempre en minusculas (`architecture`, `shared`), nunca PascalCase.

## Tests

Los tests tambien deben seguir la estructura modular.

Backend:

```text
tests/modules/{modulo}/{capa}/{tipo}/
```

Frontend:

```text
resources/js/react/tests/modules/{modulo}/{capa}/{tipo}/
```

Regla practica:

- `domain/unit`: entidades, value objects y servicios de dominio.
- `application/unit`: casos de uso, DTOs, commands, queries y ports.
- `infrastructure/feature`: persistencia, clientes API, servicios externos y adaptadores (incluye `NodeFsSourceTreeReader`, que toca filesystem real).
- `presentation/feature`: rutas HTTP, controladores, paginas, componentes y flujos de usuario.
- `presentation/component`: componentes React aislados.

## Mutation Testing

Cada entorno debe poder ejecutar mutation testing de forma independiente. Las reglas, comandos y configuracion esperada estan documentados en `docs/development-rules.md`.
