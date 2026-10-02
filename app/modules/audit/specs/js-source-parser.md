# Parser JS/JSX (`JsSourceParser`) — Fase 2 del target React

## Objetivo

Convertir un archivo `.js/.jsx/.ts/.tsx` en una estructura de datos (`JsFileStructure`) con la
informacion que necesitan los analizadores React de la Fase 3 (complejidad, acoplamiento de bajo
nivel, codigo muerto, seguridad, datos/API, testing). Es el equivalente de `PhpSourceParser` /
`PhpAstParser` para JavaScript: el parser solo EXTRAE hechos, no decide findings ni umbrales.

## Capas

- `domain/repositories/JsSourceParser.ts`: puerto `parse(file, source): JsFileStructure`.
- `domain/value-objects/JsFileStructure.ts`: tipos de salida.
- `infrastructure/parser/BabelJsParser.ts`: adaptador sobre `@babel/parser` (dependencia runtime).
- `application/use-cases/ScanJsFiles.ts`: recorre la raiz con `SourceTreeReader` y parsea cada
  archivo; los que fallan van a `skipped` (mismo contrato que `scanPhpFiles`).

## Configuracion del parser

- `sourceType: "unambiguous"` (ESM o CommonJS).
- Plugins por extension: `.ts` → `typescript`; `.tsx` → `typescript` + `jsx`; `.js`/`.jsx` (y
  cualquier otra) → `jsx` + `decorators-legacy`.
- Un error de sintaxis lanza; `scanJsFiles` lo captura como `{ file, error }` en `skipped`.

## Salida (`JsFileStructure`)

```ts
{
  file: string;
  linesCount: number;                 // lineas del source (split por \n)
  classes: JsClassStructure[];        // clases de nivel superior (incluye export / export default)
  functions: JsFunctionStructure[];   // funciones de nivel superior (ver abajo)
  imports: JsImport[];
  securityIssues: JsSecurityIssue[];
  httpCalls: JsHttpCall[];
  globalAccesses: JsGlobalAccess[];
}
```

### Funciones (`JsFunctionStructure`)

`{ name, kind, startLine, endLine, parametersCount, decisionPointsCount, containsJsx }`

- De nivel superior: `function f(){}`, `const f = () => {}`, `const f = function(){}`, y las mismas
  envueltas en `export` / `export default`. Una funcion `export default` anonima se llama `"default"`.
- `kind`: `"function"` (declaracion o function expression), `"arrow"`, `"method"`.
- `decisionPointsCount` cuenta, en todo el cuerpo (incluidas funciones anidadas): `if`, ternario,
  `for`, `for…in`, `for…of`, `while`, `do…while`, `catch`, cada `case` con test (no `default`), y
  los operadores logicos `&&`, `||`, `??`.
- `containsJsx`: el cuerpo contiene al menos un elemento o fragmento JSX.

### Clases (`JsClassStructure`)

`{ name, startLine, endLine, extendsName, methods, stateKeysCount }`

- `extendsName`: `"Global"` para `extends Global`, `"React.Component"` para un member expression
  (se une con `.`), `null` sin `extends`.
- `methods`: metodos de clase (incluye `constructor` y `render`) con `kind: "method"`, y propiedades
  de clase cuyo valor es una arrow/function (`handle = () => {}`) con el kind de esa funcion.
- `stateKeysCount`: cantidad de claves de nivel superior del objeto asignado a `this.state = {…}`
  o a la propiedad de clase `state = {…}`; el maximo si hay varios; `0` si no hay.
- Una clase `export default` anonima se llama `"default"`.

### Imports (`JsImport`)

`{ source, names, line }`

- `import X, { a as b } from "m"` → `names: ["default", "a"]` (nombre importado, no el local);
  `import * as ns from "m"` → `["*"]`; `import "m"` → `[]`.
- `require("m")` y `import("m")` con un string literal → `names: []`.
- `require(`./config.${x}`)` / `import(`…`)` con template literal → `source` es el texto con `${}`
  en el lugar de cada expresion (`"./config.${}"`), `names: []`: un import dinamico que los
  analizadores resuelven como patron. Cualquier otro argumento no cuenta.
- `export … from "m"` tambien cuenta como import de `m` (`names` = nombres reexportados).

### Seguridad (`JsSecurityIssue`)

`{ rule, line }`, con `rule`:

- `dangerously-set-inner-html`: atributo JSX `dangerouslySetInnerHTML`.
- `eval-usage`: llamada a `eval(...)` (en cualquier forma de llamada).
- `new-function`: `new Function(...)` o `Function(...)` (ambas compilan codigo desde un string).
- `inner-html-assignment`: asignacion a `<expr>.innerHTML` o `<expr>.outerHTML`.

### Llamadas HTTP (`JsHttpCall`)

`{ client, endpoint, line }`, con `client`:

- `fetch`: `fetch(x)`.
- `axios`: `axios(x)` o `axios.<metodo>(x)`.
- `jquery-ajax`: `$.ajax|get|post|getJSON(x)` o lo mismo sobre `jQuery`.
- `request`: `request(x)`.
- `crud`: `this.all|single|edit|create|delete(opts)` — patron de la base `Crud` heredada en
  proyectos legacy. `opts` es un objeto literal, o un identificador cuya declaracion
  (`var|let|const opts = …`) esta en la funcion mas cercana que contiene la llamada (el archivo si
  no hay funcion; no se resuelven variables de funciones externas); si hay varias declaraciones,
  vale la ultima que empieza en o antes de la linea de la llamada. Solo cuenta si ese valor es un
  objeto literal con `method` string literal.

`endpoint` (string o `null`):

- Primer argumento string literal → su valor.
- Primer argumento template literal → sus partes de texto unidas con `${}` en el lugar de cada
  expresion (`` `${api}/GetTours` `` → `"${}/GetTours"`).
- Primer argumento objeto (cualquier cliente salvo `crud`) → el valor de su propiedad `url` si es
  string o template literal (con las mismas reglas de arriba).
- `crud` → el valor de `method`, prefijado con `controller + "/"` si `controller` es string literal.
- Cualquier otro caso → `null`.

### Accesos globales (`JsGlobalAccess`)

`{ kind, line }`, una entrada por ocurrencia:

- `jquery`: llamada `$(…)` / `jQuery(…)`, acceso `$.x` / `jQuery.x`, o `window.$` / `window.jQuery`.
- `window`: cualquier otro acceso `window.x`.
- `dom`: acceso `document.x`.

## Casos invalidos

- Codigo con error de sintaxis → `parse` lanza; `scanJsFiles` lo reporta en `skipped`.

## Criterios de aceptacion

- Cada regla de arriba tiene al menos un test con un snippet minimo.
- `scanJsFiles` usa `walkFiles(root, extensions, ignoredPaths)`, parsea cada archivo con
  `reader.readText`, y separa exitos (`files`) de fallas (`skipped`, con el mensaje de error).
- Los 259 archivos del proyecto React real parsean sin fallas (validacion manual).
