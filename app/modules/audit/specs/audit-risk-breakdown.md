# Audit Risk Breakdown

## Objetivo

Fase 8 (la ultima) de Audit, segun `docs/audit.md`: agregar todos los `AuditFinding` ya producidos por las fases 1 a 7 en un `RiskScore` desagregado por archivo, por clase y por modulo, mas un ranking de los archivos mas riesgosos. No agrega analizadores nuevos: solo agrega los findings que ya existen, de una forma distinta a como ya lo hace `buildAuditSnapshot` (que solo agrega por categoria, a nivel global).

Aqui termina el alcance de Audit. Decidir que tocar primero a partir de este resultado es trabajo de un futuro `Planning` (ver `docs/methodology.md`), no de Audit.

## Extension de `AuditFinding`

`AuditFinding` (en `app/modules/audit/domain/value-objects/AuditSnapshot.ts`) gana un campo nuevo:

- `class: string | null`: el nombre de la clase a la que pertenece el finding, cuando se puede determinar. `null` cuando el finding no esta asociado a una clase (una funcion suelta, o un finding cuyo analizador no rastrea contexto de clase).

Cobertura de `class` por analizador:

| Fuente | Pobla `class` |
| --- | --- |
| `architectureFindings` (Fase 1) | No, siempre `null`. `ArchitectureIssue` no trae nombre de clase, solo modulo/capa. |
| `phpComplexityAnalyzer` (Fase 2) | Si, para metodos de clase. `null` para funciones sueltas. |
| `phpCouplingAnalyzer` (Fase 3) | Si, para metodos de clase. `null` para funciones sueltas. |
| `phpDeadCodeAnalyzer` (Fase 4) | Si, para `possibly-unused-class`/`possibly-unused-method`. `null` para `possibly-unused-function`. |
| `phpSecurityAnalyzer` (Fase 5) | No, siempre `null`. `PhpSecurityIssue` no rastrea en que clase ocurre. |
| `phpDatabaseAnalyzer` (Fase 6) | No, siempre `null`. `PhpSqlLiteral` no rastrea en que clase ocurre. |
| `phpTestingAnalyzer` (Fase 7) | Si, para `untested-class`/`untested-complex-method`. |

Limitacion conocida y aceptada: `security` y `database` no participan de "Score por clase" en esta fase. Si se necesita en el futuro, requiere extender `PhpAstParser` para rastrear la clase contenedora durante el recorrido de `securityIssues`/`sqlLiterals` (mismo costo que ya se evaluo y se dejo pendiente para Fase 7).

## `buildRiskBreakdown`

Funcion pura nueva en `app/modules/audit/domain/services/auditRiskBreakdown.ts`: `buildRiskBreakdown(findings: AuditFinding[], phpRoot?: string): AuditRiskBreakdown`.

```text
type RiskEntry = {
  key: string;
  value: number;
  byCategory: Record<string, number>;
  findingsCount: number;
};

type AuditRiskBreakdown = {
  byFile: RiskEntry[];
  byClass: RiskEntry[];
  byModule: RiskEntry[];
  topRiskiestFiles: RiskEntry[];
};
```

- Cada `RiskEntry.value` y `byCategory` se calculan con el mismo esquema de pesos por severidad que ya usa `buildAuditSnapshot` (`low: 1, medium: 2, high: 3, critical: 4`), agregado por `category` igual que el `riskScore` global.
- `byFile`: agrupa por `finding.file`. `key` es la ruta del archivo.
- `byClass`: agrupa por `finding.class`, ignorando findings con `class: null`. `key` es `"{file}#{class}"` (no solo el nombre de la clase), para no mezclar dos clases con el mismo nombre en archivos distintos.
- `byModule`: agrupa por modulo. Si `finding.module` no es `""`, se usa tal cual (ya viene resuelto, por ejemplo de `architectureFindings`). Si es `""` (el caso de todos los findings nativos de PHP hasta ahora) y se recibio `phpRoot`, el modulo se deriva como el primer segmento de la ruta del archivo relativa a `phpRoot` (`path.relative(phpRoot, file).split(path.sep)[0]`). Si es `""` y no hay `phpRoot`, el finding se ignora para esta dimension (no se puede determinar el modulo).
- `topRiskiestFiles`: los primeros 20 elementos de `byFile`, ya ordenado de mayor a menor `value`.
- `byFile`/`byClass`/`byModule` se devuelven ordenados de mayor a menor `value` (no solo el top de archivos).

## Integracion con `buildAuditSnapshot`

`AuditSnapshot` gana un campo nuevo: `riskBreakdown: AuditRiskBreakdown`.

`buildAuditSnapshot(findings, context)` ahora tambien llama a `buildRiskBreakdown(findings, context.phpRoot)` y lo agrega al snapshot. `AuditSnapshotContext` gana un campo opcional `phpRoot?: string`. Esto no cambia el comportamiento de `runAudit` (que llama a `buildAuditSnapshot` sin `phpRoot`, ya que `architectureFindings` siempre trae `module` resuelto y nunca `class`): sus criterios de aceptacion existentes (`run-audit.md`) siguen aplicando sin cambios; solo se agrega el campo nuevo al snapshot.

En `bin/chango-archscope.mjs`, el comando `audit` pasa `phpRoot: config.laravel.modulesPath` cuando `target === "laravel"`.

## Casos invalidos o de borde

- Un conjunto de findings vacio produce `{ byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] }`.
- Menos de 20 archivos con findings: `topRiskiestFiles` trae todos, no rellena hasta 20.
- Dos clases con el mismo nombre en archivos distintos generan dos entradas separadas en `byClass` (no se suman).
- Un finding con `module: ""` y sin `phpRoot` no aparece en `byModule`, pero si en `byFile` y (si aplica) `byClass`.
- `phpRoot` no necesita coincidir exactamente con el prefijo de cada `file` (por ejemplo, findings de `architecture` con rutas relativas distintas): si `finding.module` ya viene resuelto (no vacio), `phpRoot` no se usa para ese finding.

## Criterios de Aceptacion

- `byFile` agrega correctamente el `value` y `byCategory` de todos los findings de un mismo archivo.
- `byClass` no mezcla dos clases del mismo nombre en archivos distintos.
- `byModule` deriva el modulo desde la ruta relativa a `phpRoot` cuando `finding.module` es `""`.
- `topRiskiestFiles` tiene como maximo 20 elementos y esta ordenado de mayor a menor `value`.
- El `AuditSnapshot` que ya devuelve `runAudit(checkResult)` sigue pasando todos los criterios de aceptacion de `run-audit.md` sin cambios, ahora con `riskBreakdown` ademas.

## Notas de implementacion

- `buildRiskBreakdown` reutiliza el mapa de pesos por severidad (`SEVERITY_WEIGHTS`) ya definido en `auditSnapshotBuilder.ts`; se exporta desde ahi para no duplicarlo.
- Usar `node:path` dentro de un servicio de `domain` para manipulacion pura de strings de ruta (sin tocar el sistema de archivos real) ya es un patron existente en el repo (`architecturePathUtils.ts`).
- Restructurar `phpComplexityAnalyzer.ts`/`phpCouplingAnalyzer.ts`: hoy hacen `[...file.classes.flatMap(c => c.methods), ...file.functions]` para procesar metodos de clase y funciones sueltas juntos, perdiendo el contexto de clase. Pasan a procesar clases y funciones por separado, pasando el nombre de la clase (o `null`) a la construccion del finding.
