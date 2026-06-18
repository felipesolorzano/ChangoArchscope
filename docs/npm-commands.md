# Comandos NPM

El proyecto usa un solo **package.json** desde la raiz.

El codigo sigue separado por responsabilidad:

- Backend/CLI/API: `app/modules`, `bin`, `bootstrap` y `routes`.
- Frontend React: `resources/js/react`.

Las dependencias se instalan y resuelven desde el `node_modules` de la raiz. No se deben mantener `node_modules` dentro de `app` ni `resources/js/react`.

## Instalacion

Desde la raiz del proyecto:

```bash
npm install
```

## Backend y API

Levantar el servidor standalone:

```bash
npm run serve
```

Alias alineados con la convencion backend/frontend:

```bash
npm run dev:node
npm run start:node
```

Estos alias ejecutan el servidor con `bin/chango-archscope.mjs serve`. `dev:node` ademas corre `build:node` antes, porque el binario consume el JavaScript compilado en `build/server/`, no los `.ts` directamente.

## Frontend React

Levantar Vite:

```bash
npm run dev:react
```

Alias historico equivalente:

```bash
npm run dev:ui
```

Compilar React:

```bash
npm run build:react
```

Alias historico equivalente:

```bash
npm run build:ui
```

Previsualizar build de React:

```bash
npm run preview:react
npm run preview:ui
```

## Build

Build general:

```bash
npm run build
```

Este comando corre `build:node` y luego `build:react`.

Compilar solo el backend TypeScript:

```bash
npm run build:node
```

Genera `build/server/` a partir de `app/modules`, `core`, `bootstrap` y `routes`. `bin/chango-archscope.mjs` importa desde ahi, asi que hay que correr este comando (o `dev:node`, que lo incluye) antes de usar `serve`, `graph` o `check` localmente. El script de ciclo de vida `prepublishOnly` lo ejecuta automaticamente antes de `npm publish`.

El build de React se genera en:

```text
public/build/
```

`public/build` es generado; no editarlo manualmente.

## Analisis de Arquitectura

Generar grafo:

```bash
npm run graph -- --target laravel
npm run graph -- --target react
```

Validar reglas:

```bash
npm run check -- --target laravel
npm run check -- --target react
```

Filtrar por modulo:

```bash
npm run graph -- --target react --module architecture-explorer
npm run check -- --target react --module architecture-explorer
```

## Base De Datos

Ejecutar migraciones SQLite:

```bash
npm run db:migrate
```

Abrir Drizzle Studio:

```bash
npm run db:studio
```

La base local se crea en:

```text
database/architecture-toolkit.sqlite
```

## Tests

Toda la suite:

```bash
npm test
```

Solo backend:

```bash
npm run test:node
```

Solo frontend:

```bash
npm run test:react
```

Modo watch:

```bash
npm run test:watch:node
npm run test:watch:react
```

## Mutation Testing

Toda la suite:

```bash
npm run test:mutation
```

Solo backend:

```bash
npm run test:mutation:node
```

Solo frontend:

```bash
npm run test:mutation:react
```

Los reportes HTML se generan en:

```text
reports/mutation/node/index.html
resources/js/react/reports/mutation/index.html
```

## Pendiente

Estos comandos siguen como objetivo futuro:

- `npm run register:project`

Cuando se agregue registro de proyectos, ese comando debe implementarse en `package.json` antes de documentarse como disponible.
