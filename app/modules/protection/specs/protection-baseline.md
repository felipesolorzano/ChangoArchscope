# Linea base de proteccion (XRay X3)

## Objetivo

Antes de refactorizar legacy hay que saber cuanta red de seguridad existe: tests, cobertura,
mutation score y flujos E2E. ArchScope no ejecuta nada: cuenta la evidencia que ve y lee los reportes
que el proyecto ya genera. Plan: `docs/xray-plan.md`.

## Raiz del proyecto

La carpeta mas cercana hacia arriba (incluida la raiz del stack) que tiene `.git` (archivo o
carpeta); si no hay ninguna, la raiz del stack (`modulesPath`).

## Evidencia de tests (siempre)

- `testFiles`: archivos de test bajo la raiz del stack (aunque `ignoredPaths` los excluya del analisis:
  la config suele sacar los tests a proposito) y los `testPaths` del stack, de cualquier stack
  (`.js .jsx .ts .tsx .mjs .cjs .php`): los que coinciden con `.test.` / `.spec.` / `/__tests__/`, y
  los `*Test.php` dentro de una carpeta `tests` o `test` (convencion PHPUnit: un `*Test.php` suelto
  suele ser ejemplo de una libreria copiada).
- `sourceFiles`: archivos fuente de la raiz del stack que no son de test (extensiones del stack: JS/TS
  en react, `phpExtensions` en laravel), respetando `ignoredPaths`.

## Reportes (`domain/services/protectionReports.ts`, puro, reciben el texto)

- `parseIstanbulSummary(text)` (`coverage-summary.json`): `total.lines` → `{ covered, total }`.
- `parseLcov(text)` (`lcov.info`): suma de `LH:` (cubiertas) y `LF:` (totales).
- `parseClover(text)` (`clover.xml`, PHPUnit/Istanbul): el primer `<metrics …>` dentro de
  `<project>`: `coveredstatements` / `statements`.
- `parseStrykerReport(text)` (`mutation.json` o el `index.html` del reporte HTML, que trae el JSON en
  `app.report = …` con uniones `"+"` para no cerrar el `<script>`): conteo por estado `{ killed,
  survived, timeout, noCoverage }` (`Killed`, `Survived`, `Timeout`, `NoCoverage`; el resto no cuenta).
- `parseInfectionLog(text)` (log JSON de Infection): `stats.killedCount`, `escapedCount`,
  `timeOutCount`, `notCoveredCount` → mismo conteo.
- `parsePlaywrightResults(text)` (reporter JSON): `stats.expected + stats.flaky` → `passed`,
  `stats.unexpected` → `failed`.
- Todos devuelven `null` si el texto no tiene la forma esperada (JSON invalido, sin las claves).

## Descubrimiento y armado (`application/use-cases/buildProtectionBaseline.ts`)

`buildProtectionBaseline({ stackRoot, testPaths, extensions, ignoredPaths, reader })` →

```ts
{
  root,                         // raiz del proyecto
  tests: { testFiles, sourceFiles },
  coverage: { percent, covered, total, reports: string[] } | null,
  mutation: { score, killed, survived, timeout, noCoverage, reports: string[] } | null,
  e2e: { passed, failed, reports: string[] } | null,
  level: "none" | "low" | "medium" | "high",
}
```

- Busca bajo la raiz del proyecto (sin `node_modules`, `vendor`, ni ocultos) archivos llamados
  `coverage-summary.json`, `lcov.info`, `clover.xml`, `mutation.json`, `infection-log.json`,
  `results.json`, y los `index.html` que estan en una carpeta `mutation`. Un archivo que no se puede
  leer como su formato se ignora. Un `results.json` cuenta solo si es de Playwright.
- Varios reportes del mismo tipo se suman (`covered`/`total`, conteos de mutantes, tests E2E);
  `reports` = sus rutas relativas a la raiz, ordenadas.
- `percent` = `round(covered / total * 100)` (0 si `total` es 0); `score` =
  `round((killed + timeout) / (killed + timeout + survived + noCoverage) * 100)` (0 si no hay).
- `protectionLevel`: `none` si `testFiles` es 0 y no hay reportes; `high` si cobertura >= 80 y
  mutation >= 70; `medium` si cobertura >= 50 o mutation >= 50; si no `low`.

## Endpoint

`GET /protection.json?target=laravel|react` (raiz y extensiones del stack de la config).
`protectionStackOf(config, target)` (presentation, XRay X6) arma esa entrada del stack (`stackRoot`,
`testPaths`, `extensions`, `ignoredPaths`; react con `react.testPaths`, laravel sin testPaths): la usan
el controller y el Plan (nivel de proteccion para el gate de la fase 3).

## UI (Plan)

Franja "Red de seguridad" en el encabezado de Plan: nivel (Ninguna / Baja / Media / Alta, con color),
`"<testFiles> archivos de test · <sourceFiles> fuente"`, `"Cobertura <percent>%"` o `"Cobertura: sin
reporte"`, `"Mutation <score>%"` o `"Mutation: sin reporte"`, `"E2E <passed>/<passed+failed>"` o
`"E2E: sin reporte"`. Con nivel `none`: `"Sin red de seguridad: empezar por tests de caracterizacion"`.

## Criterios de aceptacion

- Cada parser con su formato real y con entradas invalidas.
- Stryker desde JSON y desde HTML (con `"+"`), Infection, Playwright.
- Descubrimiento: suma de varios reportes, ignora carpetas excluidas y `results.json` ajenos, raiz por
  `.git`.
- Niveles en sus bordes (80/70, 50).
