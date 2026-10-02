# Pestaña Dependencias (F3)

## Objetivo

Mostrar el reporte de `/dependencies.json` para saber que actualizar: cuantos paquetes estan al dia,
a que version ir con el runtime elegido (PHP / Node / npm, default = el detectado), que esta
deprecated o abandonado y que tan viejo es lo instalado. Plan: `docs/dependencies-plan.md`.

## Capas

- `domain/value-objects/DependencyReport.ts`: tipos del reporte (espejo del backend).
- `application/contracts/DependenciesProvider.ts`: `getReport(target, runtimes, refresh)`.
- `infrastructure/api/HttpDependenciesProvider.ts`: `GET <reportUrl>?target=&php=&node=&npm=&refresh=1`
  (solo los runtimes con valor; `refresh=1` solo si se pide).
- `infrastructure/factory/createDependenciesExplorerDependencies.ts` (`{ reportUrl }`).
- `presentation/store/dependenciesExplorerStore.ts` (Zustand): `runtimes` elegidos
  (`Partial<Record<kind, string>>`), filtros (`status: DependencyStatus | "all"`, `query`, `hideDev`),
  `selected` (llave `ecosystem:name` del paquete abierto) y sus setters. Expone `getServerState` =
  `getState` (la app no hace SSR; asi el render estatico de los tests ve el estado actual).
- `presentation/hooks/useDependenciesReport.ts`: carga al montar y al cambiar el runtime elegido o el
  target; `refresh()` recarga con `refresh=1`. Expone `report`, `loading`, `error`, `refresh`.
- `presentation/utils/dependencyView.ts` (puro, mutation): helpers de abajo.
- Componentes: `RuntimeSelector`, `DependencySummary`, `DependencyFilters`, `DependencyList`,
  `DependencyDrawer`; pagina `DependenciesExplorer`.
- El shell agrega la pestaña "Dependencias" (despues de Diseño) con `reportUrl: "/dependencies.json"`
  y el target global; montada con `key` de vista + target (cambiar de stack reinicia el estado y el
  store se resetea al montar).

## Helpers (`dependencyView.ts`)

- `STATUS_ORDER`: `abandoned`, `deprecated`, `major`, `minor`, `patch`, `unknown`, `up_to_date`
  (de lo mas urgente a lo sano).
- `statusLabel(status)`: Abandonado, Deprecated, Major, Minor, Patch, Desconocido, Al dia.
- `statusColor(status)`: abandoned/deprecated `#dc2626`, major `#ea580c`, minor `#d97706`,
  patch `#ca8a04`, unknown `#64748b`, up_to_date `#16a34a`.
- `dependencyKey(dep)`: `"<ecosystem>:<name>"`.
- `filterDependencies(deps, { status, query, hideDev })`: `status` distinto de `"all"` deja solo ese
  estado; `query` (sin espacios al borde, sin distinguir mayusculas) busca en `name`; `hideDev` quita
  los `dev`.
- `groupByStatus(deps)`: `[{ status, items }]` en `STATUS_ORDER`, sin grupos vacios, `items` por
  `name` (orden alfabetico con `localeCompare`).
- `manifestLabel(manifest, root)`: ruta del manifiesto relativa a `root` (rutas posix absolutas): si
  esta dentro, sin el prefijo (`/p/src/a/package.json` con root `/p/src` → `a/package.json`); si esta
  arriba, con `../` por cada nivel (`/p/package.json` → `../package.json`; `/x/composer.json` con
  root `/p/src` → `../../x/composer.json`). Se compara por segmentos (`/p/srcx` no esta dentro de
  `/p/src`) y una `/` final en `root` se ignora.
- `ageLabel(publishedAt, now)`: `""` si no hay fecha; `"hoy"` (< 1 dia), `"hace N dias"`
  (< 30 dias; `"hace 1 dia"`), `"hace N meses"` (< 365 dias, meses de 30 dias; `"hace 1 mes"`),
  `"hace N años"` (dias / 365, hacia abajo; `"hace 1 año"`).
- `upgradeHint(dep)`: texto corto del siguiente paso, en este orden:
  1. `lookupError` y `status` `unknown` → `"Sin datos del registro: <lookupError>"`.
  2. `abandoned` → `"Abandonado: reemplazar por <replacement>"` o `"Abandonado: buscar reemplazo"`.
  3. `recommended` nulo y `limitedByRuntime` → `"Ninguna version vigente funciona con el runtime
     elegido: requiere uno mas nuevo"`.
  4. `deprecated` → `"Deprecated: <deprecation>"` (con `recommended`: agrega `" · ir a
     <recommended>"`).
  5. `limitedByRuntime` → `"Actualizar a <recommended> (la <latest> requiere un runtime mas nuevo)"`.
  6. `patch`/`minor`/`major` → `"Actualizar a <recommended>"`.
  7. Si no → `"Al dia"`.
- `runtimeOptions(runtime)`: opciones del selector de un runtime:
  - primero la detectada, si hay: `{ value: version, label: "<version> (detectado: <source>)" }`;
  - despues una por linea conocida (`RUNTIME_LINES[kind]`), con la version mas reciente conocida de
    esa linea, sin repetir la detectada: `{ value, label: "<Kind> <linea> (<value>)" }`.
  - `RUNTIME_LINES`: php `5.6.40, 7.0.33, 7.1.33, 7.2.34, 7.3.33, 7.4.33, 8.0.30, 8.1.33, 8.2.29,
    8.3.26, 8.4.13`; node `12.22.12, 14.21.3, 16.20.2, 18.20.8, 20.19.5, 22.20.0, 24.9.0`; npm
    `6.14.18, 7.24.2, 8.19.4, 9.9.4, 10.9.3, 11.6.1`. Linea = mayor.menor en php, mayor en node/npm.
  - Etiquetas de kind: PHP, Node, npm.
- `versionText(dep)`: `"—"` sin `current`; `current` si no hay `recommended` o es igual; si no,
  `"<current> → <recommended>"`.
- `upToDatePercent(summary)`: `round(up_to_date / total * 100)`; 100 si `total` es 0.

## Vista

- Barra: titulo "Dependencias", subtitulo `"<total> paquetes en <manifiestos> manifiestos"` y boton
  "Refrescar" ("Consultando…" mientras carga; deshabilitado). La barra de pestañas del shell queda
  centrada arriba: el selector de runtime va en el cuerpo, no en la barra.
- Fila "Calcular con" (primera del cuerpo) con un selector por cada runtime del reporte (`RuntimeSelector`): `<select>` con `runtimeOptions`; el valor es
  `runtimes[kind]` del store o, si no hay, el `selected` del reporte. Cambiarlo guarda en el store y
  recarga con ese runtime.
- Resumen (`DependencySummary`): `"<P>% al dia"`, barra por estado (ancho proporcional, color de
  `statusColor`) y un chip por estado con cantidad > 0 (`"<label> <n>"`); click en un chip filtra
  por ese estado (otra vez → `all`). Si `limitedByRuntime > 0`: `"<n> limitados por el runtime"`; si
  `lookupErrors > 0`: `"<n> sin datos del registro"`.
- Filtros: buscador por nombre y casilla "Ocultar dev".
- Lista (`DependencyList`): grupos de `groupByStatus` sobre lo filtrado, encabezado `"<label> · <n>"`
  con borde del color del estado; fila por paquete: nombre, chip `dev` si aplica, chip del ecosistema
  (`npm` / `composer`), `"<current> → <recommended>"` (o `"<current>"` si son iguales o no hay
  recomendada; `"—"` si no hay actual), `ageLabel(currentPublishedAt)`, `upgradeHint`. Click → abre el
  drawer. Sin coincidencias: "Ningun paquete coincide con los filtros".
- Drawer (`DependencyDrawer`): nombre, ecosistema, manifiesto (`manifestLabel`), constraint, instalada,
  actual (con antiguedad), recomendada, ultima (con antiguedad), `upgradeHint`, error de consulta
  ("datos de cache viejos" si `stale`), y link al registro (`https://www.npmjs.com/package/<name>` o
  `https://packagist.org/packages/<name>`). Cerrar limpia `selected`.
- Estados: cargando sin reporte → "Consultando registros… (la primera vez puede tardar unos
  segundos)"; error → el mensaje.

## Criterios de aceptacion

- Los helpers cumplen los ejemplos de arriba (mutation dirigido al 100%).
- Provider: arma la URL con target, solo los runtimes con valor y `refresh=1`; error HTTP → lanza con
  el status.
- Componentes renderizados (SSR): selector con opciones y valor, resumen con porcentaje/chips, lista
  agrupada con hint y antiguedad, drawer con link al registro, estados de carga/error.

## F4: seguridad y soporte (UI)

El reporte trae por paquete `security` (`vulnerabilities[{ id, cve, summary, severity, fixedIn }]`,
`maxSeverity`, `recommendedAffected`), `advisoryError` y `support` (`{ product, cycle, eol, isEol,
latestInCycle }` o `null`); por runtime `support` y `cycles[{ cycle, latest, eol, isEol }]`; y en el
resumen `vulnerable`, `bySeverity` y `endOfLife`
(ver `app/modules/dependencies/specs/security-and-support.md`).

### Helpers (`dependencyView.ts`)

- `severityLabel(severity)`: Critica, Alta, Moderada, Baja, Desconocida.
  `severityColor`: critical `#991b1b`, high `#dc2626`, moderate `#ea580c`, low `#ca8a04`,
  unknown `#64748b`.
- `securityBadge(dep)`: `""` sin vulnerabilidades; si no `"<n> vuln · <severidad max>"` (`"vulns"` si
  `n > 1`).
- `supportLabel(support)`: `""` si `null`; vencido: `"sin soporte desde <eol>"` (eol fecha) o
  `"sin soporte"`; vigente: `"soporte hasta <eol>"` (fecha) o `"con soporte"`.
- `upgradeHint`: despues de "Sin datos del registro" y antes de todo lo demas, si hay
  vulnerabilidades: si esta abandonado, `"Vulnerable (<severidad max>): <pista de abandonado>"` (la
  salida es el reemplazo); si no, `"Vulnerable (<severidad max>): ninguna version compatible corrige
  todo"` si `recommendedAffected`; si no, `"Vulnerable (<severidad max>): actualizar a <recommended>"` (o
  `"Vulnerable (<severidad max>): <siguiente paso>"` si no hay `recommended`, con el texto que
  daria el resto de las reglas).
- `runtimeOptions(runtime)`: si `runtime.cycles` no esta vacio, despues de la detectada van hasta 12
  ciclos (en el orden recibido, del mas nuevo al mas viejo) con `latest`, sin repetir la detectada:
  `{ value: latest, label: "<Kind> <cycle> (<latest>) · <supportLabel del ciclo>" }`; si no hay
  ciclos, las lineas fijas de siempre (`RUNTIME_LINES`).
- `filterDependencies` acepta `onlyVulnerable`: deja solo los que tienen vulnerabilidades.

### Vista

- Store: `onlyVulnerable` (default `false`) y `toggleVulnerable()`.
- Resumen: si `vulnerable > 0`, chip "Vulnerables <n>" (activo con `onlyVulnerable`) antes de los de
  estado; nota `"<n> fuera de soporte"` si `endOfLife > 0`.
- Selector de runtime: debajo de cada select, `"<Kind> <cycle>: <supportLabel>"` del `support` del
  runtime (clase de alerta si `isEol`); nada si no hay `support`.
- Fila: badge `securityBadge` con el color de la severidad maxima y etiqueta `"sin soporte"` si
  `support.isEol`.
- Drawer: fila "Soporte" (`"<product> <cycle> · <supportLabel>"`) si hay `support`; seccion
  "Vulnerabilidades" con una entrada por vulnerabilidad (`cve` o `id`, severidad, `summary`,
  `"corregida en <fixedIn>"` o `"sin version corregida"`, link `https://osv.dev/vulnerability/<id>`);
  `advisoryError` como `"OSV: <error>"`.

## F5: uso y grupos (UI)

Cada paquete trae `usage` (`{ files, inManifest, unused }` o `null`) y `group` (string o `null`); el
resumen trae `unused`.

- `usageLabel(dep)` (helper): `""` si `usage` es `null`; `"sin uso"` si `unused`; si no,
  `"<files> archivo(s)"` (`"1 archivo"`, `"N archivos"`) y `" + manifiesto"` si `inManifest`
  (`"en el manifiesto"` si `files` es 0).
- `groupMates(dep, all)` (helper): nombres (orden alfabetico) de los otros paquetes con el mismo
  `group` no nulo.
- Resumen: nota `"<n> sin uso"` si `unused > 0`.
- Fila: etiqueta `"sin uso"` (clase `deps-tag--unused`) si `usage.unused`.
- Drawer: filas "Uso" (`usageLabel`, si no es vacio) y "Actualizar junto con" (`groupMates` unidos por
  `", "`, si hay alguno).

## F6: librerias copiadas a mano (UI)

Cada paquete puede traer `vendored: { files }` (copiada a mano, sin manifiesto) y el resumen trae
`vendored` (ver `app/modules/dependencies/specs/vendored-libraries.md`).

- `filesLabel(n)` (helper): `"1 archivo"` / `"<n> archivos"` (lo usan "Copias" y `usageLabel`).
- Fila: etiqueta `"copiada"` (`deps-tag--vendored`) si `vendored`.
- Drawer: para las copiadas, la fila del manifiesto se llama "Copia en" y se agrega
  "Copias" = `"<n> archivo"` / `"<n> archivos"`.
- Resumen: nota `"<n> copiadas a mano"` si `vendored > 0`.
