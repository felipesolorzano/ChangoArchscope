# Librerias copiadas a mano (F6)

## Objetivo

Los proyectos legacy (mc) traen librerias copiadas sin manifiesto (`jquery-1.7.1.min.js`, PHPExcel,
Kendo UI, PHPMailer) y manifiestos anidados que son de la libreria copiada, no del proyecto
(`kendoui/src/package.json` con las devDependencies de gulp de Telerik). Hay que reconocer las
copias, sacar del inventario las dependencias que no son del proyecto y pasar cada copia por el
mismo flujo (registro, vulnerabilidades, soporte, Plan). Plan: `docs/dependencies-plan.md`.

## Manifiestos que son copia de una libreria (`domain/services/libraryCopies.ts`, puro)

`isLibraryCopy(fileName, json)`, solo para manifiestos anidados (nunca el principal):

- `package.json`: declara `repository` u `homepage` y no es `private: true`.
- `composer.json`: declara `homepage`, `repositories`, `support` o `source` y su `type` no es
  `"project"`.

En `detectDependencies`: un manifiesto anidado que es copia no aporta dependencias ni cuenta para los
runtimes; queda en `inventory.vendoredManifests` (rutas, ordenadas). `manifests` lista solo los
propios. Un manifiesto con JSON invalido sigue yendo a `skipped`.

## Catalogo (`domain/services/vendoredCatalog.ts`, puro)

`identifyVendored(fileName, text)` → `{ ecosystem, name, version } | null`: la primera firma que
aplica (orden de la tabla). Las firmas de cabecera miran los primeros 1024 caracteres y solo
archivos `.js`/`.css`; las de archivo exigen el nombre y miran todo el texto. La version capturada
es siempre `x.y.z`.

| Paquete | Ecosistema | Firma |
|---|---|---|
| `kendo-ui-core` | npm | cabecera `Kendo UI v<yyyy.m.n>` |
| `jquery-ui-touch-punch` | npm | cabecera `jQuery UI Touch Punch <x.y.z>` |
| `jquery-ui` | npm | cabecera `jQuery UI [<Palabra> | CSS Framework] [- ]v?<x.y.z>` |
| `jquery-mobile` | npm | cabecera `jQuery Mobile [Framework ]v?<x.y.z>` |
| `jquery-validation` | npm | cabecera `jQuery Validation Plugin v?<x.y.z>` |
| `jquery` | npm | cabecera `jQuery [JavaScript Library ]v?<x.y.z>`, no precedida de `for ` (plugins: "Time entry for jQuery v1.5.1" es la version del plugin) |
| `bootstrap` | npm | cabecera `Bootstrap v<x.y.z>` |
| `font-awesome` | npm | cabecera `Font Awesome <x.y.z>` |
| `swiper` | npm | cabecera `Swiper <x.y.z>` |
| `fullcalendar` | npm | cabecera `FullCalendar v<x.y.z>` |
| `modernizr` | npm | cabecera `Modernizr v?<x.y.z>` |
| `normalize.css` | npm | cabecera `normalize.css v<x.y.z>` |
| `superfish` | npm | cabecera `Superfish v<x.y.z>` |
| `phpoffice/phpexcel` | composer | archivo `PHPExcel.php` con `@version <x.y.z>` |
| `phpmailer/phpmailer` | composer | archivo `PHPMailer.php` o `class.phpmailer.php` con `VERSION = '<x.y.z>'` o `$Version = '<x.y.z>'` |
| `bcosca/fatfree` | composer | archivo `base.php` con `PACKAGE='Fat-Free Framework'` y `VERSION='<x.y.z>…'` |

Versiones de dos partes (`jQuery UI Spinner 1.20`) no cuentan: evita confundir plugins con la
libreria.

## Deteccion (`application/use-cases/detectVendoredLibraries.ts`)

`detectVendoredLibraries({ root, ignoredPaths, reader })` → `DeclaredDependency[]`:

- Recorre `root` con extensiones `.js`, `.css`, `.php`, `.inc` e ignorando `ignoredPaths`,
  `**/node_modules`, `**/vendor` (los gestiona el gestor de paquetes) y `**/.*`.
- Agrupa por `(ecosystem, name, version)`: una dependencia por grupo con `constraint` = `installed` =
  la version, `dev: false`, `manifest` = el primer archivo del grupo (orden de recorrido) y
  `vendored: { files: <cantidad> }`.
- Orden: por `name` y despues por version (semver).
- `detectDependencies` agrega estas dependencias al final del inventario.

## Reporte

- `DeclaredDependency.vendored?: { files: number }` (ausente en las de manifiesto) llega al reporte.
- `measureUsage` no mide las copiadas (`usage: null`).
- `summary.vendored`: cantidad de dependencias copiadas.

## UI (`dependencies-explorer`)

- Fila: etiqueta `"copiada"` (`deps-tag--vendored`) si `vendored`.
- Drawer: la fila "Manifiesto" se llama "Copia en" para las copiadas y se agrega
  `"Copias": "<n> archivo(s)"`.
- Resumen: nota `"<n> copiadas a mano"` si `summary.vendored > 0`.

## Criterios de aceptacion

- `isLibraryCopy` con los casos de npm y composer (privado, `type: project`).
- `identifyVendored` reconoce cada firma de la tabla, respeta el orden (jQuery UI antes que jQuery,
  Touch Punch antes que jQuery UI), ignora versiones de dos partes y firmas fuera de la cabecera.
- `detectVendoredLibraries` agrupa, cuenta archivos, ordena e ignora `vendor`/`node_modules`.
- `detectDependencies` excluye las dependencias de manifiestos copia y los lista en
  `vendoredManifests`.
- Validacion real: en mc desaparecen los ~30 paquetes de gulp de Kendo y aparecen jQuery (varias
  versiones), jQuery UI, Bootstrap, Kendo UI, PHPExcel, PHPMailer y fatfree.
