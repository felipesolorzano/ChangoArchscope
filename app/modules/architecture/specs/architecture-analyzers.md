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
