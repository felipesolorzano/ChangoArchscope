# Architecture Analyzers

## Objetivo

Construir un grafo navegable de modulos/archivos/imports y validar reglas de arquitectura (capas prohibidas y acoplamiento entre modulos) para proyectos Laravel/PHP o React/TypeScript organizados por modulos.

## Entradas

- `config`: configuracion del target (`laravel` o `react`) con `modulesPath`, capas, reglas de imports prohibidos y reglas de acoplamiento.
- `reader`: puerto `SourceTreeReader` (dominio) que abstrae el acceso al sistema de archivos (`listDirectories`, `walkFiles`, `readText`, `isFile`). La implementacion real (`NodeFsSourceTreeReader`) vive en `infrastructure/filesystem`.
- `target`: `"laravel"` o `"react"`.
- `module`: filtro opcional por nombre de modulo.

## Comportamiento

- `buildArchitectureGraph` recorre los modulos del target, genera un nodo por modulo y por archivo, y un edge `contains` (modulo -> archivo) y `import` (archivo -> archivo/modulo) por cada import detectado.
- `checkArchitecture` recorre los mismos modulos y reporta, por modulo, violaciones de imports prohibidos por capa y acoplamientos directos entre modulos no permitidos.
- La resolucion de capa (`layer`) y de "rol" visual de cada archivo es pura (no toca el sistema de archivos), basada en la ruta relativa del archivo dentro del modulo.
- Toda lectura de directorios/archivos pasa por el puerto `SourceTreeReader`; `domain` y `application` no importan `node:fs` directamente.

## Salidas

- `ArchitectureGraph`: `{ generated_at, summary, nodes, edges }`.
- `ArchitectureCheckResult`: `{ checked_at, target, module, fail_on_coupling, passed, summary, reports }`.

## Criterios de Aceptacion

- Mismos resultados que la version original `.mjs` para los mismos proyectos de entrada (la migracion a TypeScript no cambia el comportamiento, solo invierte la dependencia de filesystem hacia un puerto de dominio).
- `checkArchitecture` con `failOnCoupling: false` no marca como fallido un reporte que solo tiene acoplamientos.
