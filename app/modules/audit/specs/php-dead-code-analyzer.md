# PHP Dead Code Analyzer

## Objetivo

Tercer analizador nativo de Audit (Fase 4 de `docs/audit.md`): detectar funciones, metodos y clases declarados que nunca aparecen referenciados en el conjunto de archivos escaneado, y generar `AuditFinding` de categoria `dead_code`. A diferencia de `complexity` y `coupling_low_level`, este analizador necesita una vista global (todos los archivos a la vez), no solo por archivo o por metodo.

Esta es, por diseño, la categoria menos confiable del catalogo (ver `docs/audit.md`, seccion "Limites reales"): todo finding se marca como posible, nunca como certeza, y la severidad siempre es `low`.

## Entradas

- `PhpFileStructure[]` (extendido, ver abajo).
- `phpDeadCodeAnalyzer(files: PhpFileStructure[]): AuditFinding[]`. Sin thresholds: la regla es presencia/ausencia, no un umbral numerico.

## Extension de `PhpFileStructure`

`PhpFileStructure` gana un campo nuevo, calculado por `PhpAstParser` recorriendo el archivo completo (no solo los cuerpos de metodo):

- `referencedNames: string[]`: nombres que aparecen como referencia/uso en cualquier parte del archivo. Incluye:
  - Cualquier nodo `name` (cubre `new Clase()`, `extends Clase`, `implements Clase`, el lado de clase de un `Clase::algo`, llamadas a funcion por nombre literal `helper()`, type hints de parametros/retorno, `instanceof Clase`, el tipo de un `catch (Excepcion $e)`).
  - El `offset` (nombre de metodo) de cualquier `propertylookup` o `staticlookup` cuando ese `offset` es un `identifier` (cubre `$obj->metodo()` y el lado de metodo de `Clase::metodo()`). No cubre llamadas dinamicas (`$obj->$metodoVariable()`).
- Los nombres de declaracion (el `identifier` propio de una clase, metodo o funcion en el momento de declararse) nunca se cuentan como referencia: `php-parser` usa `name` solo del lado de uso y `identifier` solo aparece como referencia dentro de `propertylookup`/`staticlookup`, nunca en la declaracion misma.

## Comportamiento del analizador (`phpDeadCodeAnalyzer`)

- Construye un `Set<string>` global uniendo `referencedNames` de todos los `PhpFileStructure` recibidos.
- Por cada funcion suelta (`file.functions`): si su nombre no esta en el set global y no es un metodo magico (ver abajo), genera `category: "dead_code"`, `rule: "possibly-unused-function"`, `severity: "low"`, `details: { name }`.
- Por cada clase (`file.classes`): si su nombre no esta en el set global, genera `rule: "possibly-unused-class"`, `severity: "low"`, `details: { name }`.
- Por cada metodo de cada clase: si su nombre no esta en el set global y no es un metodo magico, genera `rule: "possibly-unused-method"`, `severity: "low"`, `details: { name }`.
- Metodo magico: cualquier nombre que empiece con `__` (`__construct`, `__toString`, `__invoke`, etc.). PHP los invoca implicitamente; nunca apareceran como referencia explicita y excluirlos evita falsos positivos sistematicos.
- Todos los findings usan `source: "native"`, `module: ""`, igual que el resto de findings nativos. `file`/`line` son los del simbolo declarado (no de ninguna referencia).

## Salidas

`AuditFinding[]`, uno por simbolo (funcion, clase o metodo) sin referencias encontradas.

## Limites (especificos de este analizador, ademas de los generales de `docs/audit.md`)

- Si el codigo que SI usa un simbolo vive fuera del `phpRoot` escaneado (por ejemplo, rutas web, vistas, o un proyecto que llama a este codigo desde otro lado), el simbolo se marca igual como posible no usado: es un falso positivo conocido, no un bug.
- Llamadas dinamicas (`$metodo = "procesar"; $obj->$metodo()`, `call_user_func`, `Closure::fromCallable`, reflection) no se detectan como uso: pueden producir falsos positivos.
- Un metodo con el mismo nombre en dos clases distintas comparte la misma entrada en el set global de referencias: si una clase usa `procesar()` y otra clase tiene un metodo `procesar()` nunca llamado, este analizador no los distingue y no marca el segundo como posible no usado (falso negativo, no falso positivo: es la direccion de error preferida para esta categoria).

## Criterios de Aceptacion

- Una funcion declarada que nunca se llama en ningun archivo genera `possibly-unused-function`.
- Una funcion llamada desde otro archivo del mismo conjunto escaneado no genera finding.
- Una clase nunca instanciada, extendida, implementada ni referenciada por tipo genera `possibly-unused-class`; una clase usada en cualquiera de esas formas no genera finding.
- Un metodo de instancia llamado como `$obj->metodo()` en cualquier archivo del conjunto no genera finding.
- Un metodo estatico llamado como `Clase::metodo()` no genera finding.
- Ningun metodo magico (`__construct`, `__toString`, etc.) genera finding, sin importar si se llama explicitamente o no.

## Notas de implementacion

- `phpDeadCodeAnalyzer` vive en `app/modules/audit/application/analyzers/phpDeadCodeAnalyzer.ts`. A diferencia de `phpComplexityAnalyzer`/`phpCouplingAnalyzer` (que procesan archivo por archivo), este analizador recibe el arreglo completo y construye el set de referencias antes de evaluar cada archivo.
- La extraccion de `referencedNames` en `PhpAstParser` es un recorrido independiente del que ya hace `decisionPointsCount`/`directInstantiationsCount` (ese recorre solo el `body` de cada metodo; este recorre el archivo completo, incluyendo `extends`/`implements`/parametros/type hints que viven fuera del body).
- En `bin/chango-archscope.mjs`, el comando `audit` agrega `phpDeadCodeAnalyzer(phpFiles)` a la lista de analizadores nativos que corren sobre el resultado de `scanPhpFiles`, igual que `phpComplexityAnalyzer`/`phpCouplingAnalyzer`.
