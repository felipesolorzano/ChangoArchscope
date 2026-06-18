# PHP Complexity Analyzer

## Objetivo

Primer analizador nativo de Audit (Fase 2 de `docs/audit.md`): a partir de un AST real de PHP (via `php-parser`), extraer metricas de clases/metodos y generar `AuditFinding` de categoria `complexity` cuando se exceden umbrales (metodos largos, clases grandes, demasiados parametros, complejidad ciclomatica alta).

## Entradas

- `PhpSourceParser` (puerto de dominio en `app/modules/audit/domain/repositories/PhpSourceParser.ts`): `parse(file: string, source: string): PhpFileStructure`.
- `PhpFileStructure` (value object en `app/modules/audit/domain/value-objects/PhpFileStructure.ts`):
  - `file: string`
  - `classes: PhpClassStructure[]` — incluye clases y traits (misma forma; las interfaces no aportan metodos con cuerpo, asi que quedan vacias y no generan findings).
  - `functions: PhpMethodStructure[]` — funciones sueltas fuera de clase.
  - `PhpClassStructure`: `{ name, startLine, endLine, methods: PhpMethodStructure[] }`.
  - `PhpMethodStructure`: `{ name, startLine, endLine, parametersCount, decisionPointsCount }`.
- `phpComplexityAnalyzer(structures: PhpFileStructure[], thresholds?: PhpComplexityThresholds): AuditFinding[]`.
- `PhpComplexityThresholds` (todas con default fijo en v1, sin configuracion externa todavia): `{ methodLines: 30, classLines: 300, parameters: 5, cyclomaticComplexity: 10 }`.

## Comportamiento del parser (`PhpAstParser`)

- Implementado en `app/modules/audit/infrastructure/parser/PhpAstParser.ts`, envolviendo la libreria `php-parser` (AST real, sin requerir PHP instalado).
- Recorre el AST de nivel superior (incluyendo el contenido de bloques `namespace`) y extrae:
  - Nodos `class` y `trait` como `PhpClassStructure`, usando `name.name` y `loc.start.line`/`loc.end.line`.
  - Miembros con `kind: "method"` dentro de cada clase/trait como `PhpMethodStructure`.
  - Nodos `function` de nivel superior como `PhpMethodStructure` en `functions`.
  - Metodos o funciones sin `body` (interfaces, metodos abstractos) se omiten: no hay logica que medir.
- `parametersCount` es la longitud del arreglo `arguments` del nodo.
- `decisionPointsCount` cuenta, recursivamente dentro del `body` del metodo/funcion, los nodos: `if` (incluye `elseif`, representado por `php-parser` como `if` anidado en `alternate`), `for`, `foreach`, `while`, `do`, `catch`, `retif` (ternario), cada `case` con `test` no nulo (excluye `default`), y cada `bin` con `type` `"&&"` o `"||"`.
- Limitacion conocida y documentada: la complejidad de closures/funciones anonimas anidadas dentro de un metodo se suma a la del metodo contenedor (no se separan). Operadores `??`/`match` (PHP 8) no se cuentan en v1.

## Comportamiento del analizador (`phpComplexityAnalyzer`)

Por cada `PhpFileStructure`, por cada metodo (de clases, traits o funciones sueltas):

- Si `(endLine - startLine + 1) > thresholds.methodLines`: finding `category: "complexity"`, `rule: "long-method"`, `severity: "medium"`.
- Si `parametersCount > thresholds.parameters`: finding `rule: "too-many-parameters"`, `severity: "medium"`.
- Si `(decisionPointsCount + 1) > thresholds.cyclomaticComplexity`: finding `rule: "high-cyclomatic-complexity"`, `severity: "high"`.

Por cada clase/trait:

- Si `(endLine - startLine + 1) > thresholds.classLines`: finding `rule: "large-class"`, `severity: "medium"`.

Cada finding usa `source: "native"`, `file` (de `PhpFileStructure.file`), `line` (la `startLine` del metodo/clase), `module: ""` (Audit en esta fase no conoce el modulo logico al que pertenece el archivo; se completa cuando se integre con el escaneo real en `presentation`), y `details` con las metricas relevantes (`{ lines }`, `{ parametersCount }` o `{ cyclomaticComplexity }` segun la regla).

## Salidas

`AuditFinding[]`, uno por regla de umbral excedida (un metodo puede generar varios findings si excede mas de un umbral).

## Casos invalidos o de borde

- Un archivo sin clases ni funciones (`classes: []`, `functions: []`) no genera findings.
- Un metodo o clase exactamente en el umbral (`lines === threshold`) no genera finding; solo al superarlo (`>`).
- Codigo PHP invalido: `PhpAstParser.parse` puede lanzar un error de `php-parser`; no se captura aqui, queda para quien orquesta (`presentation`) decidir como reportarlo por archivo.

## Criterios de Aceptacion

- Un metodo con mas lineas que `methodLines` genera exactamente un finding `long-method`.
- Un metodo con mas parametros que `parameters` genera un finding `too-many-parameters`.
- Un metodo cuyo `decisionPointsCount + 1` supera `cyclomaticComplexity` genera un finding `high-cyclomatic-complexity`.
- Una clase con mas lineas que `classLines` genera un finding `large-class`, independientemente de sus metodos.
- Un metodo que excede dos umbrales a la vez (por ejemplo largo y con muchos parametros) genera dos findings independientes.
- `PhpAstParser.parse` sobre una clase con un metodo que tiene `if/elseif/else`, un `for` anidado y un `&&` calcula `decisionPointsCount` igual a la suma de esos nodos (el `if` y su `elseif` cuentan cada uno, el `else` no cuenta).
