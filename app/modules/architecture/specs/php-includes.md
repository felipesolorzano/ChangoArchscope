# Grafo de includes PHP legacy (XRay X1b)

## Objetivo

El PHP legacy (mc) no usa `use App\Modules\…`: se conecta con `include` / `require` (`_once`), casi
siempre con constantes (`_PRIVATE_DIR."lib/main.lib.inc"`) definidas por cada app en su
`_config.lib.inc`. Resolver esos includes a archivos del repo da grafo, ciclos y hubs (X1) para mc.
Plan: `docs/xray-plan.md`.

## Sintaxis (`domain/services/phpIncludeSyntax.ts`, puro)

- Atajo: un fuente sin `include`, `require` ni `define` no se analiza (la mayoria de los archivos).

`phpIncludeSyntax(source)` → `{ includes: [{ expression, line }], defines: [{ name, expression }] }`:

- Solo cuenta el codigo dentro de `<?php … ?>` / `<?= … ?>` (el HTML de afuera no); un `?>` cierra
  la sentencia. Se ignoran comentarios (`//`, `#`, `/* */`) y el contenido de strings al buscar
  sentencias (un `//` dentro de un string no es comentario).
- Include: `include`, `include_once`, `require`, `require_once` como palabra (no `$x->require(`,
  `::include`), seguido de la expresion hasta el `;`. `expression` sin espacios al borde; `line` = linea
  de la palabra clave.
- Define: `define('NOMBRE', <expresion>)` o con comillas dobles, con un tercer argumento booleano
  opcional; `expression` = el segundo argumento.

## Expresiones de ruta (`domain/services/phpPathExpression.ts`, puro)

`evaluatePathExpression(expression, { file, constant })` → `string | null`, con `file` = ruta absoluta
del archivo donde esta la expresion y `constant(name)` → valor o `null`:

- String con comillas simples; con dobles solo si no interpola (`$`); concatenacion `.`; parentesis.
- `__DIR__` = carpeta de `file`; `__FILE__` = `file`; `dirname(x)` = carpeta de `x`; `realpath(x)` =
  `x` normalizada (sin `..` ni `/` final).
- Identificador en mayusculas (`_PRIVATE_DIR`) → `constant(nombre)`.
- Cualquier otra cosa (variables, otras funciones, operadores) → `null`; tambien si alguna parte es
  `null`.

## Resolucion (`application/analyzers/phpIncludes.ts`)

`resolvePhpIncludes({ files, modulesPath, reader, includeConstants, includePaths })`, con
`files = [{ file (absoluta), module }]` (los archivos del grafo) →
`{ links: [{ from, to, line, expression }], stats: { total, resolved, external, unresolved,
unresolvedConstants: [{ name, count }] } }`:

- Constantes para un archivo, en este orden: integradas de PHP (`DIRECTORY_SEPARATOR` = `/`) →
  `includeConstants` de la config → `define` del mismo
  archivo → de otros archivos del mismo modulo (por ruta) → de cualquier archivo (por ruta). Gana la
  primera definicion que se puede evaluar; cada `define` se evalua en el contexto de su archivo
  (`__DIR__` del que define). Una constante que se define a si misma (ciclo) no tiene valor.
- Ruta evaluada: absoluta → esa; empieza con `./` o `../` → relativa a la carpeta del archivo; otra
  relativa → la carpeta del archivo y despues cada `includePaths`, la primera que exista.
- `resolved`: la ruta es un archivo del grafo → link `from` → `to` (links ordenados por `from` y
  `line`). `external`: ruta absoluta fuera de
  `modulesPath`. `unresolved`: el resto (expresion sin valor o archivo que no esta en el grafo).
- `unresolvedConstants`: constantes sin valor usadas en includes, con cuantos includes bloquean, por
  `count` descendente y nombre; hasta 10.

## Config

- `laravel.includeConstants?: Record<string, string>`: valor de constantes que no se deducen (rutas
  absolutas o relativas a `modulesPath`; `normalizeConfig` las vuelve absolutas conservando la `/`
  final).
- `laravel.includePaths?: string[]`: el `include_path` (relativas al proyecto → absolutas).

## Grafo

- `buildLaravelGraph` agrega un edge `import` por link: `label` = nombre del archivo destino,
  `import` = la expresion, `line`, `crossModule` si los modulos difieren. Asi X1 (ciclos, hubs,
  acoplamiento, hallazgos y Plan) aplica a los includes.
- `summary.includes` = `stats` (solo laravel).
- UI (`ArchitectureHealthPanel`): si el grafo trae `summary.includes`, linea `"Includes: <resolved>
  de <total> resueltos · <external> externos"` y, si hay `unresolvedConstants`, `"Sin valor: <NOMBRE>
  (<n>), …"` (las 5 primeras) con la ayuda `"Declaralas en laravel.includeConstants"`.

## Criterios de aceptacion

- Sintaxis: includes con y sin parentesis, `_once`, dentro de `<?php ?>` con HTML alrededor, en
  comentarios y strings no, `->require(` no; defines con comillas simples/dobles y tercer argumento.
- Expresiones: literales, interpolacion (null), `__DIR__`, `dirname(__FILE__) . '/../'`, `realpath`,
  constantes, desconocidos (null).
- Resolucion: constante por archivo (PHPEXCEL_ROOT), por modulo (`_PRIVATE_DIR` via `_PROOT_DIR`),
  primera definicion evaluable, config primero, relativas e `includePaths`, externos, sin resolver y
  ranking de constantes.
- Validacion real: mc pasa de 0 a cientos de links; ciclos y hubs reales.
