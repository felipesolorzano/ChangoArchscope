# Mapas de bounded contexts exportados

Copia versionada de los mapas que viven en la base SQLite local (`database/*.sqlite`, fuera de git).
Mismo esquema que `docs/bounded-context-map-schema.md`.

| Archivo | Target | Contenido |
|---|---|---|
| `react.json` | `react` | as-is del frontend React legacy: 12 contextos, 259 archivos |
| `react-design.json` | `react-design` | to-be hexagonal: 12 modulos, 223 piezas con la nota de que reemplazan |

Para restaurar uno en otra maquina (con el servidor corriendo):

```bash
curl -X PUT -H 'Content-Type: application/json' \
  --data @docs/maps/react-design.json \
  "http://127.0.0.1:4590/bounded-context-map?target=react-design"
```
