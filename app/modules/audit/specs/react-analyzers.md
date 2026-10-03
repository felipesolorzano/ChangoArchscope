# Analizadores React — Fase 3 del target React

## Objetivo

Producir `AuditFinding` para proyectos React/JS a partir de `JsFileStructure[]` (salida de
`scanJsFiles`, ver `js-source-parser.md`), con las mismas categorias que PHP reinterpretadas para
frontend, e integrarlos al `AuditSnapshot` del target `react`. Como en PHP, los analizadores solo
diagnostican: no deciden prioridades (eso es `plan`).

Umbrales calibrados contra un proyecto CRA legacy real (259 archivos): ver `docs/react-target-plan.md`.

## Convenciones comunes

- Todos los findings: `source: "native"`, `module: ""` (el modulo se deriva de la ruta en
  `riskBreakdown`), `file` = ruta absoluta del archivo, `details` con las metricas de la regla.
- `class`: nombre de la clase o componente cuando aplica; `null` si no.
- Funciones puras en `application/analyzers/` (una por categoria) + servicios de dominio
  compartidos en `domain/services/`.

## Servicios de dominio compartidos

### `jsComponentsOf(file)` → `JsComponent[]`

`{ name, kind: "class" | "function", startLine, endLine, cyclomaticComplexity }`

- Clase componente: tiene un metodo `render`, o su `extendsName` es `Component`, `PureComponent`,
  `React.Component` o `React.PureComponent`. `cyclomaticComplexity` = suma de
  `decisionPointsCount` de sus metodos + 1.
- Funcion componente: funcion de nivel superior con `containsJsx`. `cyclomaticComplexity` =
  `decisionPointsCount + 1`.
- Orden: clases y luego funciones, en orden de aparicion.

### `resolveJsImport(fromFile, source, knownFiles)` → `string[]`

- Solo imports relativos (`./`, `../`); paquetes y alias → `[]`.
- Base = `fromFile` dirname + `source` (posix). Candidatos en orden: la base exacta; base + `.js`,
  `.jsx`, `.ts`, `.tsx`; `base/index` + esas extensiones; y, si la base termina en `.js`/`.jsx`, la
  misma ruta con `.ts`/`.tsx` (convencion ESM de TypeScript: `import "./App.js"` apunta a `App.tsx`).
  Devuelve `[primero que este en knownFiles]`, o `[]`.
- Import dinamico (`source` con `${}`): cada `${}` matchea uno o mas caracteres sin `/` (el nombre
  de un modulo); devuelve TODOS los `knownFiles` que matchean base + extension o `base/index` +
  extension (sin la base exacta: `./config.${}` no matchea `config.js` ni `config.notes.txt`), en
  el orden de `knownFiles`.

## `complexity` — `jsComplexityAnalyzer(files, thresholds?)`

Umbrales por defecto: `{ methodLines: 50, renderLines: 150, parameters: 5,
cyclomaticComplexity: 10, componentLines: 300, classLines: 300, stateKeys: 10 }`. Las reglas
disparan al SUPERAR el umbral (`>`).

Por cada metodo de clase y funcion de nivel superior:

| Regla | Condicion | Severidad |
|---|---|---|
| `long-render` | metodo `render` de una clase con lineas > `renderLines` | medium |
| `long-method` | cualquier otro metodo/funcion con lineas > `methodLines` | medium |
| `too-many-parameters` | `parametersCount > parameters` | medium |
| `high-cyclomatic-complexity` | `decisionPointsCount + 1 > cyclomaticComplexity` | high |

Por cada componente / clase:

| Regla | Condicion | Severidad |
|---|---|---|
| `large-component` | componente (clase o funcion) con lineas > `componentLines` | medium |
| `large-class` | clase que NO es componente con lineas > `classLines` | medium |
| `large-state` | clase con `stateKeysCount > stateKeys` | medium |

`line` = `startLine` del metodo/clase/componente. `details`: `{ lines }`, `{ parametersCount }`,
`{ cyclomaticComplexity }` o `{ stateKeys }`. `class` = nombre de la clase (null para funciones de
nivel superior, salvo `large-component` de una funcion, que usa su nombre).

## `coupling_low_level` — `jsCouplingAnalyzer(files)`

Agregado por archivo (un finding por archivo y regla, no por ocurrencia), `line` = primera
ocurrencia, `details: { count }`. `direct-dom-access` y `global-window-access` NO aplican a archivos en
una carpeta `infrastructure/` (en un diseño hexagonal los adaptadores son el lugar correcto para los
globals del navegador) ni a entry points (`index.*` / `main.*`, que montan la app en el DOM). Un arbol
legacy plano no tiene `infrastructure/`, asi que ahi se siguen marcando todos:

| Regla | Condicion | Severidad |
|---|---|---|
| `jquery-usage` | al menos un acceso `jquery` | medium |
| `direct-dom-access` | al menos un acceso `dom` | medium |
| `global-window-access` | al menos un acceso `window` | low |

Por clase:

| Regla | Condicion | Severidad |
|---|---|---|
| `base-class-inheritance` | `extendsName` no nulo y distinto de las 4 bases de React | medium |

`base-class-inheritance`: `class` = la clase, `line` = su `startLine`, `details: { base }`.

## `dead_code` — `jsDeadCodeAnalyzer(files)` (global)

| Regla | Condicion | Severidad |
|---|---|---|
| `possibly-unused-file` | ningun otro archivo escaneado lo importa (via `resolveJsImport` de sus `imports`) y no es un entry point (nombre sin extension = `index` o `main`, p. ej. el `main.tsx` de Vite) | low |
| `manual-copy-file` | nombre (sin la extension) que TERMINA con una marca de copia manual: ` - copia`, ` - copy`, ` copy`, ` copy N`, `_copia`, `_copy`, `_old`, `.devel`, `.bak` (con o sin ` (N)`); sin distinguir mayusculas | low |

`line: 1`, `class: null`, `details: { name: basename }`. Un archivo que se importa a si mismo no
cuenta como importado.

`jsDeadCodeAnalyzer(files, testFiles = [])`; `testFiles` solo cuenta como uso de exports (no evita
`possibly-unused-file`, igual que antes).

`unused-export` (XRay X2, low): un export (`exports`) que ningun OTRO archivo escaneado usa, en un
archivo que si se importa (si nadie lo importa ya sale `possibly-unused-file`) y que no es entry
point. Un export se usa si otro archivo (o un archivo de test de `testRoots`: un helper exportado
para testearlo esta en uso) tiene un import que resuelve a este archivo
(`resolveJsImport`) con ese nombre en `names`, con `"*"` (namespace o `export *`), o con `names`
vacio (`require`, `import()` o import de efecto: no se sabe que nombres usa). `line` = la del export,
`details: { name: basename, export: <nombre> }`, mensaje
`"<nombre>" se exporta pero ningun archivo lo importa. Verificar antes de eliminar.` Mensajes con "Verificar antes de eliminar" (heuristico: no ve imports por
alias, rutas dinamicas ni archivos fuera del escaneo).

## `security` — `jsSecurityAnalyzer(files)`

Mapa 1:1 de `securityIssues`, `class: null`, `details: {}`:

| Regla | Severidad |
|---|---|
| `eval-usage` | critical |
| `new-function` | critical |
| `dangerously-set-inner-html` | medium |
| `inner-html-assignment` | medium |

## `api_access` — `jsApiAnalyzer(files)` (global)

Categoria nueva: acceso a API/HTTP desde el frontend. Por llamada (`httpCalls`), `line` = la de la
llamada, `details: { client, endpoint }`:

| Regla | Condicion | Severidad |
|---|---|---|
| `http-in-component` | el archivo define al menos un componente (`jsComponentsOf`) | medium |
| `hardcoded-api-url` | `endpoint` empieza con `http://` o `https://` | medium |
| `duplicate-endpoint` | el mismo `endpoint` (no nulo) aparece en 2 o mas archivos distintos; un finding por ocurrencia | low |

## `testing` — `jsTestingAnalyzer(files)` (global)

- Archivo de test: ruta que contiene `.test.` o `.spec.`, o `/__tests__/`.
- Archivos testeados: los que resuelven (`resolveJsImport`) desde los imports de algun test.

| Regla | Condicion | Severidad |
|---|---|---|
| `untested-component` | componente de un archivo que no es test ni esta testeado | high si `cyclomaticComplexity > 10`, si no medium |

`class` = componente, `line` = su `startLine`, `details: { name, cyclomaticComplexity, exportedAs }`.
`exportedAs` (XRay X4, para importarlo desde un test): `"default"` si el componente se llama
`"default"` o el `export default` del archivo apunta a el (`local`); si no, su nombre si el archivo lo
exporta con ese nombre; si no `null` (no se exporta: se prueba a traves de quien lo usa).
Limitacion: si `react.ignoredPaths` excluye los tests, todo componente queda como no testeado —
salvo que se declaren en `react.testPaths` (ver Integracion).

## Integracion

- `react.testPaths: string[]` (config, default `[]`; relativas al proyecto como `modulesPath`):
  carpetas de tests FUERA de `modulesPath` (p. ej. `resources/js/react/tests`). Se escanean con las
  mismas extensiones (sin `ignoredPaths`) y sus archivos se pasan SOLO a `jsTestingAnalyzer` como
  evidencia; no generan findings propios ni cuentan como uso para `dead_code`.
- `auditProject` acepta `js?: { root, extensions, ignoredPaths, parser, testRoots? }`. Si viene, escanea con
  `scanJsFiles` (o el `scanJsFiles` inyectado) y suma los findings de los 6 analizadores (mas
  `jsLegacyApiAnalyzer` y `testedBy`, XRay X5: ver `legacy-api.md`); los
  archivos que no parsean van a `skippedFiles`; `riskBreakdown` deriva modulos desde `js.root`
  cuando no hay raiz PHP.
- HTTP (`resolveAuditSnapshot`) y CLI (`audit --target react`) pasan `js` con
  `config.react.modulesPath`, las extensiones `.ts/.tsx/.js/.jsx`, `config.react.ignoredPaths`,
  `testRoots = config.react.testPaths` y `BabelJsParser`. Con `target=laravel` no cambia nada.
- El fingerprint del cache (HTTP) combina la raiz y cada `testPath`: agregar o editar un test invalida
  el snapshot.

## Criterios de aceptacion

- Cada regla de cada tabla tiene un test que dispara y uno en el borde (= umbral, o caso negativo).
- `auditProject` con `js` incluye findings JS, reporta archivos JS fallidos en `skippedFiles` y
  agrupa `byModule` por la primera carpeta bajo `js.root`.
- `/audit.json?target=react` sobre el proyecto real devuelve findings en las 6 categorias
  (validacion manual).
