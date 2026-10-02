# Target global del proyecto (Laravel / React)

## Objetivo

Elegir UNA vez, en el shell de la app, que stack se analiza (`laravel` o `react`) y que las cinco
pestañas (Arquitectura, Auditoria, Plan, Migracion, Diseño) calculen sobre ese stack. La seleccion
vive en la URL (`?target=react`) para que sobreviva a un reload y se pueda compartir.

## Entradas

- `window.location.search` al iniciar.
- Click del usuario en el selector Laravel | React del shell.

## Reglas (helpers puros, `app/domain/projectTarget.ts`)

- `parseProjectTarget(value)`: `"react"` → `"react"`; cualquier otro valor (incluido ausente,
  vacio o mayusculas distintas) → `"laravel"`.
- `targetFromSearch(search)`: lee el parametro `target` de un query string y lo pasa por
  `parseProjectTarget`.
- `searchWithTarget(search, target)`: devuelve el query string con `target` seteado, preservando
  los demas parametros; empieza con `?`.
- `mapTargetFor(target, kind)`: target del mapa de bounded contexts que usa cada pestaña:
  - `laravel` + `migration` → `"laravel"`; `laravel` + `design` → `"design"` (targets historicos,
    preservan lo ya persistido).
  - `react` + `migration` → `"react"`; `react` + `design` → `"react-design"`.

## Estado

- Store Zustand `app/presentation/store/projectTargetStore.ts` con `target` y `setTarget(target)`;
  el valor inicial sale de `targetFromSearch(location.search())`.
- `setTarget` actualiza el store y la URL con `location.replaceSearch(searchWithTarget(...))`.
- El acceso a `window.location`/`window.history` vive en un adaptador
  (`app/infrastructure/browser/browserLocation.ts`: `search()` y `replaceSearch(search)`, que conserva
  el `pathname`); el store no toca globals del navegador.

## Propagacion

- El shell lee el target del store y lo pasa como prop de solo lectura a cada explorer, montado
  con `key={target}` (cambiar de stack reinicia el estado interno de la vista).
- Arquitectura: usa el target recibido (se elimina su selector propio del sidebar).
- Auditoria: pide `/audit-graph.json?target=<target>`; el filtro "PHP objetivo" solo se muestra
  con `laravel`.
- Plan: pide `/plan.json`, findings y cambios de estado con `target=<target>`.
- Migracion / Diseño: providers creados con `mapTargetFor(target, kind)`.

## Casos invalidos

- `?target=` con un valor desconocido → `laravel` (sin error).

## Capas

- `app/domain/projectTarget.ts` (puro, con test + mutation).
- `app/presentation/store/projectTargetStore.ts`, `App.tsx` (UI, fuera del mutation general).
- Hooks de cada explorer reciben el target como parametro.

## Criterios de aceptacion

- `parseProjectTarget`: `"react"` → react; `"laravel"`, `"React"`, `""`, `null`, `undefined`,
  `"vue"` → laravel.
- `targetFromSearch("?target=react&x=1")` → react; `targetFromSearch("")` → laravel.
- `searchWithTarget("?x=1", "react")` → `"?x=1&target=react"`; `searchWithTarget("?target=react", "laravel")`
  → `"?target=laravel"`; `searchWithTarget("", "react")` → `"?target=react"`.
- `mapTargetFor` devuelve los 4 valores de la tabla.
- Con `?target=react` en la URL, las cinco pestañas cargan datos del proyecto React (verificado
  manualmente en el navegador).
