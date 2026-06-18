# Audit CLI

## Objetivo

Exponer el comando `audit` en `bin/chango-archscope.mjs`, que construye el `ArchitectureCheckResult` real para un target (cargando configuracion y llamando a `checkArchitecture`), lo consolida con `architectureFindings`, y cuando el target es `laravel` ademas escanea los archivos `.php` reales y corre todos los analizadores nativos disponibles (`phpComplexityAnalyzer`, `phpCouplingAnalyzer`) sobre ellos. Todas las fuentes de findings se combinan en un solo `AuditSnapshot`. El comando debe fallar (exit code 1) cuando el snapshot tiene findings con severidad igual o mayor a un umbral configurable.

## Entradas

- `--target laravel|react` (default `laravel`, igual que `graph`/`check`).
- `--module <name>` (opcional, igual que `graph`/`check`).
- `--severity-threshold low|medium|high|critical` (opcional, default `high`).
- `--config <file>`, `--laravel-modules <path>`, `--react-modules <path>` (mismos flags ya soportados por `loadRuntimeConfig`).

## Comportamiento

- Carga la configuracion con el mismo mecanismo que `graph`/`check` (`loadRuntimeConfig`).
- Llama a `checkArchitecture(config, reader, { target, module })` para obtener el `ArchitectureCheckResult`. El flag `--fail-on-coupling` de `check` no aplica aqui: el snapshot ignora `passed`/`fail_on_coupling` (ver `run-audit.md`).
- Calcula `architectureFindings(checkResult)` (ver `run-audit.md`).
- Si `target === "laravel"`: llama a `scanPhpFiles(reader, new PhpAstParser(), config.laravel.modulesPath, config.laravel.phpExtensions)` para obtener `PhpFileStructure[]`, y corre sobre ese mismo resultado `phpComplexityAnalyzer` (ver `php-complexity-analyzer.md`) y `phpCouplingAnalyzer` (ver `php-coupling-analyzer.md`), concatenando sus findings. Los archivos se escanean y parsean una sola vez para ambos analizadores. Si `target === "react"`: no hay findings nativos todavia (lista vacia); React/TypeScript no tiene analizador nativo en esta fase.
- Combina la lista de `architectureFindings` con todas las listas de findings nativos y llama a `buildAuditSnapshot(findings, { target, module, filesScanned: checkResult.summary.files_scanned, modules: checkResult.summary.modules })` para obtener el `AuditSnapshot` final.
- Imprime `JSON.stringify(snapshot, null, 2)` en stdout.
- Calcula `exceedsSeverityThreshold(snapshot, threshold)`: verdadero si algun finding tiene severidad igual o mayor al umbral, segun el orden `low < medium < high < critical`.
- `process.exitCode` es `1` si `exceedsSeverityThreshold` es verdadero, `0` en caso contrario.
- Si `--severity-threshold` recibe un valor que no es `low`, `medium`, `high` ni `critical`, el comando termina con error (mismo manejo de errores que ya existe en el `try/catch` de `bin/chango-archscope.mjs`) y no imprime el snapshot.

### `scanPhpFiles`

Caso de uso en `app/modules/audit/application/use-cases/ScanPhpFiles.ts`: `scanPhpFiles(reader: SourceTreeReader, parser: PhpSourceParser, phpRoot: string, extensions: string[] = [".php"]): PhpFileStructure[]`.

- Recorre `phpRoot` con `reader.walkFiles(phpRoot, extensions)` (recursivo, igual que usa `architecture`). El default `[".php"]` mantiene el comportamiento actual cuando no se pasa nada (por ejemplo, en los tests existentes).
- Por cada archivo, lee el texto con `reader.readText(file)` y lo parsea con `parser.parse(file, source)`.
- Solo escanea y parsea; no corre ningun analizador. Reemplaza a `scanPhpComplexity` (que hacia ambas cosas) para que multiples analizadores nativos puedan compartir el mismo resultado sin parsear los archivos mas de una vez.
- El comando `audit` le pasa `config.laravel.phpExtensions`, la misma lista de extensiones que ya usa `architecture` (ver `architecture-analyzers.md`), para que ambos modulos vean el mismo conjunto de archivos PHP de un proyecto con extensiones no estandar (`.inc`, `.lib.inc`, etc.).

### `buildAuditSnapshot`

Funcion pura en `app/modules/audit/domain/services/auditSnapshotBuilder.ts`: `buildAuditSnapshot(findings: AuditFinding[], context: { target: string; module: string | null; filesScanned: number; modules: number }): AuditSnapshot`.

- `summary.findings_count = findings.length`, `by_category`/`by_severity` agregados contando `findings`.
- `riskScore`: cada finding aporta un peso segun su severidad (`low: 1, medium: 2, high: 3, critical: 4`) sumado a `riskScore.value`; `riskScore.breakdown` acumula ese peso por `category`.
- `generatedAt` usa la hora actual (`new Date().toISOString()`).
- Esta funcion reemplaza el calculo de `riskScore`/`summary` que antes vivia dentro de `RunAudit`; `runAudit(checkResult)` ahora es `buildAuditSnapshot(architectureFindings(checkResult), { target: checkResult.target, module: checkResult.module, filesScanned: checkResult.summary.files_scanned, modules: checkResult.summary.modules })`, sin cambiar su firma ni su salida observable (los pesos `high: 3` y `medium: 2` reproducen exactamente los pesos fijos que ya tenia `RunAudit` para violations/couplings).

## Salidas

- JSON del `AuditSnapshot` en stdout.
- Exit code `0` o `1` segun el umbral de severidad.

## Casos invalidos o de borde

- `--severity-threshold` con un valor invalido: error claro, exit code `1`, sin imprimir JSON parcial.
- Snapshot sin findings: exit code `0` siempre, sin importar el umbral.
- Snapshot con solo findings de severidad menor al umbral (ej. solo `medium` con umbral `high`): exit code `0`.
- `target === "react"`: `scanPhpFiles` no se ejecuta; el snapshot solo trae findings de `architectureFindings`.
- Un PHP root sin archivos `.php` (`reader.walkFiles` retorna `[]`): `scanPhpFiles` retorna `[]`, ningun analizador nativo aporta findings y no hay error.

## Criterios de Aceptacion

- `exceedsSeverityThreshold(snapshot, "high")` es `true` si hay al menos un finding `high` o `critical`, `false` si todos son `low`/`medium`.
- `exceedsSeverityThreshold(snapshot, "medium")` es `true` si hay al menos un finding `medium`, `high` o `critical`.
- Un snapshot sin findings nunca excede ningun umbral.
- `scanPhpFiles` con dos archivos PHP retorna dos `PhpFileStructure`, uno por archivo, sin analizar nada todavia.
- El `AuditSnapshot` final del comando `audit --target laravel` incluye findings de `architecture` y de ambos analizadores nativos (`complexity` y `coupling_low_level`) cuando todos producen resultados.
- `buildAuditSnapshot` con los mismos findings que ya cubre `run-audit.test.ts` (mapeados desde un `checkResult`) produce el mismo `riskScore`/`summary` que el `runAudit` original.

## Notas de implementacion

- `exceedsSeverityThreshold` es una funcion pura en `app/modules/audit/domain/services/auditSeverityUtils.ts` (mismo patron que `architecturePathUtils.ts`: logica pura sin acceso a filesystem).
- `buildAuditSnapshot` vive en `app/modules/audit/domain/services/auditSnapshotBuilder.ts`: misma carpeta/patron que `auditSeverityUtils.ts`.
- `scanPhpFiles` es un caso de uso de aplicacion (recibe `reader`/`parser` como parametros, no los instancia ni importa `node:fs`/`php-parser` directamente).
- El comando `audit` en `bin/chango-archscope.mjs` es glue code (parseo de flags, orquestacion, impresion) y sigue el mismo patron que `graph`/`check` en ese archivo; no lleva test dedicado, igual que esos dos comandos hoy. Ahi se instancia el `PhpAstParser` real y se le pasa a `scanPhpFiles`.
- `bin/chango-archscope.mjs` importa codigo compilado desde `build/server/`; tras implementar, correr `npm run build:node` antes de probar el comando manualmente.
