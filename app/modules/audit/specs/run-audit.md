# Run Audit

## Objetivo

Consolidar el reporte de chequeo de arquitectura (`ArchitectureCheckResult`, producido por `checkArchitecture` en el modulo `architecture`) en un diagnostico propio de Audit: un `AuditSnapshot` compuesto por `AuditFinding[]` y un `RiskScore` basico. Esta es la Fase 1 de `docs/audit.md`: no agrega analisis nuevo (sin AST de PHP todavia), solo traduce lo que `architecture` ya calculo a artefactos de Audit.

## Entradas

- `checkResult: ArchitectureCheckResult` — artefacto estable expuesto por `architecture` (`{ checked_at, target, module, fail_on_coupling, passed, summary, reports }`). `RunAudit` no llama a `checkArchitecture` ni importa nada de `architecture` fuera de este tipo; quien orquesta (CLI, en una spec posterior) obtiene el `ArchitectureCheckResult` y lo pasa como entrada.

## Comportamiento

- Por cada `ModuleCheckReport` en `checkResult.reports`, en el mismo orden en que llegan:
  - Cada item de `violations` se convierte en un `AuditFinding`:
    - `category: "architecture_violation"`, `rule: "layer-violation"`, `severity: "high"`, `source: "architecture"`.
    - `module`, `file`, `line`, `message`, `suggestion` copiados del `ArchitectureIssue`.
    - `details`: vacio (las violaciones no traen `target_module`/`assessment`/`recommendation`/`action`).
  - Cada item de `couplings` se convierte en un `AuditFinding`:
    - `category: "coupling_module"`, `rule: "module-coupling"`, `severity: "medium"`, `source: "architecture"`.
    - `module`, `file`, `line`, `message`, `suggestion` copiados del `ArchitectureIssue`.
    - `details`: incluye `target_module`, `assessment`, `recommendation`, `action` solo si vienen presentes en el `ArchitectureIssue` original.
  - Dentro de cada modulo, las `violations` se agregan antes que los `couplings` (mismo orden que ya entrega `architecture`).
- `summary` se calcula a partir de `checkResult.summary` (`files_scanned`, `modules`) mas conteos propios de Audit: `findings_count`, `by_category` (`architecture_violation` / `coupling_module`), `by_severity` (`high` / `medium`).
- `riskScore.value = violations_count * 3 + couplings_count * 2`, usando los totales de `checkResult.summary`. `riskScore.breakdown` reporta el aporte de cada categoria (`architecture_violation`, `coupling_module`) por separado.
- `RunAudit` es una funcion pura sobre su entrada: no genera IDs aleatorios ni depende de estado externo salvo la marca de tiempo (`generatedAt`).
- `RunAudit` no usa `SourceTreeReader` ni toca filesystem.

## Salidas

`AuditSnapshot`:

```text
{
  generatedAt: string (ISO),
  target: string,
  module: string | null,
  summary: {
    files_scanned: number,
    modules: number,
    findings_count: number,
    by_category: Record<string, number>,
    by_severity: Record<string, number>,
  },
  findings: AuditFinding[],
  riskScore: { value: number, breakdown: Record<string, number> },
}
```

## Casos invalidos o de borde

- `checkResult.reports` vacio (ningun modulo) produce un `AuditSnapshot` con `findings: []` y `riskScore.value: 0`, sin lanzar error.
- Un coupling sin `target_module`/`assessment`/`recommendation`/`action` no debe fallar; `details` solo incluye las claves que si vienen presentes.
- `checkResult.passed` y `checkResult.fail_on_coupling` no se usan para decidir nada en Audit: Audit no tiene concepto de pass/fail en esta fase, solo diagnostica.

## Criterios de Aceptacion

- Un `checkResult` con N violaciones y M couplings (sumando todos los modulos) produce exactamente N + M findings, con `category`/`severity`/`source` segun las reglas de arriba.
- `riskScore.value` coincide con `checkResult.summary.violations_count * 3 + checkResult.summary.couplings_count * 2`.
- `summary.findings_count` es igual a `findings.length`.
- Mismo `checkResult` (con `generatedAt` fijo inyectado en el test) produce siempre el mismo `AuditSnapshot`.

## Notas de implementacion

- Vive en `app/modules/audit/application/use-cases/RunAudit.ts`. Tipos nuevos (`AuditFinding`, `AuditSnapshot`, `RiskScore`) en `app/modules/audit/domain/value-objects/`.
- La integracion con CLI (`chango-archscope audit`) y la construccion real del `ArchitectureCheckResult` (llamando a `loadConfig` + `checkArchitecture`) quedan fuera de esta spec; se resuelven en una spec de `presentation` posterior.
- Internamente, `runAudit` separa la conversion de `checkResult` a `AuditFinding[]` (exportada como `architectureFindings`) del calculo de `summary`/`riskScore` (extraido a `buildAuditSnapshot` en `domain/services/auditSnapshotBuilder.ts`, ver `audit-cli.md`). Este refactor no cambia la firma ni la salida de `runAudit`; los criterios de aceptacion de esta spec siguen aplicando sin cambios.
