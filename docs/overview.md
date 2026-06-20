# Referencia Tecnica

Esta herramienta standalone permite explorar y validar arquitectura en proyectos organizados por modulos. Actualmente soporta dos targets:

- Laravel/PHP con modulos bajo `app/modules`.
- React/TypeScript con modulos bajo `resources/js/react/modules`.

El repo contiene un CLI de Node, analizadores de imports, un servidor Express, persistencia SQLite/Drizzle, tests, mutation testing y una UI React Flow. El objetivo es convertir dependencias reales del codigo en un grafo navegable y detectar reglas de arquitectura incumplidas, especialmente dependencias indebidas entre capas o acoplamientos directos entre modulos.

La metodologia propuesta para crecer este repo por bounded contexts esta documentada en [`methodology.md`](methodology.md).

## Estado actual

El paquete declara:

- Nombre npm actual: `chango-archsocope`.
- Binario: `chango-archscope`.
- Node requerido: `>=18.18`.
- UI: React 18, Vite y `@xyflow/react`.

Scripts disponibles:

| Script | Descripcion |
| --- | --- |
| `npm run serve` | Ejecuta `node ./bin/chango-archscope.mjs serve`. |
| `npm run graph` | Ejecuta el comando `graph` del CLI. |
| `npm run check` | Ejecuta el comando `check` del CLI. |
| `npm run build:node` | Compila `app/modules`, `core`, `bootstrap` y `routes` (TypeScript) hacia `build/server/`. Requerido antes de `serve`/`graph`/`check` locales. |
| `npm run dev:node` | Corre `build:node` y luego `serve`. |
| `npm run start:node` | Alias de `serve` (asume que `build/server` ya existe). |
| `npm run dev:react` | Levanta Vite en modo desarrollo. |
| `npm run build:react` | Compila la UI con Vite. |
| `npm run preview:react` | Sirve el build de Vite para previsualizacion. |
| `npm run dev:ui` | Alias historico de `dev:react`. |
| `npm run build:ui` | Alias historico de `build:react`. |
| `npm test` | Ejecuta tests backend y frontend con Vitest. |
| `npm run test:mutation` | Ejecuta mutation testing backend y frontend con Stryker. |
| `npm run db:migrate` | Crea/actualiza la base SQLite local (corre el CLI de migraciones con `tsx`, sin build previo). |

Nota de publicacion: el nombre npm actual contiene `archsocope`; el binario usa `archscope`.

## Para que sirve

La herramienta ayuda a responder:

- Que modulos existen en el proyecto.
- Que archivos pertenecen a cada modulo.
- Que archivos importan a otros archivos o modulos.
- Donde hay dependencias entre modulos.
- Si una capa rompe reglas de arquitectura definidas en la configuracion.
- Si un modulo depende directamente de otro modulo sin estar permitido.

El resultado se puede consultar de tres formas:

- UI web servida por `serve`.
- JSON de grafo con `graph` o `/graph.json`.
- Reporte de validacion con `check` o `/check.json`.

## Uso principal

Instalar como dependencia de desarrollo:

```bash
npm install -D chango-archsocope
```

Crear configuracion inicial:

```bash
npx chango-archscope init
```

Levantar servidor con UI y API:

```bash
npx chango-archscope serve
```

Por defecto:

```text
http://127.0.0.1:4590
```

Generar grafo por consola:

```bash
npx chango-archscope graph --target laravel
npx chango-archscope graph --target react
```

Validar reglas de arquitectura:

```bash
npx chango-archscope check --target laravel
npx chango-archscope check --target react
```

Filtrar por modulo:

```bash
npx chango-archscope graph --target laravel --module Users
npx chango-archscope check --target react --module billing
```

## CLI

El ejecutable principal esta en `bin/chango-archscope.mjs`.

| Comando | Descripcion |
| --- | --- |
| `init` | Crea `chango-archscope.config.mjs` en el proyecto actual si no existe. |
| `serve` | Levanta el servidor HTTP que entrega la UI y los endpoints JSON. |
| `graph` | Imprime en stdout el grafo de arquitectura. |
| `check` | Imprime en stdout el reporte de validacion y usa exit code `1` si falla. |

Flags disponibles:

| Flag | Uso |
| --- | --- |
| `--target laravel\|react` | Selecciona el target a analizar. |
| `--module <name>` | Filtra el analisis a un modulo. En Laravel normaliza a formato Studly; en React compara sin distinguir mayusculas. |
| `--config <file>` | Usa un archivo de configuracion explicito. |
| `--laravel-modules <path>` | Sobrescribe la ruta de modulos Laravel. |
| `--react-modules <path>` | Sobrescribe la ruta de modulos React. |
| `--port <number>` | Cambia el puerto del servidor. |
| `--host <host>` | Cambia el host del servidor. |
| `--fail-on-coupling false` | En `check`, reporta acoplamientos sin hacer fallar el resultado. |

## Configuracion

La configuracion por defecto vive en `app/modules/architecture/infrastructure/config/defaultConfig.ts`.

Si existe `chango-archscope.config.mjs`, se mezcla con los defaults. La carga esta en `app/modules/architecture/infrastructure/config/config.ts` y hace lo siguiente:

- Detecta la raiz del proyecto.
- Busca `chango-archscope.config.mjs` hacia arriba desde la raiz detectada.
- Mezcla configuracion de usuario con defaults.
- Normaliza rutas relativas a rutas absolutas.

Configuracion generada por `init`:

```js
export default {
  laravel: {
    modulesPath: "app/modules",
    namespaceRoot: "App\\Modules",
  },
  react: {
    modulesPath: "resources/js/react/modules",
    alias: "@modules",
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};
```

Defaults relevantes:

| Target | Default |
| --- | --- |
| Laravel modules | `app/modules` |
| Laravel namespace root | `App\Modules` |
| Laravel `phpExtensions` | `[".php"]` |
| Laravel `ignoredPaths` | `["**/README.md"]` |
| React modules | `resources/js/react/modules` |
| React alias | `@modules` |
| React `ignoredPaths` | `[]` |
| Server host | `127.0.0.1` |
| Server port | `4590` |

### Extensiones de archivo y exclusion de carpetas

`phpExtensions` (solo Laravel) define las extensiones que se recorren dentro de cada
modulo. El emparejamiento es **por sufijo del nombre de archivo**, por lo que admite
extensiones compuestas: `".inc"` incluye `foo.inc` y `foo.lib.inc`, mientras que
`".lib.inc"` incluye solo `foo.lib.inc`. Util para proyectos PHP legacy con `.inc` o
`.lib.inc`.

`ignoredPaths` (Laravel y React) es una lista de **patrones glob** (minimatch, relativos
al `modulesPath` de cada modulo) para excluir carpetas o archivos del escaneo. Aplica al
grafo, al `check` y al `audit`. Una carpeta cuyo path coincide con un patron se poda sin
descender en ella. Ejemplos: `"**/vendor/**"`, `"**/__tests__/**"`, `"**/*.test.php"`.

```js
export default {
  laravel: {
    modulesPath: "app/modules",
    namespaceRoot: "App\\Modules",
    phpExtensions: [".php", ".inc", ".lib.inc"],
    ignoredPaths: ["**/README.md", "**/vendor/**"],
  },
  react: {
    modulesPath: "resources/js/react/modules",
    alias: "@modules",
    ignoredPaths: ["**/__tests__/**", "**/*.test.*"],
  },
};
```

## Reglas de arquitectura

Las reglas se basan en capas.

Para Laravel las capas por defecto son:

- `Domain`
- `Application`
- `Presentation`
- `Infrastructure`

Para React, los directorios se mapean a capas:

| Directorio | Capa |
| --- | --- |
| `domain` | `Domain` |
| `application` | `Application` |
| `contracts` | `Application` |
| `infrastructure` | `Infrastructure` |
| `presentation` | `Presentation` |

Cada capa puede declarar `forbiddenImports`. Una regla tiene:

- `pattern`: expresion regular aplicada al import.
- `message`: mensaje mostrado cuando se incumple.
- `suggestion`: recomendacion para corregirla.

Reglas incluidas:

- En Laravel, `Domain` no debe importar `Illuminate`, `Infrastructure` ni `Presentation`.
- En Laravel, `Application` no debe importar `Infrastructure` ni `Presentation`.
- En Laravel, `Presentation` no debe consultar modelos bajo `Infrastructure/Persistence/Eloquent` directamente.
- En React, `Domain` no debe depender de `react`, `infrastructure` ni `presentation`.
- En React, `Application` no debe depender de `infrastructure` ni `presentation`.

## Deteccion de acoplamiento

Ademas de reglas por capa, la herramienta detecta dependencias directas entre modulos cuando un import interno apunta a otro modulo.

La configuracion `coupling` permite:

- Activar o desactivar deteccion con `enabled`.
- Ignorar modulos con `ignoredModules`.
- Permitir dependencias concretas con `allowedDependencies`.
- Personalizar mensaje, sugerencia, evaluacion, recomendacion y accion.

En Laravel, `Shared` esta ignorado por defecto (es el nombre de modulo Laravel convencional para codigo compartido en el proyecto analizado, no el `shared` propio de Chango Archscope). En React, no hay modulos ignorados por defecto.

Si `failOnCoupling` esta activo, los acoplamientos encontrados hacen fallar el reporte de `check`. En CLI se desactiva con `--fail-on-coupling false`; en HTTP se desactiva con `fail_on_coupling=false`.

## Analizadores

La entrada comun son los casos de uso `app/modules/architecture/application/buildArchitectureGraph.ts` y `app/modules/architecture/application/checkArchitecture.ts`:

- `buildArchitectureGraph(config, reader, options)`
- `checkArchitecture(config, reader, options)`

`reader` implementa el puerto de dominio `SourceTreeReader` (`listDirectories`, `walkFiles`, `readText`, `isFile`), definido en `app/modules/shared/domain/repositories`; la implementacion real con `node:fs` es `NodeFsSourceTreeReader` (`app/modules/shared/infrastructure/filesystem`). Esto mantiene `domain` y `application` sin tocar el sistema de archivos directamente.

Estos casos de uso delegan segun `target`:

| Target | Grafo | Check |
| --- | --- | --- |
| `laravel` | `buildLaravelGraph` | `checkLaravelArchitecture` |
| `react` | `buildReactGraph` | `checkReactArchitecture` |

### Laravel

El analizador esta en `app/modules/architecture/application/analyzers/laravelAnalyzer.ts`.

Hace lo siguiente:

- Lista directorios dentro de `config.laravel.modulesPath` (via `reader.listDirectories`).
- Recorre archivos `.php` (via `reader.walkFiles`).
- Detecta la capa usando el primer segmento de la ruta dentro del modulo.
- Extrae imports PHP con `phpImports.ts`.
- Resuelve imports que empiezan con `namespaceRoot`, por defecto `App\Modules`.
- Crea nodos de modulo, nodos de archivo y edges `contains` e `import`.
- Marca edges cross-module cuando el import apunta a otro modulo.
- Ejecuta reglas `forbiddenImports` y chequeos de `coupling`.

Roles visuales detectados:

| Ruta | Rol |
| --- | --- |
| `Application/UseCases` | `use_case` |
| `Application/Contracts` o `Application/Repositories` | `connector` |
| `Infrastructure/Providers` | `provider` |
| `Infrastructure/Persistence` | `persistence_adapter` |
| `Infrastructure` | `adapter` |
| `Presentation/Http/Controllers` | `controller` |
| `Domain/ValueObjects` | `value_object` |

### React

El analizador esta en `app/modules/architecture/application/analyzers/reactAnalyzer.ts`.

Hace lo siguiente:

- Lista directorios dentro de `config.react.modulesPath` (via `reader.listDirectories`).
- Recorre archivos `.ts`, `.tsx`, `.js` y `.jsx` (via `reader.walkFiles`).
- Detecta la capa usando el primer segmento de la ruta dentro del modulo.
- Extrae imports con `tsImports.ts`.
- Resuelve imports por alias, por defecto `@modules`.
- Resuelve imports relativos cuando apuntan dentro de la carpeta de modulos.
- Crea nodos y edges equivalentes a Laravel.
- Ejecuta reglas `forbiddenImports` y chequeos de `coupling`.

Roles visuales detectados:

| Ruta | Rol |
| --- | --- |
| `application/use-cases` | `use_case` |
| `application/contracts` o `contracts` | `connector` |
| `application/dtos` | `dto` |
| `domain/value-objects` | `value_object` |
| `infrastructure/api` | `adapter` |
| `infrastructure/react-flow` | `adapter` |
| `presentation/components` | `ui_component` |
| `presentation/pages` | `page` |
| `presentation/hooks` | `hook` |

## Servidor HTTP

El servidor esta en `bootstrap/server.ts` y usa Express a traves de `core/http/createHttpApp.ts` (el mismo framework interno que usa Chango Modeler): body parsing JSON, archivos estaticos de `public/`, el middleware `response.view(...)` y un error handler centralizado.

El registro central de rutas vive en `routes/web.ts` y `routes/api.ts`. Las rutas del modulo `architecture` (`/graph.json`, `/check.json`) y las del modulo `audit` (`auditApiRoutes` en `app/modules/audit/presentation/routes/api.ts`, endpoint `/audit.json`) se montan desde `routes/web.ts` (no `routes/api.ts`), para que respondan en la raiz en vez de bajo el prefijo `/api`. La ruta `/` viene de `core/routes/web.ts` y renderiza `resources/views/layout/app.edge` con Edge.js, inyectando el entry de React desde el manifest de Vite.

Endpoints:

| Endpoint | Descripcion |
| --- | --- |
| `/graph.json?target=laravel&module=Users` | Devuelve el grafo de arquitectura. |
| `/graph.json?target=react&module=billing` | Devuelve el grafo de arquitectura React. |
| `/check.json?target=laravel&module=Users` | Devuelve el reporte de validacion. |
| `/check.json?target=react&module=billing&fail_on_coupling=false` | Devuelve el reporte sin fallar por acoplamiento. |
| `/audit.json?target=laravel&module=Users` | Devuelve el `AuditSnapshot` completo (findings de arquitectura + nativos PHP + `summary` + `riskScore` + `riskBreakdown`). Ver `app/modules/audit/specs/audit-api.md`. |
| `/` | Renderiza el layout Edge que monta la UI React compilada en `public/build`. |

`npm run build:react` debe haberse ejecutado al menos una vez para que exista `public/build/.vite/manifest.json`; si no existe, `/` responde con un error 400 (a diferencia de la version anterior, que mostraba una pagina de aviso). Esto es intencional para mantener la misma mecanica que `core/views/viteAssetManifest.ts` usa en Chango Modeler.

## Formato del grafo

El grafo tiene esta forma general:

```json
{
  "generated_at": "2026-01-01T00:00:00.000Z",
  "summary": {
    "modules": 1,
    "nodes": 10,
    "edges": 12,
    "cross_module_edges": 2
  },
  "nodes": [],
  "edges": []
}
```

Nodo de archivo:

```json
{
  "id": "file:Users/Application/UseCases/CreateUser.php",
  "type": "file",
  "label": "CreateUser.php",
  "module": "Users",
  "layer": "Application",
  "path": "Users/Application/UseCases/CreateUser.php",
  "role": "use_case",
  "role_label": "Caso de uso"
}
```

Edge de import:

```json
{
  "id": "imports:...",
  "source": "file:...",
  "target": "file:...",
  "type": "import",
  "label": "SomeClass",
  "import": "App\\Modules\\Other\\Domain\\SomeClass",
  "line": 7,
  "crossModule": true
}
```

## Formato del reporte de check

El reporte tiene esta forma general:

```json
{
  "checked_at": "2026-01-01T00:00:00.000Z",
  "target": "laravel",
  "module": null,
  "fail_on_coupling": true,
  "passed": false,
  "summary": {
    "modules": 2,
    "files_scanned": 30,
    "violations_count": 1,
    "couplings_count": 3
  },
  "reports": []
}
```

Cada reporte por modulo incluye:

- `module`
- `module_path`
- `passed`
- `files_scanned`
- `violations_count`
- `couplings_count`
- `violations`
- `couplings`

Cada issue incluye `module`, `layer`, `file`, `line`, `import`, `message` y `suggestion`. Los issues de acoplamiento tambien pueden incluir `target_module`, `assessment`, `recommendation` y `action`.

## UI

La UI esta repartida en dos modulos React: `app` (entry point y composicion de pagina) y `architecture-explorer` (el explorador en si), y usa React con `@xyflow/react`.

Estructura relevante:

| Ruta | Responsabilidad |
| --- | --- |
| `resources/js/react/modules/app/presentation/main.tsx` | Punto de entrada de Vite; monta `App` en `#root` (el `div` que renderiza `resources/views/layout/app.edge`). |
| `resources/js/react/modules/app/presentation/App.tsx` | Compone `ArchitectureExplorer` con las dependencias HTTP apuntando a `/graph.json` y `/check.json`. |
| `resources/js/react/modules/architecture-explorer/presentation/pages/ArchitectureExplorer.tsx` | Pantalla principal del explorador. |
| `resources/js/react/modules/architecture-explorer/presentation/components/ArchitectureSidebar.tsx` | Filtros, seleccion de target/modulo/capa y acciones. |
| `resources/js/react/modules/architecture-explorer/presentation/components/ArchitectureCanvas.tsx` | Lienzo del grafo. |
| `resources/js/react/modules/architecture-explorer/presentation/components/ArchitectureCheckModal.tsx` | Modal con resultados de validacion. |
| `resources/js/react/modules/architecture-explorer/presentation/hooks/*` | Controladores de estado de grafo y check. |
| `resources/js/react/modules/architecture-explorer/infrastructure/react-flow/*` | Adaptadores, layout y fallback para React Flow. |
| `resources/js/react/modules/architecture-explorer/infrastructure/api/*` | Providers HTTP para consumir `/graph.json` y `/check.json`. |
| `resources/js/react/modules/architecture-explorer/application/*` | Casos de uso, contratos y DTOs. |
| `resources/js/react/modules/architecture-explorer/domain/*` | Value objects del dominio de la UI. |

Para desarrollo de la UI dentro de este repo:

```bash
npm install
npm run serve
npm run dev:react
```

Luego abrir:

```text
http://localhost:4591
```

En desarrollo hay dos procesos:

- `npm run serve` (requiere `build:node` previo) levanta la API y renderiza el layout Edge con la UI compilada en `http://127.0.0.1:4590`.
- `npm run dev:react` levanta Vite en `http://localhost:4591` y usa proxy hacia `4590` para `/graph.json` y `/check.json`.

Para generar los archivos que sirve el servidor standalone:

```bash
npm run build:react
```

## Estructura del repo actual

```text
app/modules/architecture/
  domain/                      Value objects de arquitectura (grafo, reporte, config, target)
  application/analyzers/       Analizadores Laravel y React (reciben el reader)
  infrastructure/config/       Defaults y carga de configuracion
  presentation/routes/web.ts   Rutas /graph.json y /check.json
app/modules/shared/
  domain/repositories/         Puerto SourceTreeReader
  infrastructure/filesystem/   NodeFsSourceTreeReader (implementacion real)
  infrastructure/persistence/sqlite/   Conexion, drizzle, migraciones
  presentation/http/           formatHttpError
  presentation/cli/            CLI de migraciones
app/modules/audit/              Diagnostico (AuditSnapshot) sobre architecture + analizadores PHP nativos, ver docs/audit.md
core/
  http/createHttpApp.ts        Framework interno HTTP (igual que Chango Modeler)
  views/                       renderAppLayout, view, viteAssetManifest
  routes/web.ts                Ruta "/" (layout Edge)
bin/
  chango-archscope.mjs         CLI principal (importa desde build/server)
bootstrap/
  server.ts                    Servidor HTTP (createHttpApp + config store)
build/server/                  Salida compilada de TypeScript (generada)
config/node/
  tsconfig.json, vitest.config.ts, stryker.conf.json
config/react/
  vite.config.mjs              Configuracion Vite de la UI
  tsconfig.json                TypeScript de la UI React
resources/views/layout/app.edge  Layout Edge que monta la UI o vistas server-side
resources/js/react/
  modules/app/                 Entry de Vite (main.tsx, App.tsx)
  modules/architecture-explorer/
    domain/                    Value objects de la UI
    application/               Casos de uso, contratos y DTOs
    infrastructure/            API HTTP y React Flow
    presentation/               Pagina, componentes, hooks y estilos
routes/
  web.ts                       Rutas web raiz (core + architecture)
  api.ts                       Rutas API raiz (vacio por ahora)
```

`build/server/` y `public/build/` no estan versionados; son salida generada de `npm run build:node` y `npm run build:react` respectivamente.

## Flujo interno

1. El usuario ejecuta el CLI.
2. El CLI carga configuracion con `loadConfig`.
3. Segun el comando, llama al servidor, al generador de grafo o al checker.
4. El analizador elegido recorre archivos del target.
5. Se extraen imports y se resuelven referencias internas entre modulos.
6. Se generan nodos, edges y resumen.
7. Si es `check`, tambien se generan violations y couplings.
8. La UI consume los endpoints JSON y renderiza el mapa interactivo.
