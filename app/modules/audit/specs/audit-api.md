# Audit API (HTTP)

## Objetivo

Exponer el `AuditSnapshot` completo de un proyecto via HTTP, para que la UI u otros
clientes consuman el diagnostico de Audit sin pasar por el CLI. Reusa exactamente la misma
salida que produce el comando `audit` (ver `audit-cli.md`): findings de arquitectura +
findings nativos de PHP + `summary` + `riskScore` + `riskBreakdown`.

## Componentes y capas

- `application/use-cases/AuditProject.ts` (`auditProject`): orquesta el lado Audit. Recibe
  un `ArchitectureCheckResult` ya calculado (no llama a `architecture`, igual que `RunAudit`)
  mas lo necesario para escanear PHP, y devuelve el `AuditSnapshot`.
- `presentation/http/AuditController.ts` (`AuditController`): composition root del endpoint.
  Lee la configuracion, llama a `checkArchitecture` (modulo `architecture`) para obtener el
  `ArchitectureCheckResult`, y delega en `auditProject`. Responde JSON.
- `presentation/routes/api.ts` (`auditApiRoutes`): registra las rutas del modulo y las
  conecta con el controlador. Se monta desde `routes/web.ts` para responder en la raiz
  (`/audit.json`), igual que `/graph.json` y `/check.json` del modulo `architecture`, en
  vez de bajo el prefijo `/api`.

## `auditProject` (application)

Firma: `auditProject(input: AuditProjectInput): AuditSnapshot`, con

```text
AuditProjectInput = {
  checkResult: ArchitectureCheckResult;  // unico acoplamiento con architecture (tipo)
  reader: SourceTreeReader;
  parser: PhpSourceParser;
  phpRoot: string | null;                // null cuando el target no es laravel
  phpExtensions: string[];
  ignoredPaths: string[];
}
```

Comportamiento:

- Si `phpRoot` no es `null`: escanea con `scanPhpFiles(reader, parser, phpRoot, phpExtensions, ignoredPaths)`
  (que devuelve `{ files, skipped }`) y corre los seis analizadores nativos
  (`phpComplexityAnalyzer`, `phpCouplingAnalyzer`, `phpDeadCodeAnalyzer`, `phpSecurityAnalyzer`,
  `phpDatabaseAnalyzer`, `phpTestingAnalyzer`) sobre `files` (escaneo/parseo una sola vez).
  Los archivos que el parser no pudo procesar quedan en `skipped` y se pasan a
  `buildAuditSnapshot` como `skippedFiles`. Si `phpRoot` es `null`: no hay findings nativos ni
  archivos omitidos.
- Combina `architectureFindings(checkResult)` (findings de arquitectura, primero) con los
  findings nativos (despues, en el orden de los analizadores listado arriba).
- Construye el snapshot con `buildAuditSnapshot(findings, { target, module, filesScanned, modules, phpRoot })`,
  tomando `target`, `module`, `filesScanned` (`summary.files_scanned`) y `modules`
  (`summary.modules`) del `checkResult`, y `phpRoot` solo cuando no es `null`.
- Es la misma composicion que hoy hace el CLI en `bin/chango-archscope.mjs`; el CLI pasa a
  reusar `auditProject` para no duplicar la logica.

## `AuditController` (presentation/http)

- Se construye con sus colaboradores inyectados (para test): `getConfig`, `reader`,
  `parser`, y `check` (la funcion `checkArchitecture` del modulo `architecture`).
- Handler `show(request, response, next)`:
  - `target`: `"react"` si `request.query.target === "react"`, en otro caso `"laravel"`.
  - `module`: `request.query.module` si es string no vacio, en otro caso `null`.
  - Obtiene `config = getConfig()` y `checkResult = check(config, reader, { target, module })`.
  - Calcula `phpRoot = target === "laravel" ? config.laravel.modulesPath : null`,
    `phpExtensions = config.laravel.phpExtensions`, `ignoredPaths = config.laravel.ignoredPaths`.
  - Responde `response.status(200).json(auditProject({ checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths }))`.
  - Cualquier error se delega a `next(error)` (lo formatea el middleware global como 400).

## Rutas

- `auditApiRoutes()` registra `GET /audit.json` apuntando al handler del controlador.
- Montado desde `routes/web.ts`, el endpoint final responde en la raiz: `GET /audit.json`.
- Query params: `?target=laravel|react` (default `laravel`), `?module=<Nombre>` (opcional).

## Salida

`AuditSnapshot` completo (ver `AuditSnapshot.ts`): `{ generatedAt, target, module, summary, findings, riskScore, riskBreakdown, skippedFiles }`, como JSON con `Content-Type: application/json`. `skippedFiles` lista los archivos que el parser no pudo procesar (`{ file, error }`) y `summary.files_skipped` su conteo; un archivo no parseable ya **no** provoca un 400, solo queda reportado ahi.

## Casos de borde

- `target=react`: `auditProject` no escanea PHP; el snapshot solo trae findings de arquitectura.
- Proyecto sin findings: `findings: []`, `riskScore.value: 0`, snapshot valido (200).
- Error al construir el snapshot (p. ej. config no registrada): se delega a `next` y el
  middleware responde 400 con `{ error }`.

## Criterios de aceptacion

- `auditProject` con un `checkResult` laravel y un `reader`/`parser` que entregan archivos PHP
  produce un `AuditSnapshot` cuyos `findings` incluyen los de arquitectura y los nativos.
- `auditProject` con `phpRoot: null` no invoca el escaneo de PHP y devuelve solo los findings
  de arquitectura.
- `AuditController.show` responde `200` con el `AuditSnapshot` devuelto por `auditProject` y
  pasa al `check` el `target`/`module` derivados del query.
- `AuditController.show` delega cualquier error a `next` sin responder el snapshot.
- `GET /audit.json` retorna el `AuditSnapshot` del target solicitado.
