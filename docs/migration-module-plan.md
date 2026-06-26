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

Idea central: **un agente de IA externo es el cerebro que DETECTA los bounded contexts;
ChangoArchscope guarda, dibuja y valida ese mapa, y el playbook es el artefacto-contrato
portable.** El tool NO detecta contextos con heurísticas (ese enfoque quedó descartado). El
contrato del intercambio agente↔tool está en
[`bounded-context-map-schema.md`](bounded-context-map-schema.md).

## 1. Principio de bounded context

`migration` es un **bounded context nuevo y separado**. Reglas:

- Consume `audit`/`architecture` **solo por tipo o por contrato** (igual que `plan` consume
  `AuditSnapshot`; igual que `audit` consume `ArchitectureCheckResult`). Nunca importa lógica
  de otro dominio.
- Tiene su propia persistencia (tablas propias), su generador, sus endpoints y su mapa visual.
- Reutiliza **infraestructura compartida**, no dominios: `SourceTreeReader` (para enumerar los
  archivos en alcance que el agente analizará), persistencia sqlite/drizzle, el patrón de drill
  de React Flow, y la config de reglas de `architecture` como reglas de destino (validación
  ejecutable del código nuevo).

## 2. Fases (entregar por capas, cada una con valor)

| Fase | Entrega | Estado |
|---|---|---|
| **F1 Descubrimiento** | Exponer la fuente (`/bounded-context-source.json`: qué archivos analizar) y persistir el mapa de bounded contexts que arma un **agente de IA externo** (`PUT /bounded-context-map`) | a construir |
| **F2 Revisión** | Visualizar contextos con evidencia/confianza/flags + loop aprobar/ajustar con overrides persistentes | a construir |
| **F3 Playbook** | Generar `MIGRATION.md` + `inventory.json` + specs por contexto + config de reglas ejecutables, y escribirlo en el repo destino | a construir |
| **F4 Validación (loop cerrado)** | Re-importar el estado tras re-audit; medir progreso real y repintar | a construir |
| **F5 Refactor (fuera de este repo)** | Un agente sigue el playbook en el repo destino (no es parte de este módulo) | documentado |

Granularidad **v1 = clase**. Métodos (descomposición de God classes) = v2.

---

## 3. F1 — Descubrimiento de bounded contexts (lo hace un agente de IA externo)

> **Decisión de diseño:** ChangoArchscope **no** detecta bounded contexts con heurísticas. La
> detección la hace un **agente de IA externo** que lee el código y razona la partición (de
> forma general, para cualquier proyecto). El tool solo: (a) le dice al agente qué archivos
> analizar, (b) valida y persiste el mapa que arma, (c) lo dibuja en React Flow y (d) lo valida
> con reglas ejecutables. El enfoque heurístico (señales de cohesión + clustering) quedó
> **descartado**. El contrato exacto del intercambio está en
> [`bounded-context-map-schema.md`](bounded-context-map-schema.md).

### 3.1 Fuente para el agente (la expone el tool)
`GET /bounded-context-source.json?target=laravel` devuelve dónde está el proyecto y qué archivos
están en alcance, usando `SourceTreeReader` + la config (`modulesPath`, `phpExtensions`,
`ignoredPaths`):
- `root`: raíz del código a analizar.
- `extensions`, `ignoredPaths`.
- `files`: rutas absolutas de los archivos en alcance.

El agente **lee el contenido de esos `files`** (tiene acceso al filesystem del repo) y razona
los bounded contexts. No hace falta pasarle la ruta a mano: el tool ya la sabe de la config.

### 3.2 El agente arma el mapa y lo guarda
El agente produce el JSON del esquema de `bounded-context-map-schema.md` (`modules[]` con `key`,
`name`, `description?`, `validated`, y las 4 capas hexagonales con `{ path, note? }`) y lo guarda
con `PUT /bounded-context-map?target=laravel`. El tool **valida la forma y lo persiste tal cual**
(no reinterpreta ni recalcula la partición).

Dos mapas, mismo esquema y endpoint, separados por `target`:
- `target=laravel` → mapa de archivos legacy repartidos en módulos/capas (as-is). Pestaña "Migración".
- `target=design` → clases hexagonales pequeñas propuestas (to-be), derivadas del de archivos. Pestaña "Diseño".

### 3.3 Guía de honestidad (la aplica el agente, no el tool)
- God classes que cruzan fronteras → no forzarlas a un solo contexto; anotarlo en `note` o
  llevarlas a Shared Kernel.
- Utilidades base → Shared Kernel.
- Baja confianza → dejarlo explícito en `description`/`note` para que el humano lo revise; no inventar.

### Criterios de aceptación F1
- `GET /bounded-context-source.json` devuelve `root`, `extensions`, `ignoredPaths` y la lista
  correcta de `files` en alcance según la config (respetando `ignoredPaths`).
- `PUT /bounded-context-map` valida la forma (módulos con `key`/`name` y las 4 capas) y persiste
  el mapa por `target`; `GET /bounded-context-map.json` lo devuelve normalizado.
- El tool **no** contiene lógica de detección/clustering de contextos (lógica pura testeada =
  validación/normalización del mapa y layout, no inferencia de la partición).

---

## 4. F2 — Revisión y aprobación (overrides persistentes)

### 4.1 Modelo de decisión
- `proposed` (lo arma el **agente de IA**) **+** ediciones humanas. **Las ediciones humanas
  ganan y persisten.**
- Acciones humanas: aprobar, renombrar contexto, **fusionar**, **dividir**, **reasignar** una
  clase de capa/contexto, mover a Shared Kernel, marcar `validated`.
- Al re-generar: los `key` estables permiten conservar módulos ya validados; solo clases
  nuevas/sin clasificar se re-proponen, sin pisar las ediciones humanas.

### 4.2 Persistencia (drizzle/sqlite — patrón de `plan`)
Migración SQL nueva (`database/migrations/003_*.sql`) + schema drizzle:
- El **mapa de bounded contexts** se guarda por `target` (lo que llega por `PUT
  /bounded-context-map`), normalizado y validado. Las ediciones humanas en la UI se guardan con
  el mismo `PUT` y son autoritativas.
- `migration_unit_states(unit_id TEXT PK, state TEXT /* pending|in_progress|done|blocked */, updated_at TEXT)`
  para el estado de migración por unidad (loop cerrado F4).
Repositorios en `migration/infrastructure/persistence/` (mirror de `SqlitePlanTaskStateRepository`).

### 4.3 Visual (React Flow, patrón drill de `audit`)
- **Nivel 0**: contextos como clusters (anillo de progreso % migrado; tamaño = #clases;
  flags visibles). Click → evidencia + clases.
- **Nivel 1**: dentro del contexto, 4 columnas (Domain/Application/Infrastructure/Presentation)
  + columna "Sin clasificar"; clases coloreadas por estado de migración.
- Edición: reasignar (arrastrar/menu), fusionar/dividir/renombrar contexto.
- **Vista "antes → después"**: clase legacy (izq) → su(s) destino(s) hexagonal(es) (der).

### Criterios de aceptación F2
- Una edición humana (reasignar una clase de contexto/capa, renombrar, marcar `validated`) se
  guarda con `PUT /bounded-context-map` y sobrevive como parte del mapa persistido.
- Al re-generar el mapa, los `key` estables conservan los módulos ya validados; una clase nueva
  aparece sin clasificar sin pisar ediciones humanas.
- `GET /bounded-context-map.json` devuelve el mapa normalizado vigente.

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
    value-objects/        BoundedContextMap, BoundedContext (key/name/layers), MigrationUnit, MigrationGraph, Playbook
    services/             migrationLayout.ts (puro), boundedContextMap.ts (puro: validación/normalización del mapa)
  application/
    contracts/            SourceFileLister (enumera archivos en alcance), ContextMapRepository, UnitStateRepository, PlaybookWriter
    use-cases/            getBoundedContextSource.ts (qué archivos analizar), saveBoundedContextMap.ts (valida+persiste el mapa del agente), buildMigrationGraph.ts (mapa→React Flow), generatePlaybook.ts, importProgress.ts
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
- `GET /bounded-context-source.json?target=` → root, extensiones, ignoredPaths y archivos en alcance (para el agente).
- `GET /bounded-context-map.json?target=` → mapa vigente (contextos/clases/capas, ya con ediciones humanas).
- `PUT /bounded-context-map?target=` → guarda/reemplaza el mapa que arma el agente o que edita el humano.
- `GET /migration.json?target=` → grafo de migración para React Flow (deriva del mapa + estados de unidad).
- `POST /migration/playbook` → genera y escribe el playbook en el repo destino; responde resumen.
- `GET /migration/import` o re-uso de re-audit → F4.

## 10. Persistencia
- Migraciones SQL en `database/migrations/003_*.sql` (patrón de `002_create_plan_task_states.sql`).
- El server ya corre migraciones y registra la conexión en `bootstrap/server.ts`.

## 11. Reglas de calidad (obligatorias, de `docs/development-rules.md`)
- **SDD**: spec por caso de uso antes de tests/código.
- **TDD**: tests rojos antes de implementar; lógica pura (validación/normalización del mapa,
  layout, generación de playbook, adaptadores) con cobertura fuerte.
- **Mutation dirigido** ≥ umbral del proyecto en los archivos de lógica nueva (node 80 / react 70).
  Vistas pesadas de React Flow fuera del mutation general.
- **DDD/hexagonal**: domain puro sin `node:fs`/HTTP/DB; infra detrás de contratos; `migration`
  desacoplado de otros dominios (solo tipos/contratos).
- Nombres neutrales en tests (no acoplar a `mc`/`MS*`; usar ejemplos genéricos).

## 12. Decisiones tomadas (defaults) y abiertas
Tomadas:
- La detección de contextos la hace un **agente de IA externo** (no heurística en el tool); el
  tool expone la fuente, valida/persiste el mapa, lo dibuja y lo valida. Enfoque heurístico
  (señales + clustering) **descartado**.
- Revisión/edición humana **persistente y autoritativa** sobre el mapa.
- Playbook como artefacto `.md` + `inventory.json` + reglas ejecutables, escrito en el repo destino.
- Validación por **re-audit** (loop cerrado); marcado manual complementario.
- Granularidad **v1 = clase**; métodos en v2.
- `migration` = bounded context separado; consume audit por tipo y expone los archivos en alcance
  para que el agente los lea.

Abiertas (confirmar al construir):
- Ruta destino exacta del playbook (default `docs/migration/`).
- Estrategia de merge al re-generar el mapa para preservar ediciones humanas (basada en `key` estable).
- Cómo se referencia el repo destino (¿`config.laravel.modulesPath` es el root del proyecto o
  un subdir? El playbook va al root del repo destino).

## 13. Definición de hecho del módulo (v1)
- F1–F4 implementadas con specs+tests+mutation; build node+react verde.
- Smoke E2E: detectar contextos del repo real → aprobar/ajustar → generar playbook en una ruta
  temporal → re-importar progreso → mapa repinta.
- Tab "Migración" navegable: contextos → capas → clases, con edición de asignación y botón
  "Generar playbook".
