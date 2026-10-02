# Architecture Analyzers

## Objetivo

Construir un grafo navegable de modulos/archivos/imports y validar reglas de arquitectura (capas prohibidas y acoplamiento entre modulos) para proyectos Laravel/PHP o React/TypeScript organizados por modulos.

## Entradas

- `config`: configuracion del target (`laravel` o `react`) con `modulesPath`, capas, reglas de imports prohibidos, reglas de acoplamiento, `ignoredPaths` y (para `laravel`) `phpExtensions`.
- `reader`: puerto `SourceTreeReader` (dominio, vive en `app/modules/shared/domain/repositories`) que abstrae el acceso al sistema de archivos (`listDirectories`, `walkFiles`, `readText`, `isFile`). La implementacion real (`NodeFsSourceTreeReader`) vive en `app/modules/shared/infrastructure/filesystem`. Se movio de `architecture` a `shared` para que `audit` tambien lo pudiera usar sin depender de un detalle interno de `architecture`.
- `target`: `"laravel"` o `"react"`.
- `module`: filtro opcional por nombre de modulo.

## Comportamiento

- `buildArchitectureGraph` recorre los modulos del target, genera un nodo por modulo y por archivo, y un edge `contains` (modulo -> archivo) y `import` (archivo -> archivo/modulo) por cada import detectado.
- `checkArchitecture` recorre los mismos modulos y reporta, por modulo, violaciones de imports prohibidos por capa y acoplamientos directos entre modulos no permitidos.
- La resolucion de capa (`layer`) y de "rol" visual de cada archivo es pura (no toca el sistema de archivos), basada en la ruta relativa del archivo dentro del modulo.
- Toda lectura de directorios/archivos pasa por el puerto `SourceTreeReader`; `domain` y `application` no importan `node:fs` directamente.
- Para `laravel`, las extensiones de archivo a recorrer dentro de cada modulo (`reader.walkFiles(modulePath, extensions)`) se toman de `config.laravel.phpExtensions`, no de un literal `[".php"]` fijo. Esto permite incluir proyectos legacy que usan `.inc`/`.lib.inc` (u otras extensiones) ademas o en vez de `.php`. El default es `[".php"]` (ver `defaultConfig.ts`).
- El emparejamiento de extension es por sufijo (`endsWith`), por lo que `.lib.inc` es una extension compuesta valida y distinta de `.inc` (ver `app/modules/shared/specs/walk-files-filtering.md`).
- Tanto `laravel` como `react` pasan su `config.<target>.ignoredPaths` como tercer argumento de `reader.walkFiles(modulePath, extensions, ignoredPaths)` para excluir carpetas/archivos (p. ej. `**/vendor/**`, `**/__tests__/**`) dentro de cada modulo. El default de `laravel` es `["**/README.md"]` y el de `react` es `[]`.

## Salidas

- `ArchitectureGraph`: `{ generated_at, summary, nodes, edges }`.
- `ArchitectureCheckResult`: `{ checked_at, target, module, fail_on_coupling, passed, summary, reports }`.

## Criterios de Aceptacion

- Mismos resultados que la version original `.mjs` para los mismos proyectos de entrada (la migracion a TypeScript no cambia el comportamiento, solo invierte la dependencia de filesystem hacia un puerto de dominio).
- `checkArchitecture` con `failOnCoupling: false` no marca como fallido un reporte que solo tiene acoplamientos.
- `checkLaravelArchitecture`/`buildLaravelGraph` con `config.laravel.phpExtensions: [".php", ".inc"]` recorren tambien archivos `.inc` (y `.lib.inc`, cuyo nombre termina en `.inc`) dentro de cada modulo, ademas de `.php`.
- `config.laravel.phpExtensions: [".lib.inc"]` recorre solo archivos cuyo nombre termina en `.lib.inc`, no los `.inc` simples.
- Con `config.laravel.phpExtensions` en su default (`[".php"]`), el comportamiento es exactamente el de antes: solo se recorren archivos `.php`.
- Con `config.laravel.ignoredPaths: ["**/vendor/**"]`, los archivos PHP dentro de `vendor/` no aparecen en el grafo ni en el check; lo mismo para `config.react.ignoredPaths` en el lado React.

## Orden de carpetas para arboles React planos (`react.folderOrder`)

Fase 6 de `docs/react-target-plan.md`. Un frontend legacy suele no tener capas hexagonales
(`domain/`, `application/`…): sus "modulos" son carpetas tecnicas planas (`pages/`, `components/`,
`globals/`). Ahi la regla de arquitectura util es la DIRECCION de las dependencias: las carpetas de
arriba (entrada) pueden depender de las de abajo (base), nunca al reves.

### Config

- `react.folderOrder: Array<string | string[]>` (default `[]` = regla desactivada). Carpetas de primer
  nivel bajo `react.modulesPath`, de arriba hacia abajo. Un elemento `string[]` agrupa carpetas del
  mismo nivel (pueden importarse entre si).
- Ejemplo: `["routes", "pages", "partials", ["components", "stripes"], "globals", "languages"]`.

### Regla (`folderRank` / `folderOrderViolation`, puros, `domain/services/folderOrder.ts`)

- `folderRank(folderOrder, folder)`: indice del nivel que contiene la carpeta, o `null` si no esta.
- `folderOrderViolation(folderOrder, source, target)`: `true` solo si las dos carpetas tienen rango y el
  de `target` es MENOR que el de `source` (import hacia una carpeta de mas arriba). Misma carpeta, mismo
  nivel, o carpetas fuera de `folderOrder` → `false`.

### Check (`checkReactArchitecture`)

- Para cada import relativo/alias que resuelve a otro modulo (carpeta), si `folderOrderViolation`:
  agrega una **violacion** (no un coupling) con `module` = carpeta origen, `layer` = `null` si el
  archivo no esta en una capa (o su capa si la tiene), `target_module` = carpeta destino, `line`,
  `import`, `message` = `La carpeta "<origen>" depende de "<destino>", que esta por encima en
  react.folderOrder.` y `suggestion` = `Mover lo compartido a una carpeta inferior o invertir la
  dependencia (props, callbacks, contexto).`
- La regla aplica aunque el archivo no tenga capa (hoy el check saltea esos archivos para
  `forbiddenImports` y coupling; eso no cambia).
- Como es una violacion, fluye sola al audit (`architecture_violation`) y al plan.

### Criterios de aceptacion

- `folderRank`/`folderOrderViolation` cubren: arriba→abajo permitido, abajo→arriba violacion, mismo
  nivel (grupo) permitido, misma carpeta permitida, carpeta fuera del orden ignorada.
- Con `folderOrder: ["pages", "components"]`, un `components/x.js` que importa `../pages/y` produce una
  violacion; `pages/y.js` importando `../components/x` no.
- Sin `folderOrder` el resultado del check no cambia.
