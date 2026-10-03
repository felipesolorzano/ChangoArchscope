# APIs legacy y evidencia de tests por archivo (XRay X5)

## Objetivo

Detectar, sin Docker y en los dos stacks, usos de APIs deprecadas o eliminadas que un codemod (o
una migracion manual acotada) puede reemplazar, y publicar en el snapshot que tests cubren cada
archivo. Es el insumo del modulo `codemods` (`app/modules/codemods/specs/codemod-candidates.md`):
el audit solo diagnostica; agrupar por patron y sugerir la herramienta es de ese modulo.
Plan: `docs/xray-plan.md`.

Distinto de `php_compatibility` (phpcs en Docker, opcional, por version objetivo): aqui es una lista
corta y fija de patrones con reemplazo conocido, siempre activa.

## Hechos nuevos del parser

### JS (`JsFileStructure.legacyReactApis`)

`{ api: "render" | "hydrate" | "unmountComponentAtNode" | "findDOMNode" | "string-ref"; line }[]`,
en orden de aparicion:

- Bindings de `react-dom` (solo `import … from "react-dom"`; `require` no se sigue): el local de un
  import por defecto o namespace (`import ReactDOM from "react-dom"`, `import * as RD …`) es un
  objeto; un import nombrado de una de las 4 APIs (`import { render as r } …`) es esa API.
- Una llamada `<objeto>.<api>(…)` (no computada) con una de las 4 APIs, o `<local>(…)` de un import
  nombrado → `api`. Otras llamadas (`ReactDOM.createPortal`, un `render` sin importar) no cuentan.
- `ref="x"` (atributo JSX `ref` con string literal) o `this.refs` (no computado) → `"string-ref"`.

### PHP (`PhpFileStructure.functionCalls`)

`{ name, line }[]`: cada llamada a funcion global por nombre literal (`each($a)`, `\each($a)`), con
el nombre en minusculas y sin `\` inicial, en orden de aparicion. No cuentan metodos, estaticos ni
llamadas a variables (`$fn()`).

## Categoria `legacy_api` ("APIs legacy")

Nueva en los dos stacks (`auditCategoriesFor`, acento del grafo de Auditoria y del front). Todos los
findings llevan `details.pattern` (el id que agrupa `codemods`). `source: "native"`.

### React — `jsLegacyApiAnalyzer(files)`

Los archivos de test (`.test.`, `.spec.`, `/__tests__/`) no generan findings.

| Regla | Condicion | Severidad | `pattern` |
|---|---|---|---|
| `unsafe-lifecycle` | metodo de clase `componentWillMount`, `componentWillReceiveProps` o `componentWillUpdate` | medium | `unsafe-lifecycles` |
| `legacy-react-dom-api` | `legacyReactApis` `render`/`hydrate`/`unmountComponentAtNode` | medium | `react-dom-render` |
| `find-dom-node` | `legacyReactApis` `findDOMNode` (XRay X6: regla propia, se migra antes de actualizar) | medium | `find-dom-node` |
| `string-ref` | `legacyReactApis` `string-ref` | medium | `string-refs` |
| `with-router` | import con `withRouter` en `names` desde `react-router` o `react-router-dom` (uno por archivo) | low | `with-router` |
| `deprecated-library` | import (incluye `require`/`import()`) de `moment`, `request` o `react-ga` (uno por archivo y libreria, primera linea; subrutas como `moment/locale/es` cuentan como `moment`) | low | `lib-<libreria>` |

- `unsafe-lifecycle`: `class` = la clase, `line` = la del metodo, `details: { pattern, method }`,
  mensaje `"<metodo>" esta deprecado (React 16.3+): migrar o renombrar a UNSAFE_<metodo>.`
- `legacy-react-dom-api`: `details: { pattern, api }`, mensaje `ReactDOM.<api> no existe en React 19.`
- `find-dom-node`: `details: { pattern, api: "findDOMNode" }`, mensaje `findDOMNode no existe en React 19: usar una ref.`
- `string-ref`: `details: { pattern }`, mensaje `Las string refs no existen en React 19: usar createRef/useRef.`
- `with-router`: `details: { pattern }`, mensaje `withRouter no existe en React Router v6: usar hooks.`
- `deprecated-library`: `details: { pattern, library }`, mensaje `"<libreria>" esta deprecada: reemplazarla.`
- `class: null` salvo `unsafe-lifecycle`.

### PHP — `phpLegacyApiAnalyzer(files)`

Un finding por archivo y funcion (`line` = primera llamada, `details.count` = llamadas), `class: null`,
`details: { pattern, function, count, since }`:

| `pattern` | Funciones | Estado | Severidad |
|---|---|---|---|
| `mysql` | prefijo `mysql_` | eliminada en 7.0 | high |
| `ereg` | `ereg`, `eregi`, `ereg_replace`, `eregi_replace`, `split`, `spliti`, `sql_regcase` | eliminada en 7.0 | high |
| `mcrypt` | prefijo `mcrypt_` | eliminada en 7.2 | high |
| `each` | `each` | eliminada en 8.0 | high |
| `create-function` | `create_function` | eliminada en 8.0 | high |
| `money-format` | `money_format` | eliminada en 8.0 | high |
| `magic-quotes` | `get_magic_quotes_gpc`, `get_magic_quotes_runtime`, `set_magic_quotes_runtime` | eliminada en 8.0 | high |
| `utf8-encode` | `utf8_encode`, `utf8_decode` | deprecada en 8.2 | medium |

- Regla `removed-php-function` (eliminada) o `deprecated-php-function` (deprecada); `since` = la
  version. Mensaje `"<funcion>()" se elimino en PHP <since>.` / `"<funcion>()" esta deprecada desde PHP <since>.`

## Evidencia de tests por archivo (`AuditSnapshot.testedBy`)

`Record<archivo absoluto, tests absolutos[]>`, solo archivos con al menos un test, tests ordenados:

- React (`jsTestImporters(files)`, dominio): archivos de test (`.test.`, `.spec.`, `/__tests__/`) del
  escaneo y de `react.testPaths`; un test cubre los archivos a los que resuelve
  (`resolveJsImport`) alguno de sus imports. Un test no se cubre a si mismo.
  `jsTestingAnalyzer` usa el mismo servicio (sin cambio de comportamiento).
- PHP (`phpTestReferrers(files)`, dominio): archivo de test = declara una clase cuyo `extendsName`
  termina en `TestCase` (como `phpTestingAnalyzer`); cubre a cada archivo que declara una clase
  (no de test) cuyo nombre esta en los `referencedNames` del test.
- `buildAuditSnapshot` recibe `testedBy` en el contexto (default `{}`).

## Criterios de aceptacion

- Parser JS: default, namespace y nombrado (con alias) de `react-dom`; llamadas que no cuentan;
  `ref` string y `this.refs`; computados no cuentan.
- Parser PHP: llamada simple, con `\`, mayusculas; metodos/estaticos/variables no cuentan; orden de aparicion.
- Cada fila de las tablas dispara; test fuera de los findings; uno por archivo donde corresponde.
- `testedBy` en los dos stacks (incluye `testPaths` en React) y snapshot con `testedBy`.
- Validacion real: brandsites (lifecycles, withRouter, moment, ReactDOM.render) y mc (each, split,
  utf8_encode, mysql_*).
