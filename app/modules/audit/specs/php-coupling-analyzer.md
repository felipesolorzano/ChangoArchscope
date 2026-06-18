# PHP Coupling Analyzer

## Objetivo

Segundo analizador nativo de Audit (Fase 3 de `docs/audit.md`): a partir del mismo AST que ya usa el analizador de complejidad, detectar senales de acoplamiento de bajo nivel (instanciacion directa, llamadas estaticas, dependencia de singletons, acceso a estado global) y generar `AuditFinding` de categoria `coupling_low_level`.

## Entradas

- `PhpFileStructure` (extendido, ver abajo).
- `phpCouplingAnalyzer(structures: PhpFileStructure[], thresholds?: PhpCouplingThresholds): AuditFinding[]`.
- `PhpCouplingThresholds`: `{ directInstantiations: 3, staticCalls: 3 }` (default fijo en v1).

## Extension de `PhpMethodStructure`

`PhpMethodStructure` (en `app/modules/audit/domain/value-objects/PhpFileStructure.ts`) gana cuatro campos, calculados por `PhpAstParser` durante el mismo recorrido que ya hace `decisionPointsCount`:

- `directInstantiationsCount`: numero de nodos `new` cuyo `what` es un `name` (clase conocida estaticamente). No cuenta `new $variable()` (instanciacion dinamica, limitacion conocida).
- `staticCallsCount`: numero de nodos `call` cuyo `what` es un `staticlookup` (cualquier `Clase::metodo()`), sin importar el nombre del metodo.
- `singletonAccessCount`: subconjunto de los anteriores donde el nombre del metodo (`what.offset.name`) es exactamente `getInstance` (sin distinguir mayusculas/minusculas).
- `globalAccessCount`: suma de declaraciones `global $x;` (cada nodo `global` cuenta como 1, sin importar cuantas variables liste) mas referencias a variables superglobales (`$_SERVER`, `$_GET`, `$_POST`, `$_REQUEST`, `$_COOKIE`, `$_FILES`, `$_ENV`, `$_SESSION`, `$GLOBALS`) en cualquier parte del cuerpo.

## Comportamiento del analizador (`phpCouplingAnalyzer`)

Por cada metodo (de clases, traits o funciones sueltas):

- Si `directInstantiationsCount > thresholds.directInstantiations`: finding `category: "coupling_low_level"`, `rule: "direct-instantiation"`, `severity: "medium"`, `details: { directInstantiationsCount }`.
- Si `staticCallsCount > thresholds.staticCalls`: finding `rule: "static-coupling"`, `severity: "medium"`, `details: { staticCallsCount }`.
- Si `singletonAccessCount > 0`: finding `rule: "singleton-dependency"`, `severity: "medium"`, `details: { singletonAccessCount }`. No usa umbral: una sola dependencia a un singleton ya es la senal.
- Si `globalAccessCount > 0`: finding `rule: "global-state-access"`, `severity: "medium"`, `details: { globalAccessCount }`. Tampoco usa umbral.

Un metodo puede generar varios findings independientes (igual que en `phpComplexityAnalyzer`). `module: ""` y `source: "native"`, igual que el resto de findings nativos.

## Salidas

`AuditFinding[]`, uno por regla de umbral excedida o senal detectada.

## Casos invalidos o de borde

- Un archivo sin clases ni funciones no genera findings.
- Un metodo con `directInstantiationsCount`/`staticCallsCount` exactamente en el umbral no genera finding (regla `>`, no `>=`).
- `new $variable()` (instanciacion dinamica) no incrementa `directInstantiationsCount`.
- Un `Clase::metodo()` cuyo metodo no es `getInstance` incrementa `staticCallsCount` pero no `singletonAccessCount`.

## Criterios de Aceptacion

- Un metodo con mas instanciaciones directas que el umbral genera `direct-instantiation`.
- Un metodo con mas llamadas estaticas que el umbral genera `static-coupling`.
- Un metodo con al menos una llamada a `Clase::getInstance()` genera `singleton-dependency`, sin importar el umbral de `staticCalls`.
- Un metodo con `global $x;` o que referencia `$_SERVER`/`$GLOBALS`/etc. genera `global-state-access`.
- Un metodo que dispara las cuatro reglas a la vez genera cuatro findings independientes.
- `PhpAstParser.parse` sobre un metodo con dos `new Foo()`, un `Bar::baz()`, un `Singleton::getInstance()` y un `global $x;` calcula `directInstantiationsCount: 2`, `staticCallsCount: 2`, `singletonAccessCount: 1`, `globalAccessCount: 1`.

## Notas de implementacion

- `phpCouplingAnalyzer` vive en `app/modules/audit/application/analyzers/phpCouplingAnalyzer.ts`, mismo patron que `phpComplexityAnalyzer.ts`.
- El escaneo de archivos PHP (`reader.walkFiles` + `parser.parse`) se separa en un caso de uso propio, `scanPhpFiles` (`app/modules/audit/application/use-cases/ScanPhpFiles.ts`), reemplazando a `scanPhpComplexity`: ahora solo escanea y parsea, sin analizar, para que el comando `audit` pueda correr varios analizadores nativos sobre el mismo `PhpFileStructure[]` sin parsear los archivos mas de una vez. Ver `audit-cli.md` para el nuevo flujo del comando.
