# Stack Tecnico

El proyecto se desarrollara con dos entornos separados: uno para backend y otro para frontend.

La administracion de dependencias se hace con un solo **package.json** desde la raiz del proyecto. El `node_modules` debe quedar centralizado en la raiz.

## Backend

El backend usa **Node.js**, **TypeScript** y **Express**.

Ruta base:

```text
app/modules/
core/
bootstrap/
routes/
bin/
```

`app` contiene el codigo modular del backend en `app/modules`. `core` contiene el framework interno (HTTP app factory, vistas Edge). La configuracion de TypeScript, Vitest y Stryker del backend vive en `config/node`.

Herramientas principales:

- **Node.js**: runtime del backend. `engines.node` declara `>=18.18` para mantener compatibilidad con proyectos consumidores del CLI.
- **TypeScript**: todo `app/modules`, `core`, `bootstrap` y `routes` esta en `.ts`, compilado con `tsc -p config/node/tsconfig.json` hacia `build/server/`.
- **tsx**: ejecuta TypeScript directamente en desarrollo (`db:migrate`) sin paso de build previo.
- **Express**: servidor HTTP, ensamblado por `core/http/createHttpApp.ts`.
- **Edge.js**: motor de plantillas server-side (estilo Blade) para `resources/views/layout/app.edge`.
- **SQLite** (`better-sqlite3`): persistencia local.
- **Drizzle ORM**: cliente tipado sobre SQLite (`drizzle-orm/better-sqlite3`).
- **Vitest**: runner de tests para backend y frontend.
- **StrykerJS**: mutation testing para validar fuerza de tests.

El binario publicado (`bin/chango-archscope.mjs`) no ejecuta TypeScript directamente: importa el JavaScript compilado en `build/server/`. El script de ciclo de vida `prepublishOnly` ejecuta `build:node` para garantizar que el paquete publicado incluya ese build.

Cualquier framework HTTP debe vivir en la capa `presentation` o en adaptadores de entrada. No debe filtrarse hacia `domain` ni `application`. El acceso a `node:fs` para analizar proyectos externos esta detras del puerto `SourceTreeReader` (`domain`), implementado en `infrastructure/filesystem/NodeFsSourceTreeReader.ts`.

## Frontend

El frontend usara **React**.

Ruta base:

```text
resources/js/react/
```

`resources/js/react` contiene el frontend y el codigo modular. La configuracion de Vite y TypeScript vive en `config/react`.

Herramientas principales:

- **React**: libreria principal para construir la interfaz.
- **React Flow**: base del canvas visual para nodos, conexiones, tablas y relaciones.
- **Vite**: dev server y build del frontend.
- **Vitest**: runner principal de tests para logica, casos de uso, mappers, stores y componentes.
- **StrykerJS**: herramienta de mutation testing para validar que los tests detecten cambios incorrectos.

React y React Flow deben vivir en `presentation` o en adaptadores especificos de UI. No deben filtrarse hacia `domain` ni `application`.

## Documentacion Relacionada

- Arquitectura, capas y estructura: `docs/project-architecture.md`.
- Referencia tecnica y CLI: `docs/overview.md`.
- Comandos npm, tests y mutation testing dirigido: `docs/npm-commands.md`.
- Metodologia de crecimiento por bounded contexts: `docs/methodology.md`.
- Flujo de trabajo, tests y mutation testing: `docs/development-rules.md`.
