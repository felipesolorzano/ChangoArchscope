# Ciclos de imports y salud de arquitectura (XRay X1)

## Objetivo

Encontrar ciclos de dependencias entre archivos (`A → B → C → A`) y medir que tan acoplado esta el
grafo (imports entre modulos, archivos de los que depende medio proyecto), para mostrarlo en
Arquitectura y llevar los ciclos a Auditoria y Plan. Plan: `docs/xray-plan.md`.

## Entradas

Los `nodes` y `edges` del `ArchitectureGraph`. Solo cuentan los edges `type: "import"` cuyo origen y
destino son nodos `file` (un import a un modulo sin archivo resuelto no forma ciclo); un mismo par
origen→destino cuenta una vez.

## Ciclos (`domain/services/importCycles.ts`, puro)

`findImportCycles(nodes, edges)` → `ImportCycle[]`:

```ts
type ImportCycle = { files: string[]; path: string[]; modules: string[]; crossModule: boolean; line: number };
```

- Un ciclo por componente fuertemente conexo con mas de un archivo, o por archivo que se importa a
  si mismo.
- `files`: los `path` de sus archivos, ordenados.
- `path`: un recorrido concreto que empieza y termina en `files[0]`, el mas corto dentro del
  componente (`[a, b, a]`; autoimport `[a, a]`); entre caminos igual de cortos, el que va primero por
  orden de `path`.
- `modules`: modulos de sus archivos, sin repetir, ordenados. `crossModule`: mas de uno.
- `line`: linea del import de `path[0]` a `path[1]` (1 si el edge no la trae).
- Orden: mas archivos primero; despues por `files[0]`.
- Sin limite de profundidad por recursion (grafo de miles de archivos).

## Salud (`domain/services/architectureHealth.ts`, puro)

`architectureHealth(nodes, edges)` →

```ts
{
  summary: { files, imports, crossModuleImports, modulePairs, cycles, filesInCycles, largestCycle },
  cycles: ImportCycle[],
  mostImported: Array<{ path, module, count }>,   // count = archivos distintos que lo importan
  mostImporting: Array<{ path, module, count }>,  // count = archivos distintos que importa
}
```

- `files`: nodos `file`. `imports`: pares archivo→archivo distintos.
- `crossModuleImports`: edges `import` con `crossModule` (incluye los que apuntan a un modulo).
- `modulePairs`: pares distintos `modulo origen → modulo destino` entre esos edges.
- `cycles`, `filesInCycles` (suma de `files` de los ciclos), `largestCycle` (0 sin ciclos).
- `mostImported` / `mostImporting`: hasta 10, solo con `count > 0`, por `count` descendente y despues
  `path`.

## Integracion

- `buildArchitectureGraph` agrega `health` al grafo (`/graph.json`).
- `checkArchitecture` agrega `cycles`: los de `findImportCycles` sobre el grafo del mismo target y
  modulo, cada uno con `file` = ruta absoluta de `files[0]` (`modulesPath` del target + `path`).
- Auditoria (`architectureFindings`): un hallazgo por ciclo: categoria `architecture_violation`,
  regla `import-cycle`, severidad `high` si `crossModule`, si no `medium`; `module` = `modules[0]`,
  `file` = `file`, `line` = `line`, mensaje `"Ciclo de imports (<n> archivos): <path unido por ' → '>"`,
  sugerencia `"Extrae lo compartido a un modulo comun o invierte la dependencia con un contrato."`.
  Un check sin `cycles` (resultados viejos) no aporta hallazgos.
- Plan: tarea `break-import-cycles` ("Romper ciclos de dependencias", categoria `architecture`,
  regla `import-cycle`), despues de `remove-unused-files`, con `dependsOn`
  `add-characterization-tests` y `add-component-tests`.

## Criterios de aceptacion

- Ciclo de 2 y de 3 archivos, autoimport, dos componentes separados, archivos que no forman ciclo,
  imports a modulos ignorados, pares repetidos, `path` mas corto y orden.
- Un grafo lineal de 5000 archivos se procesa sin desbordar la pila.
- `architectureHealth` con los conteos y rankings de arriba.
- `/graph.json` trae `health`; el check trae `cycles` con ruta absoluta.
- Auditoria y Plan con la regla `import-cycle`.
