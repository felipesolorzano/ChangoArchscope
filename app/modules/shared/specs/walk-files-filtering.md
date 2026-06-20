# SourceTreeReader.walkFiles: filtrado por extension y exclusion de paths

## Objetivo

Recorrer recursivamente un directorio raiz y devolver los archivos que coinciden con
las extensiones configuradas, permitiendo excluir carpetas o archivos mediante patrones
glob. Esto habilita proyectos PHP legacy que usan extensiones compuestas (`.lib.inc`,
`.inc`) y permite ignorar carpetas como `vendor`, `node_modules` o tests dentro del
`modulesPath`.

## Entradas

- `directory`: ruta raiz del recorrido (normalmente el `modulePath` de un modulo).
- `extensions`: lista de extensiones a incluir, p. ej. `[".php"]`, `[".php", ".inc"]`,
  `[".lib.inc"]`.
- `ignoredPaths` (opcional): lista de patrones glob a excluir, relativos a `directory`,
  p. ej. `["**/vendor/**", "**/*.test.php"]`. Por defecto es una lista vacia (no excluye
  nada).

## Reglas de comportamiento

- El emparejamiento de extension es por **sufijo del nombre de archivo** (`endsWith`), no
  por la ultima extension. Asi `[".inc"]` incluye `foo.inc` y `foo.lib.inc`, mientras que
  `[".lib.inc"]` incluye solo `foo.lib.inc` y no `foo.inc`. El emparejamiento es sensible
  a mayusculas/minusculas, como antes.
- Las exclusiones se evaluan sobre la **ruta relativa en formato posix** desde `directory`.
- Un archivo se descarta si su ruta relativa coincide con algun patron de `ignoredPaths`,
  aunque su extension este incluida.
- Una carpeta se **poda** (no se desciende en ella) si su ruta relativa coincide con algun
  patron. Asi `**/vendor` poda la carpeta `vendor` completa sin visitarla, y `**/vendor/**`
  filtra los archivos que esten dentro; ambos producen el mismo conjunto de archivos de
  salida (la diferencia es solo de rendimiento: el primero no desciende en la carpeta).
- Si `ignoredPaths` es vacio o no se pasa, el comportamiento es solo el filtrado por
  extension.
- Errores de lectura de directorios se ignoran silenciosamente (se devuelve lo recorrido
  hasta el momento), igual que antes.
- El resultado se devuelve ordenado de forma estable (orden lexicografico por ruta).

## Salidas

- `string[]`: rutas absolutas de los archivos incluidos, ordenadas.

## Errores / casos invalidos

- Directorio inexistente o sin permisos: se devuelve `[]` (o lo recorrido), sin lanzar.
- Patron glob invalido: se trata como patron literal de minimatch (no lanza).

## Capas involucradas

- `domain`: puerto `SourceTreeReader` (firma `walkFiles(directory, extensions, ignoredPaths?)`).
- `infrastructure`: `NodeFsSourceTreeReader` (implementacion con `node:fs` + `minimatch`).

## Criterios de aceptacion

- `walkFiles(root, [".inc"])` incluye `a.inc` y `b.lib.inc`.
- `walkFiles(root, [".lib.inc"])` incluye `b.lib.inc` y excluye `a.inc`.
- `walkFiles(root, [".php"])` mantiene el comportamiento previo para archivos `.php`.
- `walkFiles(root, [".php"], ["**/vendor/**"])` excluye cualquier `.php` dentro de
  `vendor/` y no desciende en `vendor`.
- `walkFiles(root, [".php"], ["**/*.test.php"])` excluye archivos `*.test.php` pero
  conserva el resto de `.php`.
- `walkFiles(root, [".php"], [])` equivale a `walkFiles(root, [".php"])`.
