# Audit Graph (backend-driven, drill-down)

## Objetivo

Producir, desde el backend, un grafo **pre-posicionado y pre-codificado** que React Flow
pueda pintar tal cual (sin calcular layout en el cliente), para visualizar la auditoria como
un mapa de riesgo navegable. El grafo se agrega por niveles (drill-down) para no mandar miles
de nodos: cada respuesta trae a lo sumo unas decenas de nodos.

Niveles:

- `overview`: monorepo (raiz) -> apps (primer segmento de ruta).
- `heatmap`: grilla global plana con los archivos mas riesgosos de TODO el repo (sin drill
  jerarquico). **Implementada.** Requiere `phpRoot`; si falta, cae a `overview`. Toma
  `byFile` ordenado por `findingsCount` desc, top `HEATMAP_LIMIT` (60); cada nodo es un
  `file` con `size` escalado por **cantidad de hallazgos** (no risk), `tone`/`accent` de su
  entrada, `id: "file:<rel-posix>"` y `drill: true` (click -> vista `file`). Sin raiz ni edges.
- `app`: una app -> sus archivos mas riesgosos (drill-down). **Implementada.**
- `file`: un archivo -> sus reglas (findings agrupados). **Implementada.**

## Vista `file` (drill nivel 2)

`buildAuditGraph(snapshot, { view: "file", focus: <rel-posix>, phpRoot })`:

- Requiere `focus` (ruta relativa del archivo, el id del nodo file sin el prefijo `file:`) y
  `phpRoot`. Si falta alguno, cae a `overview`.
- Nodo raiz = el archivo (`type: "file"`, `id: "file:<focus>"`, metrica de su entrada en
  `byFile`), centrado, `drill: false`.
- Nodos regla = `aggregateFileRules(findings del archivo)` (top `FILE_RULE_LIMIT` = 24 por
  risk): cada regla con `id: "rule:<focus>:<rule>"`, `type: "rule"`, `label` = nombre de la
  regla, `accent` por su categoria, `tone`/`severityMix` por las severidades de sus findings,
  `metrics: { findings, risk }` (risk = suma de pesos de severidad), grilla debajo del archivo.
- Edges `contains` del archivo a cada regla.
- `aggregateFileRules` (domain) agrupa los findings de un archivo por regla.

## Vista `app` (drill-down)

`buildAuditGraph(snapshot, { view: "app", focus: <app>, phpRoot })`:

- Requiere `focus` (la app) y `phpRoot` (la raiz del proyecto, `config.laravel.modulesPath`).
  Si falta alguno, cae a `overview`.
- Nodo raiz = la app enfocada (`type: "app"`, `id: "app:<focus>"`, metrica de su entrada en
  `byModule`), centrada en `{ x: 0, y: 0 }`, `drill: false`.
- Nodos archivo = entradas de `snapshot.riskBreakdown.byFile` cuya app (primer segmento de
  `path.relative(phpRoot, file)`) coincide con `focus`, top `APP_FILE_LIMIT` (24) por risk.
  Cada uno: `id: "file:<rel-posix>"`, `label` = basename, `size` por risk relativo al maximo
  del conjunto, `accent`/`tone`/`severityMix`/`badges` derivados de su `RiskEntry`.
- Posiciones en grilla (`gridPositions(count, 6)`) debajo de la app.
- Edges `contains` de la app a cada archivo.
- Edges `duplicate` (`findDuplicateEdges`): detecta migraciones a medias `X` + `X_new`
  (mismo nombre base sin extension ni sufijo `_new`) y los conecta con un edge `duplicate`.
- Otras apps quedan excluidas.

## Entradas

- `snapshot: AuditSnapshot` (el que produce `auditProject`/`runAudit`). Ya trae
  `riskBreakdown.byModule` (agrupado por app = primer segmento de ruta cuando hay `phpRoot`),
  `summary`, `findings`, `riskScore`.
- `options: { view: AuditGraphView; focus: string | null }` con `view = "overview"` por ahora;
  `focus` se ignora en `overview`.

## Tipos (domain)

```text
AuditGraphNodeType = "root" | "app" | "module" | "file" | "rule"
AuditGraphTone     = "critical" | "high" | "medium" | "low" | "none"
AuditGraphAccent   = "security" | "database" | "complexity" | "testing" | "dead_code" | "coupling_low_level" | "php_compatibility" | "mixed"

AuditGraphNode {
  id: string
  type: AuditGraphNodeType
  label: string
  position: { x: number; y: number }     // calculado en backend (funcion pura)
  size: number                            // diametro en px, escala log sobre risk
  tone: AuditGraphTone                    // relleno: severidad dominante del nodo
  accent: AuditGraphAccent                // borde: categoria dominante del nodo
  severityMix: { high: number; medium: number; low: number }  // para mini-barra
  metrics: { findings: number; risk: number }
  badges: string[]                        // llamadas humanas, ej. "104 SQLi", "God class"
  drill: boolean                          // si tiene un nivel mas profundo navegable
}

AuditGraphEdge {
  id: string
  source: string
  target: string
  kind: "contains" | "duplicate" | "depends"
}

AuditGraph {
  generated_at: string
  view: AuditGraphView
  focus: string | null
  summary: { nodes: number; edges: number; findings: number; risk: number }
  nodes: AuditGraphNode[]
  edges: AuditGraphEdge[]
}
```

## Comportamiento de `buildAuditGraph(snapshot, options)` — vista `overview`

- Crea **un nodo raiz** `type: "root"`, `id: "root"`, `label` = nombre del proyecto
  (derivable de `snapshot.module ?? "proyecto"`; el label fino se ajusta en presentation),
  `metrics` = `{ findings: snapshot.summary.findings_count, risk: snapshot.riskScore.value }`,
  `severityMix` = `snapshot.summary.by_severity` (high/medium/low; `critical` se suma a `high`
  para la mini-barra), `tone`/`accent` dominantes calculados sobre el total, `drill: true`.
- Crea **un nodo `type: "app"` por cada entrada de `snapshot.riskBreakdown.byModule`**
  (cada una ya representa una app), con:
  - `id: "app:<key>"`, `label: key`, `metrics: { findings: entry.findingsCount, risk: entry.value }`.
  - `accent`: la categoria con mayor peso en `entry.byCategory` (`"mixed"` si empate o vacio).
  - `severityMix`: `entry.bySeverity` (ver enriquecimiento de `RiskEntry`).
  - `tone`: la severidad mas alta presente con conteo > 0 en `severityMix`
    (`critical`>`high`>`medium`>`low`; si todo 0 -> `none`). Para `overview` no hay `critical`
    separado en la mini-barra, pero `tone` si puede ser `critical` si el snapshot lo tiene.
  - `size`: escala logaritmica sobre `risk` acotada a `[MIN, MAX]` (ver layout).
  - `drill: true`.
- Crea **un edge `kind: "contains"`** de la raiz a cada app (`id: "contains:root:app:<key>"`).
- Las apps se ordenan por `risk` descendente (mismo orden que ya entrega `byModule`).
- `summary` se calcula sobre los nodos/edges generados y los totales del snapshot.

## Layout (funcion pura, domain)

`layoutOverview(apps, root)` asigna `position` de forma **determinista**:

- Raiz centrada arriba: `{ x: 0, y: 0 }`.
- Apps en una fila horizontal centrada debajo (`y = ROW_Y`), ordenadas por risk desc, con
  separacion `COL_GAP` y centradas respecto a la raiz: la app `i` de `n` va en
  `x = (i - (n - 1) / 2) * COL_GAP`.
- `size = clamp(round(MIN + (MAX - MIN) * log10(1 + risk) / log10(1 + maxRisk)), MIN, MAX)`,
  con `maxRisk` = risk de la app mas riesgosa (si `maxRisk` es 0, todas a `MIN`).
- Constantes deterministas (en el modulo de layout): `ROW_Y`, `COL_GAP`, `MIN`, `MAX`.

La separacion en filas/columnas y la escala viven en backend para que el resultado sea
estable entre sesiones y testeable. El cliente solo lee `position`/`size`.

## Enriquecimiento de `RiskEntry` (dependencia)

`RiskEntry` (en `auditRiskBreakdown.ts`) gana `bySeverity: Record<AuditFindingSeverity, number>`
acumulado igual que `byCategory`, para que cada nodo del grafo tenga su mezcla de severidad
sin recomputar sobre `findings`. Es aditivo: no cambia `value`/`byCategory`/`findingsCount`.

## Presentation / endpoint

- `AuditGraphController` (en `presentation/http`): construye el `AuditSnapshot` (igual que
  `AuditController`: `getConfig` + `check` + `auditProject`) y luego `buildAuditGraph(snapshot, { view, focus })`.
  Responde el `AuditGraph` como JSON.
- Ruta `auditGraphApiRoutes` -> `GET /audit-graph.json?target=laravel&module=&view=overview&focus=`.
  Se monta en la raiz desde `routes/web.ts` (junto a `/audit.json`).
- `view` por defecto `overview`; valores no reconocidos -> `overview`.

## Casos de borde

- Snapshot sin findings: solo el nodo raiz (`metrics` en 0, `tone: "none"`), sin apps ni edges.
- `byModule` vacio (no hubo `phpRoot`/native): solo raiz.
- `maxRisk = 0`: todas las apps a tamano `MIN`.

## Criterios de aceptacion

- `buildAuditGraph(snapshot, { view: "overview" })` con N entradas en `byModule` devuelve
  `1 + N` nodos (raiz + apps) y `N` edges `contains` desde la raiz.
- El `accent` de una app es la categoria de mayor peso en su `byCategory`.
- El `size` de la app de mayor risk es `MAX`; el de risk 0 es `MIN`.
- Las apps quedan posicionadas en una fila (`y` constante = `ROW_Y`) y centradas respecto a
  la raiz (suma de `x` ~ 0 para `n` simetrico).
- `GET /audit-graph.json?view=overview` responde 200 con `{ view: "overview", nodes, edges }`.
- `RiskEntry.bySeverity` suma 1 por finding segun su severidad, sin alterar `value`.
