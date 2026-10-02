# Layout de la vista de modulo (Migracion / Diseño)

## Objetivo

En la vista de un modulo (`mapToFlow(map, "module", key)`) cada capa es una columna y sus archivos se
apilan debajo. Las tarjetas con nota larga (mapa de diseño to-be: "reemplaza X + Y…") son mas altas y,
con un paso fijo, quedaban tapadas por la siguiente. El paso pasa a depender de la altura estimada de
cada tarjeta.

## Reglas (puras, `infrastructure/react-flow/fileCardHeight.ts`)

- `fileCardHeight(note?)`: altura estimada de la tarjeta de archivo (220px de ancho, nota en 10px).
  - Sin nota (o nota vacia): `60`.
  - Con nota: `60 + 5 + lineas * 13`, con `lineas = ceil(note.length / 34)`.
- En `mapToFlow` (vista modulo) el primer archivo de cada capa va en `y = 110` y cada siguiente en
  `y anterior + fileCardHeight(nota anterior) + 10`.
- Sin notas el resultado es identico al anterior (paso de 70).

## Criterios de aceptacion

- `fileCardHeight()` y `fileCardHeight("")` = 60; una nota de 34 caracteres = 78; de 35 = 91.
- Un archivo cuya anterior en la capa tiene nota de 70 caracteres se ubica 60 + 5 + 3*13 + 10 = 114px
  mas abajo.
- El test existente (archivos sin nota, paso 70) sigue pasando.
