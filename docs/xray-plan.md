# Plan — XRay: diagnostico para modernizar legacy (ChangoArchscope)

> Documento de plan. ArchScope es el "XRay": diagnostica y produce el plan; no escribe en el
> proyecto ni lo ejecuta (eso es de agentes aparte: "Guardian" para tests de caracterizacion y
> "Refactor" para codemods, que consumen la API de ArchScope). Sigue `docs/development-rules.md`.

## 0. Ya existente

Dependencias (`docs/dependencies-plan.md`), Arquitectura (grafo, capas, acoplamiento, `folderOrder`),
Auditoria (complejidad, seguridad, codigo muerto por archivo, salud), Plan (tareas encadenadas con
estado), Migracion/Diseño (bounded contexts).

## 1. Fases

| Fase | Entrega | Estado |
|---|---|---|
| **X1 Ciclos y salud de arquitectura** | Ciclos de imports (SCC) y KPIs del grafo (imports entre modulos, pares de modulos, archivos mas importados / que mas importan) en `/graph.json`; ciclos en el check → hallazgos `import-cycle` en Auditoria → tarea `break-import-cycles` en Plan; panel "Salud" en Arquitectura. Spec: `app/modules/architecture/specs/architecture-health.md` | Completa |
| **X1b Grafo de includes PHP** | Resolver `include`/`require` del PHP legacy (rutas literales, relativas y con constantes declaradas en la config: `_PRIVATE_DIR`, `_COMPUMATIC_DIR`...) para que mc tenga grafo, ciclos y hubs. Spec: `app/modules/architecture/specs/php-includes.md` | Completa |
| **X2 Exports muertos** | Exports que nadie importa (estilo Knip) en JS/TS: el parser registra `exports`, regla `unused-export` en Auditoria (dead_code), tarea `remove-unused-exports` en Plan. Specs: `js-source-parser.md`, `react-analyzers.md`, `plan-tasks.md` | Completa |
| **X3 Linea base de proteccion** | Bounded context `protection`: evidencia de tests + reportes existentes (Istanbul/lcov/clover, Stryker JSON/HTML, Infection, Playwright) → nivel none/low/medium/high; `/protection.json`; franja "Red de seguridad" en Plan. Spec: `app/modules/protection/specs/protection-baseline.md` | Completa |
| **X4 Objetivos de caracterizacion** | Bounded context `characterization`: ranking (riesgo × uso, sin tests, sin copias ni muertos) + esqueletos RTL/MSW/Playwright/PHPUnit golden master; `/characterization.json`; panel "Que proteger primero" en Plan. Spec: `app/modules/characterization/specs/characterization-targets.md` | Completa |
| **X5 Candidatos a codemod** | Categoria `legacy_api` en Auditoria (React: lifecycles deprecados, `ReactDOM.render`/`findDOMNode`, string refs, `withRouter`, moment/request/react-ga; PHP: `mysql_*`, `ereg`/`split`, `each`, `create_function`, `utf8_encode`…) + `testedBy` por archivo en el snapshot; bounded context `codemods` (patron → herramienta y comando, archivos, tests que los cubren); `/codemods.json`; panel "Codemods" en Plan. Specs: `app/modules/audit/specs/legacy-api.md`, `app/modules/codemods/specs/codemod-candidates.md` | Completa |
| **X6 Plan por fases con quality gates** | Fases 0–10 con metas medibles que se validan solas contra las metricas | Pendiente |

## 2. Hallazgos que guian X1

- brandsites: 269 archivos, 715 imports archivo→archivo, 1 ciclo (un archivo que se importa a si
  mismo); 581 imports entre carpetas: lo util ahi son los hubs y el acoplamiento.
- mc: 0 imports archivo→archivo: el analizador PHP sigue `use App\Modules\…` y mc se conecta con
  `include`/`require` (393, la mayoria con constantes o rutas fuera del repo) → X1b.

### X1 — validacion

- brandsites: 1 ciclo (autoimport de `component.destinations.popular-ids.js`) → hallazgo
  `import-cycle` y tarea `break-import-cycles` en Plan; 581 imports entre carpetas en 18 pares;
  `globals/global.js` lo importan 150 de 269 archivos; `routes.bookingwidget4/5/3.js` importan 35–38
  archivos cada uno. Click en el panel enfoca el archivo en el grafo.
- Tarjan iterativo: 5000 archivos en cadena sin desbordar la pila.
- mc sigue sin grafo (0 imports archivo→archivo) hasta X1b.

### X1b — validacion con mc

- 0 → 246 includes resueltos de 436 (30 externos a `/usr/local/lib/php`, 160 sin resolver: 57 por
  `_COMPUMATIC_DIR`, el resto dinamicos o librerias del include_path del servidor). Las constantes
  `_PRIVATE_DIR`/`_PROOT_DIR`/`PHPEXCEL_ROOT` se deducen solas de los `define` de cada app.
- 1 ciclo real: `_global/lib/Classes/MSUsersDBCronJobs.lib.inc ⇄ MSUsersTravelInfoUtils.lib.inc`
  (tarea en Plan). Hubs: las dos copias de PHPExcel (`Autoloader.php`, 26 cada una),
  `_global/lib/main.lib.inc` (19), `_global/services/_config.lib.inc` (17), `menu.php` duplicado en
  admin y provider. 20 includes entre apps (4 pares).
- Rendimiento: el lexer salta entre cambios de estado (archivos de >1 MB); grafo de mc ~2 s.

### X2 — validacion

- Criterio (como Knip): los tests cuentan como uso de un export (un helper exportado para testearlo
  esta en uso) pero no salvan un archivo; solo valores (tipos/interfaces son contrato).
- Front de ChangoArchscope: sin esos dos criterios daba 39 falsos positivos; con ellos, 2 reales que
  se corrigieron (`RUNTIME_LINES` exportado sin uso; `export type { X }` que el parser tomaba como
  valor). Auto-auditoria en 0.
- brandsites: 2 exports muertos reales en `component.form.validator.js` (un `export default` vacio y
  `validateOtherField`); el legacy usa sobre todo `export default` de componentes que si se importan.
  Plan: `remove-unused-exports` despues de `remove-unused-files` (39).
- Solo JS/TS: el PHP legacy no exporta (funciones/clases sin uso es otra regla).

### X3 — validacion

- mc: 8 tests reales (4 `*.test.php` y 4 de navegador `*.test.mjs` en `admin/reports-src/tests`),
  1733 fuentes, sin reportes → nivel "Baja". Los `*Test.php` sueltos de los ejemplos de PHPExcel
  ya no cuentan (PHPUnit: solo dentro de `tests/` o `test/`).
- brandsites: 0 tests propios; con la config actual `react.testPaths` sigue apuntando a los tests de
  ChangoArchscope (por eso muestra 28): hay que actualizarlo al cambiar `modulesPath`.
- ChangoArchscope: 28 tests, mutation 100% leido de sus reportes HTML de Stryker (formato con
  `app.report = …` y uniones `"+"`), sin reporte de cobertura → "Media".
- Los tests cuentan aunque `ignoredPaths` los excluya del analisis.

### X4 — validacion

- brandsites: 20 objetivos; primero `pages/page.checkout.js` (riesgo 80, 6 importadores, 4 endpoints →
  RTL + MSW + Playwright), despues `page.tours.js` y `component.tour.availability.js`. ~0.9 s.
- El legacy exporta `export default withRouter(checkout)` con clases en minuscula: el parser ahora
  registra a que apunta el `export default` (`local`, atravesando HOCs), `untested-component` trae
  `exportedAs`, y el esqueleto importa `Checkout` (PascalCase: `<checkout />` seria una etiqueta HTML);
  los componentes no exportados quedan como comentario.
- mc: 20 clases; primero `MSAdminTraficSys.lib.inc` (riesgo 7220, 430 metodos sin test) y
  `MSTraficSys.lib.inc`; un golden master de PHPUnit por clase. ~12 s en frio (incluye el audit).
- UI: boton "Que proteger primero" en la franja de proteccion → panel con score, razones y descarga de
  cada esqueleto (archivo con el nombre de su ruta). Sin errores de consola.

### X5 — validacion

- brandsites: 9 patrones en ~0.9 s. Automaticos: lifecycles deprecados (38 archivos, 42 metodos →
  `react-codemod rename-unsafe-lifecycles`), `ReactDOM.render` (2) y string refs (2, 3 usos). Manuales:
  `withRouter` 115 archivos (React Router v6), jQuery 79 archivos / 360 accesos, moment 21, `findDOMNode`
  2, request 2, react-ga 1. Ningun archivo tiene tests: todos piden caracterizar antes (X4).
- mc: 7 patrones (~11 s en frio, incluye el audit). `utf8_encode`/`utf8_decode` 1412 llamadas en 50
  archivos y `ereg`/`split` 126 en 9 (Rector); `mysql_*` 23 en 7, magic quotes, `money_format`, mcrypt
  (manuales). `each()`: el grep daba 967, el AST encuentra 1 llamada real (el resto eran `->each()` y
  `.each()` de jQuery dentro del PHP).
- Las copias manuales y los archivos sin uso no cuentan (se borran, no se migran).
- UI: boton "Codemods" junto a "Que proteger primero" (un solo panel a la vez) con herramienta,
  resumen, aviso "Caracterizar antes", comando con "Copiar" y archivos con "con/sin tests"; filtro
  "APIs legacy" en Auditoria. Sin errores de consola.
- Mutation: 100% en parser, analizadores, `testedBy`, modulo `codemods` (salvo rutas, composition
  root) y helpers/store/provider/lista del front; los drawers con efectos no se pueden ejercitar sin DOM
  (igual que X4).

