# Chango Architecture

Standalone architecture explorer for Laravel-style PHP modules and React modules.

```bash
npm install -D chango-architecture
npx chango-architecture init
npx chango-architecture serve
```

Default paths:

- Laravel modules: `app/Modules`
- React modules: `resources/js/react/modules`
- UI server: `http://localhost:4590`

For editing the React Flow UI inside this package:

```bash
npm run serve
npm run dev:ui
```

Then open `http://localhost:4591`. Vite proxies `/graph.json` and `/check.json` to the standalone Node server.
