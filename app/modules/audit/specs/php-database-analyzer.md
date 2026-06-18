# PHP Database Analyzer

## Objetivo

Quinto analizador nativo de Audit (Fase 6 de `docs/audit.md`): heuristicas sobre el uso de SQL crudo en el codigo PHP escaneado. Genera `AuditFinding` de categoria `database` para tres patrones: queries dentro de un loop (posible N+1), SQL crudo fuera de la capa de infraestructura, y SQL duplicado entre distintos puntos del codigo.

Mismo nivel de certeza que `dead_code`/`security`: heuristicas basadas en texto y AST, no verifican el comportamiento real en tiempo de ejecucion. Los mensajes piden verificar antes de actuar.

## Extension de `PhpFileStructure`

`PhpFileStructure` gana un campo nuevo:

- `sqlLiterals: PhpSqlLiteral[]`, con `PhpSqlLiteral = { value: string; line: number; insideLoop: boolean }`.

`PhpAstParser` recorre el archivo completo (igual que para `referencedNames`/`securityIssues`) buscando nodos `string` cuyo valor parece SQL: contiene alguna palabra clave de la misma lista que ya usa `sql-concatenation` en `php-security-analyzer.md` (`select`, `insert`, `update`, `delete`, `where`, `from`, `join`, sin distinguir mayusculas/minusculas). Por cada uno, guarda el valor (recortado de espacios), la linea, y si el nodo esta dentro del body de un `for`/`foreach`/`while`/`do` en cualquier nivel de anidamiento (`insideLoop`).

Limitacion conocida y aceptada: palabras como "select"/"where"/"from"/"update" tambien aparecen en texto en ingles no relacionado con SQL (por ejemplo, mensajes de UI). Esto puede producir falsos positivos; los mensajes de los findings de esta categoria piden verificar antes de actuar, igual que `dead_code`.

## Comportamiento del analizador (`phpDatabaseAnalyzer`)

- `phpDatabaseAnalyzer(files: PhpFileStructure[]): AuditFinding[]`. Sin thresholds numericos configurables.
- **`n-plus-one-query`** (severidad `high`): por cada `PhpSqlLiteral` con `insideLoop: true`, en cualquier archivo.
- **`raw-sql-outside-infrastructure`** (severidad `medium`): por cada `PhpSqlLiteral` cuyo archivo (`file.file`, ruta completa) no contiene la palabra `infrastructure` (sin distinguir mayusculas/minusculas). Es una heuristica de ruta, no usa la configuracion de capas de `architecture`: Audit no debe depender de detalles internos de otro modulo (ver `docs/audit.md`).
- **`duplicate-sql`** (severidad `low`): se agrupan todos los `sqlLiterals` de todos los archivos por `value` exacto (ya recortado de espacios). Cada literal cuyo `value` aparece 2 o mas veces en el conjunto completo genera un finding, uno por cada ocurrencia (no solo la segunda en adelante).
- Un mismo `PhpSqlLiteral` puede generar mas de un finding si dispara mas de una regla (por ejemplo, estar dentro de un loop y tambien fuera de infraestructura). Es el mismo comportamiento que ya tienen `phpComplexityAnalyzer`/`phpCouplingAnalyzer` para un metodo que excede varios umbrales.
- Cada finding usa `category: "database"`, `source: "native"`, `module: ""`, `details: { value }` (el texto del literal SQL detectado).

## Salidas

`AuditFinding[]`, uno por cada combinacion de `PhpSqlLiteral` y regla que aplique.

## Casos invalidos o de borde

- Un archivo sin ningun string con palabra clave SQL no genera findings.
- Un literal SQL dentro de un archivo cuya ruta contiene `Infrastructure`/`infrastructure` no genera `raw-sql-outside-infrastructure`.
- Un literal SQL que aparece una sola vez en todo el conjunto escaneado no genera `duplicate-sql`.
- Un literal SQL fuera de cualquier loop no genera `n-plus-one-query`.
- Anidamiento de loops (`for` dentro de `foreach`, etc.): cualquier literal dentro del loop mas interno o externo cuenta igual como `insideLoop: true`.

## Criterios de Aceptacion

- Un string con palabra clave SQL dentro de un `foreach`/`for`/`while`/`do` genera `n-plus-one-query`.
- El mismo string fuera de cualquier loop no genera `n-plus-one-query`.
- Un string con palabra clave SQL en un archivo sin "infrastructure" en la ruta genera `raw-sql-outside-infrastructure`; el mismo string en `App/Modules/Foo/Infrastructure/Persistence/Repo.php` no.
- Dos archivos distintos con el mismo string SQL exacto generan `duplicate-sql` en ambas ocurrencias (dos findings, uno por archivo).
- El mismo string SQL repetido tres veces genera tres findings `duplicate-sql` (uno por ocurrencia), no uno solo.
- Un string SQL unico en todo el conjunto no genera `duplicate-sql`.

## Notas de implementacion

- `phpDatabaseAnalyzer` vive en `app/modules/audit/application/analyzers/phpDatabaseAnalyzer.ts`. A diferencia de `phpComplexityAnalyzer`/`phpCouplingAnalyzer` (por archivo) y como `phpDeadCodeAnalyzer` (necesita vista global para `duplicate-sql`), recibe el arreglo completo de `PhpFileStructure[]`.
- La deteccion de palabra clave SQL en un string (`hasSqlKeyword`) se extrae como helper compartido en `PhpAstParser`, reutilizado tanto por `sql-concatenation` (Fase 5) como por la recoleccion de `sqlLiterals` (esta fase), para no duplicar la lista de keywords en dos lugares.
- En `bin/chango-archscope.mjs`, el comando `audit` agrega `phpDatabaseAnalyzer(phpFiles)` a la lista de analizadores nativos.
