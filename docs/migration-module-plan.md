# Plan de implementación — Módulo `migration` (ChangoArchscope)

> Documento de plan. Describe QUÉ construir y CÓMO, para que cualquier agente (o sesión
> futura) lo ejecute sin re-derivar el diseño. No es código; es el contrato del trabajo.
> Sigue las reglas de `docs/development-rules.md` (SDD → TDD → DDD → hexagonal → mutation).

## 0. Contexto y metodología

ChangoArchscope implementa la metodología:

```
audit → report → plan → refactor → validación
```

- `audit`, `report`, `plan` ya existen (módulos `architecture`, `audit`, `plan`).
- El módulo **`migration`** agrega el puente entre `plan` y `refactor`: **genera un playbook de
  migración a arquitectura hexagonal + DDD** y lo deposita en el **repo destino** (el proyecto
  legacy, p. ej. `/MSRepos/src/mc`). ChangoArchscope NO refactoriza: produce el manual.
- El `refactor` lo ejecuta un agente DENTRO del repo destino siguiendo ese playbook.
- La `validación` es re-correr el audit/check sobre el repo destino: el avance se **mide desde
  la realidad** y repinta el mapa de migración (loop cerrado).

Idea central: **el tool es el cerebro; el playbook es el artefacto-contrato portable.**

## 1. Principio de bounded context

`migration` es un **bounded context nuevo y separado**. Reglas:

- Consume `audit`/`architecture` **solo por tipo o por contrato** (igual que `plan` consume
  `AuditSnapshot`; igual que `audit` consume `ArchitectureCheckResult`). Nunca importa lógica
  de otro dominio.
- Tiene su propia persistencia (tablas propias), su generador, sus endpoints y su mapa visual.
- Reutiliza **infraestructura compartida**, no dominios: `PhpAstParser` (clases/métodos/
  `referencedNames`/`sqlLiterals`), `SourceTreeReader`, persistencia sqlite/drizzle, el patrón
  de drill de React Flow, y la config de reglas de `architecture` como reglas de destino.

## 2. Fases (entregar por capas, cada una con valor)

| Fase | Entrega | Estado |
|---|---|---|
| **F1 Descubrimiento** | Detectar bounded contexts (señales + clustering) + inventario de clases desde el AST | a construir |
| **F2 Revisión** | Visualizar contextos con evidencia/confianza/flags + loop aprobar/ajustar con overrides persistentes | a construir |
| **F3 Playbook** | Generar `MIGRATION.md` + `inventory.json` + specs por contexto + config de reglas ejecutables, y escribirlo en el repo destino | a construir |
| **F4 Validación (loop cerrado)** | Re-importar el estado tras re-audit; medir progreso real y repintar | a construir |
| **F5 Refactor (fuera de este repo)** | Un agente sigue el playbook en el repo destino (no es parte de este módulo) | documentado |

Granularidad **v1 = clase**. Métodos (descomposición de God classes) = v2.

---

## 3. F1 — Descubrimiento de bounded contexts

### 3.1 Inventario (desde el AST)
- Fuente: `scanPhpFiles(reader, parser, modulesPath, phpExtensions, ignoredPaths)` → `PhpFileStructure[]`
  (ya existe en `audit`). De cada archivo se obtienen `classes[]` (con `methods[]`),
  `referencedNames[]`, `sqlLiterals[]`.
- Unidad de inventario v1: **clase** → `{ id, name, file, methodsCount, references: string[], tables: string[] }`.
  - `tables`: extraídas de `sqlLiterals[].value` con un parser mínimo de SQL (FROM/JOIN/INTO/UPDATE).

### 3.2 Señales de cohesión (funciones puras, domain)
Construir un grafo ponderado entre clases combinando:
1. **Tokens de nombre**: tokenizar `MS<Dominio>...` (quitar prefijo `MS`, separar CamelCase) →
   peso por sustantivos de dominio compartidos. *(Señal más fuerte en este repo.)*
2. **Referencias directas**: arista si A referencia a B (`referencedNames`).
3. **Tablas compartidas**: peso por tablas SQL en común.
4. (Opcional v2) **Vocabulario de métodos** (book/cancel/refund…).

### 3.3 Clustering (función pura, domain)
- Detección de comunidades sobre el grafo (empezar simple: label propagation o componentes
  conexos sobre aristas por encima de un umbral; documentar el algoritmo elegido).
- Salida: **contextos candidatos**, cada uno con:
  - `classes: string[]`
  - `confidence: number` (0–1)
  - `evidence: string[]` (p. ej. "comparten token *Tours*", "comparten tabla `tours_bookings`")
  - `flags`: `spans_multiple` (God class que cruza fronteras → marcar para dividir),
    `shared_kernel` (utilidades base tipo `MSBaseAPI`), `low_confidence`.

### 3.4 Reglas de honestidad (no adivinar)
- God classes que tocan muchos contextos → `spans_multiple`, NO forzar a uno.
- Utilidades base → `shared_kernel`.
- Baja confianza → `low_confidence` (revisar), no inventar.

### Criterios de aceptación F1
- Dado un set de `PhpFileStructure`, el detector produce ≥1 contexto candidato con
  `classes`, `confidence`, `evidence`.
- Una clase que comparte token + tabla con otras se agrupa con ellas.
- Una God class con referencias a clases de varios clusters recibe `spans_multiple`.
- Funciones de señales/clustering son puras y testeadas (mutation ≥ umbral del proyecto).

---

## 4. F2 — Revisión y aprobación (overrides persistentes)

### 4.1 Modelo de decisión
- `proposed` (heurística) **+** `overrides` (humano). **Los overrides ganan y persisten.**
- Acciones humanas: aprobar, renombrar contexto, **fusionar**, **dividir**, **reasignar** una
  clase, mover a Shared Kernel, marcar contexto como aprobado.
- Al re-escanear: los overrides sobreviven; solo clases nuevas/sin clasificar se re-proponen.

### 4.2 Persistencia (drizzle/sqlite — patrón de `plan`)
Migración SQL nueva (`database/migrations/003_*.sql`) + schema drizzle:
- `migration_contexts(key TEXT PK, name TEXT, approved INTEGER, updated_at TEXT)`
- `migration_class_assignments(class_id TEXT PK, context_key TEXT, layer TEXT NULL, source TEXT /* 'proposed'|'override' */, updated_at TEXT)`
- `migration_unit_states(unit_id TEXT PK, state TEXT, updated_at TEXT)` /* pending|in_progress|done|blocked */
Repositorios en `migration/infrastructure/persistence/` (mirror de `SqlitePlanTaskStateRepository`).

### 4.3 Visual (React Flow, patrón drill de `audit`)
- **Nivel 0**: contextos como clusters (anillo de progreso % migrado; tamaño = #clases;
  flags visibles). Click → evidencia + clases.
- **Nivel 1**: dentro del contexto, 4 columnas (Domain/Application/Infrastructure/Presentation)
  + columna "Sin clasificar"; clases coloreadas por estado de migración.
- Edición: reasignar (arrastrar/menu), fusionar/dividir/renombrar contexto.
- **Vista "antes → después"**: clase legacy (izq) → su(s) destino(s) hexagonal(es) (der).

### Criterios de aceptación F2
- Un override (reasignar clase a otro contexto) persiste y sobrevive a un re-escaneo.
- Una clase nueva (no vista antes) aparece como `proposed`/sin clasificar sin pisar overrides.
- El endpoint devuelve `proposed + overrides` ya combinados.

---

## 5. F3 — Generación del playbook (artefacto-contrato)

### 5.1 Estructura escrita en el repo destino
Ruta destino **configurable** (default `docs/migration/` dentro del repo destino):
```
<repoDestino>/docs/migration/
  MIGRATION.md            estrategia: contextos aprobados, reglas hexagonales, orden (DAG), gates
  inventory.json          manifiesto: clase → { context, layer, state, order }  (re-importable)
  contexts/<ctx>.md       receta por contexto: clases, descomposición sugerida, pasos strangler
  chango-archscope.config.mjs   reglas EJECUTABLES (forbiddenImports/layers/coupling) del código nuevo
<repoDestino>/CLAUDE.md   snippet: "sigue docs/migration/MIGRATION.md"
```

### 5.2 Contenido de `MIGRATION.md` (lo que el agente de refactor obedece)
- **Contextos** aprobados y su responsabilidad.
- **Estructura objetivo** (layout hexagonal por contexto: domain/application/infrastructure/presentation).
- **Reglas de capa** (Domain no conoce Infra, etc.) → enlazan a la config ejecutable.
- **Orden de migración (DAG)**: tests de caracterización → Domain → Application → Infrastructure
  → Presentation; contextos hoja antes que hub; resolver duplicados `_new` primero;
  third-party excluido.
- **Receta por unidad (strangler fig)**: 1) caracterizar con tests, 2) extraer a la nueva
  estructura, 3) dejar shim legacy que delega, 4) cortar shim cuando no haya llamadores.
- **Gates de validación por unidad**: tests verdes + mutation + `chango-archscope check` pasa.
- **Definición de done** por unidad y global.

### 5.3 Reglas ejecutables = reutilizar `architecture`
La config generada es la misma forma que valida el módulo `architecture`
(`forbiddenImports`, `layers`, `coupling`). Así **el mismo tool que auditó valida la migración**.

### Criterios de aceptación F3
- Con una partición aprobada, `generatePlaybook` produce los 4 artefactos de forma determinista.
- `inventory.json` es válido y re-importable (round-trip con F4).
- El escritor deposita los archivos en la ruta destino configurada sin tocar otro contenido.
- El playbook NO se genera si hay contextos sin aprobar (o avisa).

---

## 6. F4 — Validación (loop cerrado)

- Tras el `refactor` en el repo destino, **re-correr audit/check** sobre ese repo.
- Detección de progreso desde la realidad: una clase migrada (vive en `…/Domain/`, sin SQL
  crudo, dependencias limpias) → estado `done`. El re-audit actualiza `migration_unit_states`.
- Re-importar `inventory.json` (si el refactor lo actualizó) como señal complementaria.
- El mapa se repinta: riesgo baja, unidades en verde, % por contexto sube.
- Marcado manual sigue disponible, pero la **fuente de verdad es el re-audit**.

### Criterios de aceptación F4
- Re-escanear un repo donde una clase ya migró marca esa unidad como `done` automáticamente.
- El % de progreso por contexto refleja `done / total`.

---

## 7. F5 — Refactor (en el repo destino, fuera de este módulo)

Documentado para el agente que ejecuta:
- Trabaja **unidad por unidad** (una clase = un cambio chico = un commit/PR).
- Sigue el ciclo SDD del repo destino: spec → test rojo → implementación hexagonal → verde →
  mutation, respetando `MIGRATION.md` y la config de reglas.
- Usa strangler fig (shim legacy) para no romper llamadores.
- Al terminar una unidad: actualiza `inventory.json` y/o deja que el re-audit la detecte.

---

## 8. Estructura del módulo en ChangoArchscope (DDD/hexagonal)

```
app/modules/migration/
  domain/
    value-objects/        BoundedContext, MigrationUnit, MigrationInventory, MigrationGraph, Playbook
    services/             contextSignals.ts (puro), clusterContexts.ts (puro), migrationLayout.ts (puro), sqlTables.ts (puro)
  application/
    contracts/            InventoryProvider (consume AST/audit por tipo), ContextRepository, UnitStateRepository, PlaybookWriter
    services/             auditToInventory.ts (adaptador: PhpFileStructure[]/AuditSnapshot → MigrationInventory)
    use-cases/            detectContexts.ts, buildMigrationGraph.ts, approveContext.ts/reassignClass.ts, generatePlaybook.ts, importProgress.ts
  infrastructure/
    persistence/          schema (drizzle) + Sqlite*Repository
    playbook/             FsPlaybookWriter.ts (escribe en el repo destino)
  presentation/
    http/                 MigrationController (graph, contexts, overrides, generate-playbook)
    routes/api.ts         monta en routes/web.ts (raíz), como audit/plan
  specs/                  una spec por caso de uso (SDD)
```

Frontend: `resources/js/react/modules/migration-explorer/` (mismo patrón que `audit-explorer`/
`plan-explorer`: domain/application/infrastructure(react-flow + api)/presentation, helpers puros
testeados, vistas pesadas fuera del mutation). Tab nuevo **"Migración"** en
`app/presentation/App.tsx`.

## 9. Endpoints (montados en raíz, como los demás)
- `GET /migration.json?target=` → grafo de migración (contextos/clases/estado, ya con overrides).
- `POST /migration/contexts/:key` → aprobar/renombrar.
- `POST /migration/classes/:id` → reasignar contexto/capa (override).
- `POST /migration/playbook` → genera y escribe el playbook en el repo destino; responde resumen.
- `GET /migration/import` o re-uso de re-audit → F4.

## 10. Persistencia
- Migraciones SQL en `database/migrations/003_*.sql` (patrón de `002_create_plan_task_states.sql`).
- El server ya corre migraciones y registra la conexión en `bootstrap/server.ts`.

## 11. Reglas de calidad (obligatorias, de `docs/development-rules.md`)
- **SDD**: spec por caso de uso antes de tests/código.
- **TDD**: tests rojos antes de implementar; lógica pura (señales, clustering, layout, sqlTables,
  generación de playbook, adaptadores) con cobertura fuerte.
- **Mutation dirigido** ≥ umbral del proyecto en los archivos de lógica nueva (node 80 / react 70).
  Vistas pesadas de React Flow fuera del mutation general.
- **DDD/hexagonal**: domain puro sin `node:fs`/HTTP/DB; infra detrás de contratos; `migration`
  desacoplado de otros dominios (solo tipos/contratos).
- Nombres neutrales en tests (no acoplar a `mc`/`MS*`; usar ejemplos genéricos).

## 12. Decisiones tomadas (defaults) y abiertas
Tomadas:
- Detección automática de **todos** los contextos + revisión manual humana con overrides
  **persistentes y autoritativos**.
- Playbook como artefacto `.md` + `inventory.json` + reglas ejecutables, escrito en el repo destino.
- Validación por **re-audit** (loop cerrado); marcado manual complementario.
- Granularidad **v1 = clase**; métodos en v2.
- `migration` = bounded context separado; consume audit/AST por tipo.

Abiertas (confirmar al construir):
- Ruta destino exacta del playbook (default `docs/migration/`).
- Algoritmo de clustering concreto (default: aristas ponderadas + componentes/label propagation).
- Cómo se referencia el repo destino (¿`config.laravel.modulesPath` es el root del proyecto o
  un subdir? El playbook va al root del repo destino).

## 13. Definición de hecho del módulo (v1)
- F1–F4 implementadas con specs+tests+mutation; build node+react verde.
- Smoke E2E: detectar contextos del repo real → aprobar/ajustar → generar playbook en una ruta
  temporal → re-importar progreso → mapa repinta.
- Tab "Migración" navegable: contextos → capas → clases, con edición de asignación y botón
  "Generar playbook".
