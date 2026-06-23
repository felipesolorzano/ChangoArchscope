# Esquema del Mapa de Bounded Contexts (para agentes)

> Este documento es el **contrato** entre el agente que ANALIZA el proyecto y ChangoArchscope
> que GUARDA y MUESTRA el resultado. ChangoArchscope **no** detecta bounded contexts: eso lo
> hace un agente de IA (de forma general, para cualquier proyecto). El agente arma este JSON y
> lo guarda; el tool lo persiste y lo dibuja en React Flow (módulos → capas → archivos).

## Flujo

```
Tú: "genérame el mapa de bounded contexts"  →
  1) Agente: GET /bounded-context-source.json  (sabe DONDE esta el proyecto y QUE archivos analizar)
  2) Agente: lee esos archivos y razona los bounded contexts (general, para cualquier proyecto)
  3) Agente: arma el JSON segun este esquema  →  PUT /bounded-context-map  →  ChangoArchscope lo guarda
  4) React Flow lo muestra (editable y validable por un humano)
```

## Paso 0 — De donde saco los archivos (para el agente)

Antes de analizar, el agente consulta:

```
GET /bounded-context-source.json?target=laravel
```

Respuesta:
```jsonc
{
  "target": "laravel",
  "root": "/ruta/al/proyecto",        // raiz del codigo a analizar (de la config del tool)
  "extensions": [".php", ".inc", ".lib.inc"],
  "ignoredPaths": ["**/vendor/**", ...],
  "files": ["/ruta/.../MSToursExport.lib.inc", "..."]   // archivos en alcance (rutas absolutas)
}
```

El agente **lee el contenido de esos `files`** (tiene acceso al filesystem del repo), razona los
bounded contexts y arma el mapa. Asi no hace falta decirle la ruta a mano: el tool ya la sabe
(de `config.laravel.modulesPath`).

## Esquema JSON

```jsonc
{
  "generatedAt": "2026-06-20T10:00:00.000Z",   // ISO; cuando se genero
  "generatedBy": "claude-opus / nota libre",    // opcional: quien/que lo genero
  "modules": [
    {
      "key": "tours",                 // slug estable, unico (minusculas, [a-z0-9-])
      "name": "Tours",                // nombre legible del bounded context / modulo
      "description": "Catalogo y exportacion de tours.",  // opcional
      "validated": false,             // lo marca el humano al revisar (default false)
      "layers": {
        "domain":         [{ "path": "Tours/Domain/Tour.php", "note": "entidad raiz" }],
        "application":    [{ "path": "Tours/Application/ExportToursUseCase.php" }],
        "infrastructure": [{ "path": "Tours/Infrastructure/Persistence/SqlTourRepository.php" }],
        "presentation":   [{ "path": "Tours/Presentation/Http/TourController.php" }]
      }
    }
  ]
}
```

### Reglas

- `modules`: lista de bounded contexts. Cada uno es un modulo destino de la arquitectura hexagonal.
- `key`: identificador estable (slug). No cambiar entre regeneraciones para no perder ediciones.
- `layers`: SIEMPRE las 4 capas hexagonales (`domain`, `application`, `infrastructure`,
  `presentation`). Cualquiera puede ser `[]` si aun no hay archivos propuestos.
- Cada archivo: `{ "path": "<ruta destino propuesta>", "note": "<opcional>" }`. El `path` es el
  nombre/ubicacion propuesta del archivo en la arquitectura nueva (no necesariamente existe aun).
- `validated`: lo edita el humano en la UI; el agente lo deja en `false`.

### Convencion de capas (DDD/hexagonal)

- `domain`: entidades, value objects, reglas puras. Sin frameworks/DB/HTTP.
- `application`: casos de uso, puertos (contratos), DTOs.
- `infrastructure`: adaptadores, repositorios, clientes externos, persistencia.
- `presentation`: HTTP/controladores, vistas, CLI.

## Como guardarlo (API)

- **Guardar / reemplazar el mapa** (lo hace el agente):
  ```
  PUT /bounded-context-map?target=laravel
  Content-Type: application/json
  <body = el JSON de arriba>
  ```
  Respuesta: el mapa normalizado guardado.

- **Leer el mapa** (para revisar o para que un agente lo chequee):
  ```
  GET /bounded-context-map.json?target=laravel
  ```

- `target` por defecto `laravel`. El mapa se guarda por target.

## Dos mapas: archivos (as-is) y diseño (to-be)

Se usa el MISMO esquema y endpoint, separados por `target`:

- `target=laravel` → **mapa de archivos**: los archivos legacy del proyecto repartidos en
  modulos/capas (estado actual). Pestaña "Migración".
- `target=design` → **mapa de diseño**: las **clases hexagonales pequenas propuestas** (solo
  nombres) por modulo/capa, derivadas del mapa de archivos. Pestaña "Diseño".

El mapa de diseño se genera derivando del de archivos: por cada modulo, se proponen la entidad
de dominio, sus value objects, los casos de uso (a partir de las operaciones detectadas), el
puerto `<Entidad>Repository`, sus adaptadores de infraestructura (`Sql<Entidad>Repository`,
notifier/gateway/exporter segun el modulo) y el/los controlador(es) de presentacion. En el JSON
cada "archivo" es una clase propuesta: `{ "path": "Bookings/Application/CreateBookingUseCase.php" }`.
Se guarda con `PUT /bounded-context-map?target=design`.

## Notas

- El mapa es **editable por un humano** en la pestaña "Migración" (mover un archivo de capa,
  renombrar un modulo, marcar `validated`). Esas ediciones se guardan con el mismo `PUT`.
- El mapa es **legible**: cualquier agente puede `GET`earlo y revisar/criticar la particion.
- ChangoArchscope valida la forma (modulos con `key`/`name` y las 4 capas) y la persiste tal cual.
