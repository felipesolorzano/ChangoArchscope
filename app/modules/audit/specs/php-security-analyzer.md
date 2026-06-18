# PHP Security Analyzer

## Objetivo

Cuarto analizador nativo de Audit (Fase 5 de `docs/audit.md`): heuristicas de seguridad basica sobre el AST de PHP. Genera `AuditFinding` de categoria `security` para cuatro patrones: concatenacion de SQL, salida sin sanear de input de usuario, uso de `eval`, e `include`/`require` dinamico.

Igual que `dead_code`, son heuristicas explicitas: detectan el patron sintactico, no verifican el dato real en tiempo de ejecucion. Pueden generar falsos positivos (codigo seguro marcado) y falsos negativos (codigo inseguro no detectado, por ejemplo via variables intermedias o llamadas dinamicas). No reemplaza un SAST dedicado ni una revision manual.

## Extension de `PhpFileStructure`

`PhpFileStructure` gana un campo nuevo:

- `securityIssues: PhpSecurityIssue[]`, con `PhpSecurityIssue = { rule: "sql-concatenation" | "unsanitized-output" | "eval-usage" | "dynamic-include"; line: number }`.

A diferencia de `decisionPointsCount` (por metodo) y de `referencedNames` (por archivo), estos cuatro patrones pueden aparecer tanto dentro de metodos/funciones como en codigo de nivel superior (script PHP sin envoltura de clase/funcion, comun en proyectos legacy). Por eso `PhpAstParser` los calcula recorriendo el archivo completo, igual que `referencedNames`, no solo los `body` de metodo.

## Patrones detectados por `PhpAstParser`

- **`eval-usage`**: cualquier nodo `kind: "eval"` (en `php-parser`, `eval(...)` es una construccion del lenguaje con su propio kind, no un `call`).
- **`dynamic-include`**: cualquier nodo `kind: "include"` (cubre `include`, `include_once`, `require`, `require_once`) cuyo `target` no es un nodo `string` literal.
- **`sql-concatenation`**: un nodo `bin` con `type: "."` (operador de concatenacion) donde un lado es un `string` cuyo `value` contiene una palabra clave SQL (`select`, `insert`, `update`, `delete`, `where`, `from`, `join`, sin distinguir mayusculas/minusculas) y el otro lado no es un `string` literal (es una expresion dinamica). Aplica para cualquier orden de los operandos.
- **`unsanitized-output`**: un nodo `echo` o `print` cuya expresion contiene una referencia a `$_GET`, `$_POST`, `$_REQUEST` o `$_COOKIE` que no esta envuelta por ninguna llamada a funcion en el camino entre el `echo`/`print` y la referencia. Si hay al menos una llamada (`call`) de por medio (sea o no una funcion de saneamiento real), se asume "posiblemente procesado" y no se marca: prioriza menos falsos positivos sobre exhaustividad, igual que `dead_code`. `$_SERVER`, `$_SESSION`, `$_ENV`, `$_FILES` y `$GLOBALS` no se consideran "input de usuario directo" para esta regla.

## Comportamiento del analizador (`phpSecurityAnalyzer`)

- `phpSecurityAnalyzer(files: PhpFileStructure[]): AuditFinding[]`. Sin thresholds: cada `PhpSecurityIssue` detectado genera exactamente un `AuditFinding`.
- Mapeo de severidad fijo por regla:
  - `eval-usage` → `critical`.
  - `dynamic-include` → `high`.
  - `sql-concatenation` → `high`.
  - `unsanitized-output` → `medium`.
- Cada finding usa `category: "security"`, `source: "native"`, `module: ""`, `details: {}` (las reglas de esta categoria no traen metricas numericas, a diferencia de `complexity`/`coupling_low_level`).

## Salidas

`AuditFinding[]`, uno por cada `PhpSecurityIssue` de cada archivo.

## Casos invalidos o de borde

- Un `include`/`require` con un string literal directo (`include "config.php";`) no genera finding.
- Una concatenacion entre dos strings literales (sin variable de por medio) no genera `sql-concatenation`: no hay dato dinamico involucrado.
- Una concatenacion de SQL anidada (`"SELECT ... " . $a . " AND ... "`) puede generar mas de un finding si mas de un nivel de la cadena mezcla string-con-keyword y una expresion dinamica; es una limitacion aceptada, no un bug.
- `echo htmlspecialchars($_GET["x"]);` no genera `unsanitized-output` (la referencia esta envuelta en una llamada). `echo $_GET["x"];` si la genera.
- Un archivo sin ninguno de estos cuatro patrones no genera findings.

## Criterios de Aceptacion

- Un `eval($variable);` en cualquier parte del archivo (dentro o fuera de una funcion) genera `eval-usage` con severidad `critical`.
- Un `include $variable;` genera `dynamic-include`; un `include "ruta/fija.php";` no genera nada.
- `"SELECT * FROM tabla WHERE id = " . $id` genera `sql-concatenation`; `"SELECT * FROM tabla"` (sin concatenar nada) no genera nada.
- `echo $_POST["campo"];` genera `unsanitized-output`; `echo intval($_POST["campo"]);` no.
- Un archivo con los cuatro patrones genera cuatro findings, uno por regla.

## Notas de implementacion

- `phpSecurityAnalyzer` vive en `app/modules/audit/application/analyzers/phpSecurityAnalyzer.ts`. Es el analizador mas simple de los cuatro nativos: solo mapea `PhpSecurityIssue` a `AuditFinding` (rule -> severity -> message), sin logica de umbrales.
- La deteccion real (que es lo unico que necesita conocer la forma del AST de `php-parser`) vive en `PhpAstParser`, igual que `decisionPointsCount`/`referencedNames`.
- En `bin/chango-archscope.mjs`, el comando `audit` agrega `phpSecurityAnalyzer(phpFiles)` a la lista de analizadores nativos.
