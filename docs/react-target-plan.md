# Plan — Target React de punta a punta (ChangoArchscope)

> Documento de plan. Describe QUE construir y en que orden para que el target `react` calcule lo
> mismo que hoy calcula `laravel` en las cinco pestañas (Arquitectura, Auditoria, Plan, Migracion,
> Diseño). Sigue `docs/development-rules.md` (SDD → TDD → DDD → hexagonal → mutation).

## 0. Contexto

Caso de uso real que guia el trabajo: un frontend React legacy (Create React App) configurado
via `react.modulesPath` absoluto en `chango-archscope.config.mjs`. Rasgos del proyecto:

- ~260 archivos `.js` (JSX dentro de `.js`), ~70k lineas; sin TypeScript.
- Carpetas tecnicas planas en la raiz (`components/`, `pages/`, `globals/`, `configs/`, ...), sin
  capas hexagonales.
- Componentes de clase que heredan de una base comun (`class X extends Global`).
- jQuery (`window.$`) mezclado con React; `dangerouslySetInnerHTML`.
- Archivos de 2000–3000 lineas y copias manuales (`page.checkout - copia (4).js`, `*.devel.js`,
  `*.2.js`).

## 1. Estado de partida (medido sobre el proyecto real)

| Pestaña | `target=react` hoy | Causa |
|---|---|---|
| Arquitectura | Grafo OK; check con 0 violaciones / 0 acoplamientos | Ningun archivo cae en una capa y el check ignora archivos sin capa |
| Auditoria | 0 findings | No hay parser ni analizadores nativos para JS |
| Plan | 0 tareas | `TASK_RULES` solo mapea reglas PHP |
| Migracion / Diseño | `bounded-context-source` devuelve `files: []` | Rama react stubbeada; el front fija `laravel`/`design` |
| UI | Solo Arquitectura tiene selector de target | Auditoria/Plan/Migracion/Diseño piden siempre `laravel` |

## 2. Fases

| Fase | Entrega | Estado |
|---|---|---|
| **F1 Target global** | Selector Laravel/React en el shell (persistido en la URL `?target=`), propagado a las 5 pestañas; `bounded-context-source` real para React; mapas `react` / `react-design` | Completa |
| **F2 Parser JS** | Puerto `JsSourceParser` + adaptador `BabelJsParser` (`@babel/parser`, JSX/TS) + `scanJsFiles`. Spec: `app/modules/audit/specs/js-source-parser.md` | Completa |
| **F3 Analizadores React** | 6 analizadores JS + integracion en `auditProject`, HTTP y CLI. Spec: `app/modules/audit/specs/react-analyzers.md` | Completa |
| **F4 Auditoria generalizada** | `phpRoot` → `sourceRoot` en snapshot/grafo (drill app/file/heatmap para React); acento `api_access` + categorias por stack en filtro/leyenda (`auditCategoriesFor`); snapshot cache + fingerprint para React. Specs: `audit-graph.md`, `audit-snapshot-cache.md`, `audit-explorer.md` | Completa |
| **F5 Plan React** | 8 tareas nuevas derivadas de reglas React; selectores `{ rule, severities? }` como fuente unica de metrica y hallazgos; estado del plan por target (migracion 005). Spec: `app/modules/plan/specs/plan-tasks.md` | Completa |
| **F6 Arquitectura legacy** | Mapeo carpeta→rol para arboles sin capas, para que el check de capas/acoplamiento de señal | Pendiente |

Decisiones tomadas:

- Parser: **`@babel/parser`** (dependencia runtime nueva, JS puro). Mismo patron que `php-parser`:
  puerto en `audit/domain/repositories`, adaptador en `audit/infrastructure/parser`.
- Orden: F1 primero (desbloquea que un agente arme el mapa de bounded contexts del proyecto React
  mientras se construyen los analizadores).
- Los mapas de Laravel conservan sus targets historicos (`laravel`, `design`) para no perder lo ya
  persistido; React usa `react` y `react-design`.

### F2 — validacion contra el proyecto real

`scanJsFiles` + `BabelJsParser` sobre los 259 archivos: 0 fallas de parseo, ~0.5s. Extrae:

- 156 clases (150 `extends Global`), `render` de hasta 1219 lineas, estado de hasta 36 claves.
- 105 `dangerouslySetInnerHTML`, 8 asignaciones a `innerHTML`.
- 514 accesos jQuery, 152 a `window`, 59 a `document`.
- 97 llamadas HTTP; 82 de 88 llamadas a la base `Crud` resueltas a su endpoint (las opciones suelen
  armarse en `var options = {…}` antes de `this.single(options)`). Endpoints como
  `doBancomerPaymentV2` aparecen en 8 archivos (las copias del checkout).

Limitacion conocida: las 6 llamadas `crud` restantes arman las opciones de otra forma (reasignacion
de propiedades, funciones auxiliares) y quedan sin registrar.

## 3. Categorias de finding para React (F3)

Detalle, umbrales y severidades en `app/modules/audit/specs/react-analyzers.md`.

| Categoria | Reglas |
|---|---|
| `complexity` | `long-method` (>50), `long-render` (>150), `too-many-parameters`, `high-cyclomatic-complexity` (>10), `large-component` (>300), `large-class`, `large-state` (>10 claves) |
| `coupling_low_level` | `jquery-usage`, `direct-dom-access`, `global-window-access` (agregados por archivo), `base-class-inheritance` |
| `dead_code` | `possibly-unused-file` (resuelve imports estaticos y `require` dinamicos con template), `manual-copy-file` |
| `security` | `eval-usage`, `new-function`, `dangerously-set-inner-html`, `inner-html-assignment` |
| `api_access` (nueva) | `http-in-component`, `hardcoded-api-url`, `duplicate-endpoint` |
| `testing` | `untested-component` (high si complejidad >10) |

Calibracion de umbrales con el proyecto real: el umbral PHP de 30 lineas marcaba 409 metodos (el
JSX infla); 50 lineas = p90 de metodos sin render; render tiene su propio umbral (p75 = 169).

### F3 — validacion contra el proyecto real

`/audit.json?target=react`: 1135 findings en ~0.7s — complexity 338, coupling_low_level 325,
testing 165, api_access 137, security 113, dead_code 57. Archivo mas riesgoso: `page.checkout.js`,
seguido de su copia `page.checkout - copia (4).js`.

- `possibly-unused-file` bajo de 103 a 39 al resolver `require(`./config.${…}`)` (las 64 configs
  de marca se cargan dinamicamente). Los 39 restantes son copias, `_old`, demos y sitemaps; estos
  ultimos los ejecuta `scripts/sitemap.js`, fuera de `src` (limitacion documentada).
- `hardcoded-api-url`: 2 URLs de sandbox hardcodeadas en `global.i18n`.

### F4 — validacion contra el proyecto real

Las 4 vistas de `/audit-graph.json?target=react` funcionan: overview (10 carpetas), `pages` (24
archivos, `page.checkout.js` primero), heatmap (60 archivos) y `pages/page.checkout.js` (13 reglas,
con `http-in-component` y `duplicate-endpoint` como `api_access`). Las recargas sin cambios salen del
cache (~0.01s). Verificado en el navegador: el filtro de categoria solo ofrece las de React y no
aparece el selector "PHP objetivo".

Pendiente conocido (previo a este plan): `auditRequest.ts`, `BuildAuditGraph.ts` y
`auditGraphLayout.ts` tienen mutantes sobrevivientes en codigo que no cambio (validacion de la
version PHP, cache por module/version, limites `slice`, tonos/acentos existentes).

### F5 — validacion contra el proyecto real

`/plan.json?target=react`: 10 tareas en 4 etapas — cerrar XSS (113), eliminar copias manuales (18)
→ archivos sin uso (39), tests en componentes complejos (75 high) → romper clases (2), aislar HTTP
(137), sacar jQuery (120), partir componentes (102) → reemplazar la herencia de `Global` (155, depende
de aislar HTTP) → validar. El plan de Laravel sigue igual (8 tareas) y conserva su avance: la
migracion 005 copio los 7 estados existentes como `laravel`. Marcar una tarea en React no la marca en
Laravel. Se subio el espaciado entre filas del grafo (170 → 250) porque con 5 tareas por etapa las
tarjetas se pisaban.

## 4. Definicion de hecho (global)

- Cada fase con spec + tests rojos→verdes + mutation sobre la logica pura nueva.
- Validacion manual contra el proyecto React real en el navegador (las 5 pestañas con `?target=react`).
