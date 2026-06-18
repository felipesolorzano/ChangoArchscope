# Architecture Toolkit

Explorador y validador standalone de arquitectura para proyectos con modulos Laravel/PHP y React/TypeScript.

El paquete expone un CLI `chango-archscope`, analizadores para generar grafos de dependencias, un checker de reglas por capas, servidor Express, base SQLite/Drizzle y una UI React Flow.

## Uso

Instalar como dependencia de desarrollo:

```bash
npm install -D chango-archsocope
```

Crear la configuracion inicial:

```bash
npx chango-archscope init
```

Levantar servidor con UI y endpoints JSON:

```bash
npx chango-archscope serve
```

Por defecto queda en:

```text
http://127.0.0.1:4590
```

## Comandos

```bash
npx chango-archscope graph --target laravel
npx chango-archscope graph --target react

npx chango-archscope check --target laravel
npx chango-archscope check --target react
```

Tambien puedes filtrar por modulo:

```bash
npx chango-archscope graph --target laravel --module Users
npx chango-archscope check --target react --module billing
```

Flags disponibles:

- `--target laravel|react`
- `--module <name>`
- `--config <file>`
- `--laravel-modules <path>`
- `--react-modules <path>`
- `--port <number>`
- `--host <host>`

## Defaults

- Modulos Laravel: `app/modules`
- Namespace Laravel: `App\Modules`
- Modulos React: `resources/js/react/modules`
- Alias React: `@modules`
- Servidor: `http://127.0.0.1:4590`

El comando `init` genera `chango-archscope.config.mjs` en el proyecto actual.

## Endpoints

Con `serve` activo:

- `/graph.json?target=laravel&module=Users`
- `/graph.json?target=react&module=billing`
- `/check.json?target=laravel&module=Users`
- `/check.json?target=react&module=billing`

En `/check.json`, `fail_on_coupling=false` permite reportar acoplamientos entre modulos sin hacer fallar el resultado.

## Desarrollo de la UI

El backend esta escrito en TypeScript (`app/modules`, `core`, `bootstrap`, `routes`) y se compila a `build/server/`; el CLI (`bin/chango-archscope.mjs`) importa desde ahi, asi que hay que compilar antes de usar `serve`, `graph` o `check` dentro de este repo:

```bash
npm install
npm run build:node
npm run serve
npm run dev:react
```

`npm run dev:node` hace `build:node` y `serve` en un solo paso.

Para trabajar la UI React Flow dentro de este repo:

Luego abre:

```text
http://localhost:4591
```

Vite proxyea `/graph.json` y `/check.json` al servidor Node en `4590`.

Para compilar la UI servida por `npm run serve`:

```bash
npm run build:react
```

## Calidad y DB

```bash
npm run db:migrate
npm test
npm run test:mutation
```

Mutation testing genera reportes HTML en `reports/mutation/node` y `resources/js/react/reports/mutation`.

## Documentacion

La referencia tecnica completa esta en [`docs/overview.md`](docs/overview.md).
La metodologia de bounded contexts para crecer el repo esta en [`docs/methodology.md`](docs/methodology.md).
