# Audit

Este documento detalla el bounded context `Audit` definido en `methodology.md`. Ahi vive su responsabilidad de alto nivel y sus artefactos (`AuditRun`, `AuditFinding`, `AuditSnapshot`, `RiskScore`, `TechnicalDebtSignal`). Aqui se detalla que debe revisar, de donde saca cada dato y en que orden se construye.

## Proposito

Audit responde: "que tan sano o riesgoso esta el sistema antes de tocarlo?". Produce un diagnostico tecnico reproducible (`AuditSnapshot`), no decide que hacer con el (eso es trabajo de `Planning`, que todavia no existe en el repo).

Alcance v1: PHP. A diferencia de `architecture`, Audit no exige una estructura modular previa (`app/modules` o equivalente); debe poder escanear cualquier raiz PHP, modular o no, porque parte de su valor es encontrar candidatos a modulo en codigo que todavia no esta organizado.

## Limites reales

- No conoce la intencion de negocio si el codigo no la expresa.
- No puede asegurar que algo "no se usa" si hay reflection, includes dinamicos, rutas o cron jobs.
- No ejecuta el sistema, base de datos ni tests; todo el analisis es estatico.
- No detecta bugs de logica de negocio solo leyendo codigo.
- No decide prioridades de negocio.

Lo que si produce de forma confiable: mapa de riesgo, acoplamiento, complejidad, deuda tecnica y candidatos de modernizacion.

## Relacion con Architecture

Audit puede consumir `ArchitectureGraph` y el reporte de `checkArchitecture` (violations + couplings) como entrada, en vez de recalcular reglas de capas o acoplamiento entre modulos desde cero. Eso ya existe en `app/modules/architecture` y es la primera fuente de `AuditFinding`.

`SourceTreeReader` hoy vive dentro de `architecture` (`domain/repositories/SourceTreeReader.ts`, implementado por `NodeFsSourceTreeReader`). Antes de que `audit` lo necesite, se debe mover a `app/modules/shared` para que ambos modulos lo compartan sin que `audit` dependa de `architecture` directamente (la regla de `project-architecture.md` es que un modulo no accede a infraestructura interna de otro).

## Limite con Planning

Audit clasifica severidad e impacto tecnico y produce `RiskScore` / `TechnicalDebtSignal` por archivo, clase o modulo. Audit **no** decide que tocar primero, que congelar o que aislar — esa decision, con dependencias entre tareas y estrategia de migracion, es responsabilidad de `Planning` (bounded context futuro, todavia no creado). Las categorias de "Refactorizacion" del checklist original (que tocar primero, que congelar) quedan documentadas aqui como senal de entrada para `Planning`, no como salida de `Audit`.

## Categorias de finding (`AuditFinding.category`)

| Categoria | Que detecta | Fuente | Fase |
| --- | --- | --- | --- |
| `architecture_violation` | Capas que rompen reglas (Domain importando Infrastructure, etc.) | Consolidado desde `checkArchitecture` | 1 |
| `coupling_module` | Modulo que depende directamente de otro sin permiso | Consolidado desde `checkArchitecture` | 1 |
| `complexity` | Metodos largos, clases grandes, demasiados parametros, complejidad ciclomatica | Analizador nativo (AST PHP) | 2 |
| `coupling_low_level` | `new` directo, llamadas estaticas, singletons, helpers/globals | Analizador nativo (AST PHP) | 3 |
| `dead_code` | Metodos/clases publicas sin referencias encontradas (heuristico, nunca certeza) | Analizador nativo (AST PHP) | 4 |
| `security` | SQL concatenado, inputs sin sanitizar, `eval`, include dinamico | Analizador nativo (heuristicas sobre AST) | 5 |
| `database` | SQL crudo disperso o duplicado, queries dentro de loops (N+1 heuristico) | Analizador nativo (heuristicas sobre AST) | 6 |
| `testing` | Existencia de tests, proxy de cobertura, flujos criticos sin test | Analizador nativo | 7 |
| `php_compatibility` | Incompatibilidades con una version objetivo de PHP (funciones removidas, deprecaciones, sintaxis) | Herramienta externa (`phpcs` + `PHPCompatibility` en Docker) | 8 |

La Fase 8 introduce la primera fuente `external` de `AuditFinding`. A diferencia de las Fases 2-7, su deteccion no la hace el AST de `php-parser` en JS puro, sino `PHPCompatibility` (un estandar de `PHP_CodeSniffer`) corriendo dentro de un contenedor Docker aislado, con el repo montado en solo lectura. Sigue siendo analisis estatico (no levanta la app ni la base de datos), pero rompe la invariante "sin requerir PHP instalado" de "Parsing PHP": requiere Docker en la maquina que corre Archscope. La ruptura se justifica porque la compatibilidad de version se basa en reglas reales y exhaustivas del ecosistema PHP que no tiene sentido reimplementar como heuristicas, y se mitiga con degradacion elegante: si Docker no esta disponible, esta categoria se marca como no ejecutada y el resto del audit corre completo. Detalle en `app/modules/audit/specs/php-compatibility-analyzer.md`.

## Artefactos de dominio

- `AuditRun`: `id`, `target`, `startedAt`, `finishedAt`, configuracion usada.
- `AuditFinding`: `category`, `rule`, `severity` (`low`/`medium`/`high`/`critical`), `file`, `line`, `module?`, `class?`, `method?`, `message`, `suggestion`, `metric?`, `details?` (datos especificos de la fuente, como `target_module`/`assessment`/`recommendation`/`action` cuando `source` es `architecture` y el finding viene de un coupling), `source` (`architecture` | `native`).
- `AuditSnapshot`: `generatedAt`, `target`, `module` (filtro heredado del check, o `null`), `summary` (conteos por categoria/severidad), `findings[]`, `riskScore`.
- `RiskScore`: valor agregado + desglose por categoria.
- `TechnicalDebtSignal`: `file`/`module`, score, categorias que mas contribuyen.

## Parsing PHP

Los analizadores nativos (fase 2 en adelante) usan un AST real via la libreria `php-parser` (JS puro, sin requerir PHP instalado), en vez de heuristicas regex. Justificacion: complejidad ciclomatica, deteccion de `new`, llamadas estaticas y duplicacion son fragiles con regex (strings con llaves, heredocs, comentarios, nesting). Esto es distinto de `phpImports.ts`, que se queda en regex porque su tarea (extraer `use` statements) es simple y estable.

Puerto de dominio (tentativo): `PhpSourceParser` en `app/modules/audit/domain/repositories/`. Implementacion real: `app/modules/audit/infrastructure/parser/PhpAstParser.ts`, envolviendo `php-parser`.

## CLI y salida

Nuevo comando, mismo patron que `graph`/`check`:

```bash
npx chango-archscope audit --target php
```

Salida JSON con forma similar a `check.json`:

```json
{
  "audited_at": "2026-01-01T00:00:00.000Z",
  "target": "php",
  "summary": {
    "files_scanned": 120,
    "findings_count": 18,
    "by_severity": { "low": 10, "medium": 6, "high": 2, "critical": 0 }
  },
  "risk_score": { "value": 34, "breakdown": { "complexity": 20, "coupling_low_level": 14 } },
  "findings": []
}
```

Exit code `1` si hay findings con severidad igual o mayor a un umbral configurable (default `high`), igual que `check` falla por `failOnCoupling`.

## Roadmap por fases

| Fase | Contenido | Requiere AST | Estado |
| --- | --- | --- | --- |
| 0 | Specs de Fase 1 en `app/modules/audit/specs/` (obligatorio por `development-rules.md` antes de cualquier test o codigo) | No | Completa |
| 1 | `RunAudit` que consolida `checkArchitecture` en `AuditSnapshot`, mas el comando CLI `audit` (umbral de severidad via `exceedsSeverityThreshold`) | No | Completa |
| 2 | `PhpAstParser` + analizador de `complexity` (metodos largos, clases grandes, parametros, complejidad ciclomatica), integrado al comando `audit` | Si | Completa |
| 3 | Analizador de `coupling_low_level` (`new` directo, estaticos, singletons, helpers/globals), integrado al comando `audit` | Si | Completa |
| 4 | Analizador de `dead_code` (heuristico, marcado explicitamente como "posible", nunca como certeza), integrado al comando `audit` | Si | Completa |
| 5 | Analizador de `security` (heuristicas: SQL concatenado, inputs sin sanitizar, `eval`, include dinamico), integrado al comando `audit` | Si | Completa |
| 6 | Analizador de `database` (SQL duplicado, SQL crudo fuera de infraestructura, N+1 heuristico), integrado al comando `audit` | Si | Completa |
| 7 | Analizador de `testing` (deteccion PHPUnit, proxy de cobertura, flujos criticos sin test), integrado al comando `audit` | Si | Completa |
| 8 | Agregacion final: `RiskScore` compuesto y `TechnicalDebtSignal` por archivo/clase/modulo. Limite con `Planning`: aqui termina Audit. | No (solo agrega lo de fases previas) | Completa |

## Estado: Audit completo

Las 8 fases planeadas en este roadmap estan completas. El comando `chango-archscope audit` integra todo de punta a punta: para `--target laravel`, escanea los `.php` reales una sola vez con `scanPhpFiles` (`SourceTreeReader` + `PhpAstParser`) y corre sobre ese mismo resultado `phpComplexityAnalyzer`, `phpCouplingAnalyzer`, `phpDeadCodeAnalyzer`, `phpSecurityAnalyzer`, `phpDatabaseAnalyzer` y `phpTestingAnalyzer`, combinando sus findings con los de `architectureFindings(checkResult)` en un solo `AuditSnapshot` armado por `buildAuditSnapshot`, que ademas calcula `riskBreakdown` (Fase 8: score por archivo, por clase, por modulo, y el top 20 de archivos mas riesgosos). Para `--target react` no hay findings nativos todavia. Todo con tests y mutation testing en 100% (varios mutantes equivalentes justificados, documentados inline con `// Stryker disable`).

Validado manualmente contra un proyecto PHP legacy real (fuera de este repo, configurado con `modulesPath` absoluto):

- 3 metodos largos reales (`complexity`).
- 3 metodos posiblemente sin uso reales (`dead_code`): `clean`, `fixCodeState`, `getId_StateByCode`.
- 3 `include`/`require` con ruta dinamica reales (`security`, regla `dynamic-include`).
- 3 queries reales dentro de loops (`database`, regla `n-plus-one-query`), SQL duplicado real entre dos archivos con el mismo contenido (literalmente el mismo script en `lib/Classes/` y en `scripts/`), y un falso positivo esperado (`"Error while update an Agent"` matcheo por contener "update") que confirma la limitacion ya documentada de la categoria.
- Todas las clases reales del proyecto marcadas `untested-class` (no usa PHPUnit), con `untested-complex-method` para sus metodos con logica real, incluyendo `fixCodeState` y `getId_StateByCode`: los mismos metodos que `dead_code` ya marco como posiblemente sin uso, confirmados independientemente como de alto riesgo por dos analizadores distintos.
- `riskBreakdown.topRiskiestFiles` ordeno correctamente los 3 archivos con findings por `value` descendente; `byModule` separo "scripts" y "lib" (los subdirectorios reales bajo el `modulesPath` configurado); `byClass` no mezclo las dos clases distintas llamadas igual (`MSBatchImport_EuroTours`, una en `lib/Classes/` y otra en `scripts/`, ambas con entradas separadas gracias a la clave `archivo#clase`).

Y contra snippets sinteticos: las 4 reglas de `coupling_low_level` (`new`/`Cache::`/`Auth::`/`Singleton::getInstance()`/`global`) disparan correctamente.

`SourceTreeReader`/`NodeFsSourceTreeReader` se movieron de `architecture` a `shared` como prerequisito de Fase 2. `RunAudit` se refactorizo internamente (separando `architectureFindings` del calculo de `summary`/`riskScore`, ahora en `buildAuditSnapshot`) sin cambiar su contrato publico ni su spec. `scanPhpComplexity` (Fase 2) se reemplazo por `scanPhpFiles` (solo escanea y parsea, sin analizar) para que Fases 3 a 7 pudieran agregar mas analizadores nativos sin parsear los archivos mas de una vez.

`PhpMethodStructure` incluye `directInstantiationsCount`, `staticCallsCount`, `singletonAccessCount` y `globalAccessCount` (Fase 3). `PhpClassStructure` incluye `extendsName: string | null` (Fase 7). `PhpFileStructure` incluye `referencedNames: string[]` (Fase 4), `securityIssues: PhpSecurityIssue[]` (Fase 5) y `sqlLiterals: PhpSqlLiteral[]` (Fase 6), todos recorridos independientes del archivo completo (no solo los `body` de metodo, ya que codigo de nivel superior sin envoltura de funcion/clase tambien puede tener estos patrones). `hasSqlKeyword` (la lista de keywords SQL) se comparte entre `sql-concatenation` (Fase 5) y la recoleccion de `sqlLiterals` (Fase 6).

A diferencia de `complexity`/`coupling_low_level`/`dead_code`, `phpSecurityAnalyzer`, `phpDatabaseAnalyzer` y `phpTestingAnalyzer` no tienen logica de umbrales numericos configurables: cada issue detectado por `PhpAstParser` (o, en el caso de `testing`, la ausencia de referencia cruzada) mapea a un `AuditFinding` con severidad fija por regla (`eval-usage` -> `critical`; `dynamic-include`/`sql-concatenation`/`n-plus-one-query`/`untested-complex-method` -> `high`; `unsanitized-output`/`raw-sql-outside-infrastructure`/`untested-class` -> `medium`; `duplicate-sql` -> `low`).

"Flujos criticos sin test" en sentido estricto (cruzar criticidad de negocio real con falta de test) queda fuera de alcance de Audit: por diseño, Audit no decide prioridades de negocio. `untested-complex-method` es la aproximacion que si cabe dentro de Audit (sin logica = bajo riesgo aunque no tenga test; con logica y sin test = la señal mas fuerte que Audit puede dar solo).

### Fase 8: detalle

`AuditFinding` gano un campo `class: string | null`, poblado por `phpComplexityAnalyzer`, `phpCouplingAnalyzer`, `phpDeadCodeAnalyzer` y `phpTestingAnalyzer` (los cuatro que ya tenian contexto de clase disponible); `architectureFindings`, `phpSecurityAnalyzer` y `phpDatabaseAnalyzer` siempre traen `class: null` (limitacion conocida y aceptada, documentada en `audit-risk-breakdown.md`: rastrear la clase contenedora en `securityIssues`/`sqlLiterals` requeriria el mismo costo que ya se evaluo y se dejo pendiente para Fase 7).

`AuditSnapshot.riskBreakdown` (nuevo) agrega `byFile`, `byClass`, `byModule` y `topRiskiestFiles` (maximo 20, ordenado descendente), calculado por `buildRiskBreakdown` (`app/modules/audit/domain/services/auditRiskBreakdown.ts`). `byClass` usa `archivo#clase` como clave para no mezclar clases con el mismo nombre en archivos distintos. `byModule` deriva el modulo desde la ruta del archivo relativa a `phpRoot` cuando `finding.module` viene vacio (todos los findings nativos hasta ahora); usa `finding.module` tal cual cuando ya viene resuelto (los de `architecture`). `SEVERITY_WEIGHTS` se extrajo a su propio archivo (`auditSeverityWeights.ts`) para evitar un import circular entre `auditSnapshotBuilder.ts` y `auditRiskBreakdown.ts`.

Evaluado y descartado por costo/beneficio en esta sesion: extender Fase 7 (`testing`) con deteccion de Pest, carpetas `tests/`, tests vacios/debiles, exceso de mocks y tests que prueban implementacion en vez de comportamiento. Quedan documentados como pendientes de baja prioridad en `php-testing-analyzer.md`.

**Con esto, Audit cierra su alcance.** Lo que sigue (decidir que tocar primero a partir de `riskBreakdown`, que congelar, estrategia de migracion) es trabajo de un futuro bounded context `Planning` (ver `methodology.md`), no de Audit.

Siguiente: Fase 8, la ultima de Audit — agregacion final de `RiskScore` compuesto y `TechnicalDebtSignal` por archivo/clase/modulo a partir de TODO lo que ya producen las fases 1 a 7. Aqui termina el alcance de Audit; lo que siga (decidir que tocar primero, que congelar) es trabajo de un futuro `Planning`, no de Audit.
