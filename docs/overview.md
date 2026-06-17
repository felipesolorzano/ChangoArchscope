# Chango Archscope

Chango Archscope es una herramienta standalone para explorar y validar la arquitectura de proyectos organizados por modulos. Esta pensada principalmente para dos ecosistemas:

- Laravel/PHP con modulos bajo `app/Modules`.
- React/TypeScript con modulos bajo `resources/js/react/modules`.

El repo combina un CLI de Node, analizadores de codigo y una UI en React Flow. La estructura sigue una convencion tipo Laravel: codigo de aplicacion en `app/Modules`, entrada y bootstrap separados, configuracion en `config`, assets publicos en `public`, React en `resources`, rutas en `routes`, pruebas en `tests` y archivos runtime en `storage`.

El objetivo es convertir importaciones reales del proyecto en un grafo navegable, y ademas detectar reglas de arquitectura incumplidas como dependencias de `Domain` hacia infraestructura, UI o framework.

## Para que sirve

La herramienta ayuda a responder preguntas como:

- Que modulos existen en el proyecto.
- Que archivos pertenecen a cada modulo.
- Que archivos importan a otros archivos o modulos.
- Donde hay dependencias entre modulos.
- Si una capa rompe reglas de arquitectura definidas en la configuracion.
- Si un modulo depende directamente de otro modulo sin estar permitido.

El resultado se puede consultar de tres formas:

- Como UI web servida por el comando `serve`.
- Como JSON de grafo con el comando `graph` o el endpoint `/graph.json`.
- Como reporte de validacion con el comando `check` o el endpoint `/check.json`.

## Uso principal

Instalacion esperada como dependencia de desarrollo:

```bash
npm install -D chango-archscope
```

Crear configuracion inicial:

```bash
npx chango-archscope init
```

Levantar el servidor con UI y API:

```bash
npx chango-archscope serve
```

Por defecto el servidor queda en:

```text
http://127.0.0.1:4590
```

Generar el grafo por consola:

```bash
npx chango-archscope graph --target laravel
npx chango-archscope graph --target react
```

Validar reglas de arquitectura:

```bash
npx chango-archscope check --target laravel
npx chango-archscope check --target react
```

Tambien se puede limitar el analisis a un modulo:

```bash
npx chango-archscope graph --target laravel --module Users
npx chango-archscope check --target react --module billing
```

## Comandos del CLI

El ejecutable principal esta en `bin/chango-archscope.mjs`.

| Comando | Descripcion |
| --- | --- |
| `init` | Crea `chango-archscope.config.mjs` en el proyecto actual si no existe. |
| `serve` | Levanta el servidor HTTP que entrega la UI y los endpoints JSON. |
| `graph` | Imprime en stdout el grafo de arquitectura. |
| `check` | Imprime en stdout el reporte de validacion y usa exit code `1` si falla. |

Flags utiles:

| Flag | Uso |
| --- | --- |
| `--target laravel\|react` | Selecciona que tipo de modulos analizar. |
| `--module <name>` | Filtra el analisis a un modulo. |
| `--config <file>` | Usa un archivo de configuracion explicito. |
| `--laravel-modules <path>` | Sobrescribe la ruta de modulos Laravel. |
| `--react-modules <path>` | Sobrescribe la ruta de modulos React. |
| `--port <number>` | Cambia el puerto del servidor. |
| `--host <host>` | Cambia el host del servidor. |

## Configuracion

La configuracion por defecto vive en `app/Modules/Architecture/infrastructure/config/defaultConfig.mjs`. Si existe `chango-archscope.config.mjs`, se mezcla con los valores por defecto.

Configuracion generada por `init`:

```js
export default {
  laravel: {
    modulesPath: "app/Modules",
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

La carga de configuracion esta en `app/Modules/Architecture/infrastructure/config/config.mjs`. Ese modulo:

- Detecta automaticamente la raiz del proyecto.
- Busca `chango-archscope.config.mjs` hacia arriba desde la raiz detectada.
- Mezcla configuracion de usuario con defaults.
- Normaliza rutas relativas a rutas absolutas.

## Reglas de arquitectura

Las reglas se basan en capas. Para Laravel las capas por defecto son:

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
| `interfaces` | `Presentation` |

Cada capa puede declarar `forbiddenImports`. Una regla tiene:

- `pattern`: expresion regular aplicada al import.
- `message`: mensaje mostrado cuando se incumple.
- `suggestion`: recomendacion para corregirla.

Ejemplos de reglas incluidas:

- `Domain` no debe importar Laravel en proyectos PHP.
- `Domain` no debe depender de `Infrastructure`.
- `Application` no debe depender de `Presentation`.
- En React, `Domain` no debe depender de `react`, `infrastructure` ni `interfaces`.

## Deteccion de acoplamiento

Ademas de reglas por capa, la herramienta detecta dependencias directas entre modulos.

La configuracion `coupling` permite:

- Activar o desactivar la deteccion con `enabled`.
- Ignorar modulos compartidos con `ignoredModules`.
- Permitir dependencias concretas con `allowedDependencies`.
- Personalizar mensaje, sugerencia, evaluacion, recomendacion y accion.

Si `failOnCoupling` esta activo, los acoplamientos encontrados hacen fallar el reporte de `check`.

## Analizadores

La entrada comun esta en `app/Modules/Architecture/application/analyzers/index.mjs`:

- `buildArchitectureGraph(config, options)`
- `checkArchitecture(config, options)`

Ese modulo delega segun `target`:

| Target | Grafo | Check |
| --- | --- | --- |
| `laravel` | `buildLaravelGraph` | `checkLaravelArchitecture` |
| `react` | `buildReactGraph` | `checkReactArchitecture` |

### Laravel

El analizador esta en `app/Modules/Architecture/application/analyzers/laravelAnalyzer.mjs`.

Hace lo siguiente:

- Lista directorios dentro de `config.laravel.modulesPath`.
- Recorre archivos `.php`.
- Detecta la capa usando el primer segmento de la ruta dentro del modulo.
- Extrae imports PHP con `app/Modules/Architecture/application/analyzers/phpImports.mjs`.
- Resuelve imports que empiezan con `namespaceRoot`, por defecto `App\Modules`.
- Crea nodos de modulo, nodos de archivo y edges de tipo `contains` e `import`.
- Marca edges cross-module cuando el import apunta a otro modulo.
- Ejecuta reglas `forbiddenImports` y chequeos de `coupling`.

Tambien asigna roles visuales segun rutas conocidas, por ejemplo:

- `Application/UseCases`: caso de uso.
- `Application/Contracts`: conector.
- `Infrastructure/Persistence`: adaptador de persistencia.
- `Presentation/Http/Controllers`: controlador.
- `Domain/ValueObjects`: value object.

### React

El analizador esta en `app/Modules/Architecture/application/analyzers/reactAnalyzer.mjs`.

Hace lo siguiente:

- Lista directorios dentro de `config.react.modulesPath`.
- Recorre archivos `.ts`, `.tsx`, `.js` y `.jsx`.
- Detecta la capa usando el primer segmento del archivo dentro del modulo.
- Extrae imports con `app/Modules/Architecture/application/analyzers/tsImports.mjs`.
- Resuelve imports por alias, por defecto `@modules`.
- Resuelve imports relativos cuando apuntan dentro de la carpeta de modulos.
- Crea nodos y edges equivalentes a Laravel.
- Ejecuta reglas `forbiddenImports` y chequeos de `coupling`.

Roles visuales comunes:

- `application/use-cases`: caso de uso.
- `application/contracts`: conector.
- `application/dtos`: DTO.
- `domain/value-objects`: value object.
- `infrastructure/api`: adaptador API.
- `infrastructure/react-flow`: React Flow.
- `interfaces/components`: componente UI.
- `interfaces/pages`: pagina.
- `interfaces/hooks`: hook UI.

## Servidor HTTP

El servidor esta en `bootstrap/server.mjs`. Es un servidor HTTP nativo de Node.
Las rutas HTTP propias del modulo Architecture estan en `app/Modules/Architecture/presentation/routes/api.mjs`.

Endpoints principales:

| Endpoint | Descripcion |
| --- | --- |
| `/graph.json?target=laravel&module=Users` | Devuelve el grafo de arquitectura. |
| `/check.json?target=react&module=billing` | Devuelve el reporte de validacion. |
| `/` | Sirve la UI compilada desde `public/build`. |

Si `public/build` no existe, el servidor muestra una pagina simple indicando que la API esta corriendo y que hay que compilar la UI con `npm run build:ui`.

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

Cada nodo representa un modulo o archivo:

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

Cada edge representa contencion o importacion:

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

- `passed`: si el modulo paso la validacion.
- `files_scanned`: cantidad de archivos analizados.
- `violations`: reglas de capas incumplidas.
- `couplings`: dependencias directas entre modulos.

## UI

La UI esta en `resources/js/react/modules/architecture-explorer` y usa React con `@xyflow/react`.

Estructura relevante:

| Ruta | Responsabilidad |
| --- | --- |
| `resources/js/react/modules/architecture-explorer/interfaces/main.tsx` | Punto de entrada de React. |
| `resources/js/react/modules/architecture-explorer/interfaces/pages/ArchitectureExplorer.tsx` | Pantalla principal del explorador. |
| `resources/js/react/modules/architecture-explorer/interfaces/components/ArchitectureSidebar.tsx` | Filtros, seleccion de target/modulo/capa y acciones. |
| `resources/js/react/modules/architecture-explorer/interfaces/components/ArchitectureCanvas.tsx` | Lienzo del grafo. |
| `resources/js/react/modules/architecture-explorer/interfaces/components/ArchitectureCheckModal.tsx` | Modal con resultados de validacion. |
| `resources/js/react/modules/architecture-explorer/infrastructure/react-flow/*` | Adaptadores y layout para React Flow. |
| `resources/js/react/modules/architecture-explorer/infrastructure/api/*` | Providers HTTP para consumir `/graph.json` y `/check.json`. |
| `resources/js/react/modules/architecture-explorer/application/*` | Casos de uso, contratos y DTOs. |
| `resources/js/react/modules/architecture-explorer/domain/*` | Value objects del dominio de la UI. |

Para desarrollo de la UI dentro de este repo:

```bash
npm install
npm run serve
npm run dev:ui
```

Luego abrir:

```text
http://localhost:4591
```

Vite proxyea `/graph.json` y `/check.json` al servidor Node standalone.

En desarrollo hay dos procesos:

- `npm run serve` levanta la API y la UI compilada en `http://127.0.0.1:4590`.
- `npm run dev:ui` levanta Vite en `http://localhost:4591` y usa proxy hacia `4590`.

Para produccion o uso empaquetado, compilar la UI genera archivos en `public/build`:

```bash
npm run build:ui
```

## Estructura del repo

```text
bin/
  chango-archscope.mjs        CLI principal
bootstrap/
  .gitkeep                    Punto reservado para bootstrap estilo Laravel
app/Modules/Architecture/
  domain/                     Capa de dominio del modulo Architecture
  application/analyzers/      Analizadores Laravel y React
  infrastructure/config/      Carga, normalizacion y defaults
  infrastructure/http/        Servidor HTTP standalone
  presentation/               Punto reservado para entrada/presentacion Node
config/
  react/
    vite.config.mjs           Configuracion Vite de la UI
    tsconfig.json             TypeScript de la UI React
public/
  build/                      UI compilada para servir en produccion
resources/js/react/
  index.html                  HTML base de Vite
  modules/architecture-explorer/
    domain/                   Modelo de dominio de la UI
    application/              Casos de uso, contratos y DTOs
    infrastructure/           API HTTP y React Flow
    interfaces/               Pagina, componentes, hooks y estilos
routes/
  .gitkeep                    Punto reservado para rutas estilo Laravel
storage/
  framework/                  Archivos runtime del framework/aplicacion
  logs/                       Logs locales
tests/
  .gitkeep                    Punto reservado para pruebas
```

## Flujo interno

1. El usuario ejecuta el CLI.
2. El CLI carga configuracion con `loadConfig`.
3. Segun el comando, llama al servidor, al generador de grafo o al checker.
4. El analizador elegido recorre archivos del target.
5. Se extraen imports y se resuelven referencias internas entre modulos.
6. Se generan nodos, edges y resumen.
7. Si es `check`, tambien se generan violations y couplings.
8. La UI consume los endpoints JSON y renderiza el mapa interactivo.

## Paquete npm

El `package.json` declara:

- Nombre actual del paquete: `chango-archsocope`.
- Binario: `chango-archscope`.
- Node requerido: `>=18.18`.
- Scripts principales:
  - `npm run serve`
  - `npm run graph`
  - `npm run check`
  - `npm run dev:ui`
  - `npm run build:ui`
  - `npm run preview:ui`

Nota: el README menciona `chango-architecture`, mientras que el `package.json` actual declara `chango-archsocope` y el binario `chango-archscope`. Conviene alinear esos nombres antes de publicar o documentar instalacion definitiva.
