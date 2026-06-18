# Refactor Cycle

Este repo se usara para programar una metodologia interna de refactorizacion. La intencion no es vender nombres sueltos, sino construir una linea de trabajo clara: cada herramienta resuelve una parte del proceso, produce un artefacto concreto y alimenta a la siguiente etapa.

La promesa interna del ciclo es:

> No refactorizamos a ciegas. Primero entendemos el sistema, luego explicamos el diagnostico, despues decidimos el plan, ejecutamos cambios controlados y finalmente validamos que el sistema quedo mejor.

## Flujo del Negocio

```text
Audit -> Report -> Plan -> Refactor -> Validate
```

Cada etapa es una herramienta independiente, pero dependiente por contrato:

| Etapa | Pregunta que responde | Entrada | Salida |
| --- | --- | --- | --- |
| Audit | Que tenemos y que riesgos existen? | Codigo fuente, configuracion, reglas | Diagnostico tecnico estructurado |
| Report | Como lo entiende negocio/equipo? | Diagnostico tecnico | Reporte ejecutivo y tecnico |
| Plan | Que haremos, en que orden y por que? | Diagnostico + reporte | Roadmap de refactorizacion |
| Refactor | Como ejecutamos el cambio? | Roadmap + codigo fuente | Cambios propuestos/aplicados |
| Validate | Quedo mejor y no rompimos nada? | Codigo refactorizado + reglas | Evidencia de calidad |

## Bounded Contexts

Los bounded contexts deben nombrar capacidades del negocio interno, no solo tecnologias. La estructura recomendada es:

```text
app/modules/
  architecture/
  audit/
  reporting/
  planning/
  refactoring/
  validation/
  workflow/
```

Los nombres de modulo van siempre en minusculas (ver `docs/project-architecture.md`), aunque el contexto de negocio se nombre en mayuscula inicial al hablar de el en prosa.

### Architecture

Responsabilidad: entender la estructura del software.

Este contexto ya existe en el repo como `app/modules/architecture`. Su negocio no es "dibujar grafos"; su negocio es convertir codigo en conocimiento arquitectonico.

Debe encargarse de:

- Descubrir modulos.
- Detectar capas.
- Resolver imports.
- Construir grafos de dependencias.
- Detectar violaciones de reglas arquitectonicas.
- Exponer datos reutilizables para Audit y Validate.

Artefactos principales:

- `ArchitectureGraph`
- `ArchitectureNode`
- `ArchitectureEdge`
- `ArchitectureRule`
- `ArchitectureViolation`

### Audit

Responsabilidad: producir un diagnostico tecnico del estado actual.

Este contexto responde: "Que tan sano o riesgoso esta el sistema antes de tocarlo?"

Debe encargarse de:

- Ejecutar analizadores.
- Consolidar hallazgos tecnicos.
- Medir acoplamiento, deuda, riesgos, duplicacion, codigo muerto y cobertura disponible.
- Clasificar severidad e impacto tecnico.
- Generar un `AuditSnapshot` reproducible.

No debe decidir el plan de trabajo. Solo diagnostica.

Artefactos principales:

- `AuditRun`
- `AuditFinding`
- `AuditSnapshot`
- `RiskScore`
- `TechnicalDebtSignal`

### Reporting

Responsabilidad: convertir diagnostico en comunicacion clara.

Este contexto responde: "Como explicamos el estado del sistema de forma entendible y accionable?"

Debe encargarse de:

- Traducir findings tecnicos a lenguaje ejecutivo.
- Agrupar problemas por impacto.
- Construir resumen, evidencias y recomendaciones.
- Generar reportes HTML, Markdown o PDF.
- Mantener separadas las vistas para equipo tecnico y negocio.

No debe inventar hallazgos ni cambiar prioridades tecnicas de fondo. Interpreta y comunica.

Artefactos principales:

- `AssessmentReport`
- `ExecutiveSummary`
- `TechnicalSection`
- `FindingNarrative`
- `ReportExport`

### Planning

Responsabilidad: decidir el camino de refactorizacion.

Este contexto responde: "Que se hace primero, que se pospone y cual es el riesgo de cada paso?"

Debe encargarse de:

- Convertir hallazgos en iniciativas.
- Definir fases.
- Priorizar modulos.
- Estimar esfuerzo.
- Marcar dependencias entre tareas.
- Definir estrategia de pruebas y migracion.
- Explicitar que no se toca todavia.

No debe modificar codigo. Su salida es un plan ejecutable.

Artefactos principales:

- `RefactorPlan`
- `RefactorPhase`
- `RefactorTask`
- `ModulePriority`
- `MigrationStrategy`
- `TestStrategy`

### Refactoring

Responsabilidad: ejecutar cambios controlados en el codigo.

Este contexto responde: "Como transformamos el sistema siguiendo el plan?"

Debe encargarse de:

- Preparar cambios por tarea.
- Separar modulos.
- Extraer casos de uso.
- Crear DTOs, commands, contratos y adaptadores.
- Mover logica fuera de controladores.
- Sugerir o aplicar patches.
- Registrar decisiones tomadas durante la ejecucion.

No debe cambiar reglas de calidad para que el cambio pase. Si algo falla, lo reporta a Validation o Planning.

Artefactos principales:

- `RefactorRun`
- `RefactorChangeSet`
- `CodeTransformation`
- `PatchProposal`
- `ExecutionDecision`

### Validation

Responsabilidad: comprobar que el cambio es seguro y mejora el sistema.

Este contexto responde: "Tenemos evidencia de que el resultado es correcto?"

Debe encargarse de:

- Ejecutar tests.
- Verificar reglas de arquitectura.
- Validar cobertura minima.
- Validar contratos.
- Detectar deuda nueva.
- Comparar estado antes/despues.
- Emitir veredictos de calidad.

No debe ejecutar refactors. Valida resultados y produce evidencia.

Artefactos principales:

- `ValidationRun`
- `QualityGate`
- `ValidationFinding`
- `RegressionSignal`
- `ValidationVerdict`

### Workflow

Responsabilidad: orquestar el ciclo completo.

Este contexto responde: "En que etapa esta este proyecto y que sigue?"

Debe encargarse de:

- Crear ejecuciones del ciclo.
- Conectar salidas y entradas entre herramientas.
- Guardar estado del proceso.
- Permitir reintentos.
- Registrar decisiones manuales.
- Mantener trazabilidad de Audit a Validate.

No debe contener logica interna de auditoria, reporte, plan, refactor o validacion. Solo coordina.

Artefactos principales:

- `CycleRun`
- `CycleStage`
- `StageArtifact`
- `StageStatus`
- `WorkflowDecision`

## Capas por Contexto

Cada bounded context debe mantener las mismas capas base:

```text
app/modules/<Context>/
  domain/
  application/
  infrastructure/
  presentation/
```

### Domain

Contiene el lenguaje del negocio del contexto.

Aqui viven entidades, value objects, reglas puras y conceptos que no dependen de framework, filesystem, HTTP ni CLI.

Ejemplos:

- `AuditFinding`
- `RefactorPlan`
- `QualityGate`
- `CycleRun`

### Application

Contiene casos de uso y contratos.

Aqui vive la coordinacion del contexto: que se hace, en que orden y con que puertos. Puede depender de Domain, pero no de Infrastructure.

Ejemplos:

- `RunAudit`
- `GenerateAssessmentReport`
- `CreateRefactorPlan`
- `ExecuteRefactorTask`
- `RunValidation`

### Infrastructure

Contiene adaptadores tecnicos.

Aqui viven filesystem, Git, parsers, motores de templates, generadores de PDF, runners de tests, integraciones con LLMs, llamadas HTTP y cualquier dependencia externa.

Ejemplos:

- `FileSystemProjectScanner`
- `MarkdownReportRenderer`
- `GitPatchWriter`
- `VitestValidationRunner`
- `OpenAiRefactorAssistant`

### Presentation

Contiene entradas del usuario o del sistema.

Aqui viven rutas HTTP, comandos CLI, controladores, presenters y DTOs de entrada/salida.

Ejemplos:

- `audit` CLI command
- `/audit.json`
- `/reports/:id`
- `ArchitectureExplorer` UI

## Contratos Entre Contextos

Los contextos no deben leer detalles internos de otros contextos. Se comunican por artefactos estables.

```text
ArchitectureGraph -> AuditSnapshot -> AssessmentReport -> RefactorPlan -> RefactorChangeSet -> ValidationVerdict
```

Regla importante:

- `Audit` puede consumir `ArchitectureGraph`.
- `Reporting` puede consumir `AuditSnapshot`.
- `Planning` puede consumir `AuditSnapshot` y `AssessmentReport`.
- `Refactoring` puede consumir `RefactorPlan`.
- `Validation` puede consumir `RefactorChangeSet` y tambien volver a consultar `Architecture`.
- `Workflow` puede conocer el estado de todos, pero no sus detalles internos.

## Nombres Recomendados

Para uso interno conviene evitar exceso de marca por etapa. El ciclo completo puede llamarse:

- `Refactor Cycle`

Las herramientas internas pueden nombrarse funcionalmente:

- `audit`
- `report`
- `plan`
- `refactor`
- `validate`

En codigo, los bounded contexts deberian usar nombres de capacidad:

- `Audit`
- `Reporting`
- `Planning`
- `Refactoring`
- `Validation`
- `Workflow`

## Primer Incremento Recomendado

El repo ya tiene una base fuerte en `Architecture`. El siguiente paso natural es construir `Audit` encima de eso.

Orden sugerido:

1. Formalizar `ArchitectureGraph` y `ArchitectureViolation` como contratos estables.
2. Crear `Audit` para consolidar hallazgos desde arquitectura.
3. Crear `Reporting` para convertir `AuditSnapshot` en Markdown/HTML.
4. Crear `Planning` para producir un `RefactorPlan` versionable.
5. Agregar `Validation` como quality gate del ciclo.
6. Crear `Workflow` cuando ya existan al menos dos etapas conectadas.

La regla practica: cada nueva herramienta debe nacer con entrada, salida y responsabilidad clara antes de tener UI.
