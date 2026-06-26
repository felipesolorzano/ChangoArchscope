# PHP Compatibility Analyzer

## Objetivo

Octavo analizador de Audit (Fase 8 de `docs/audit.md`): auditoria de compatibilidad de version de PHP. Responde "que rompe si actualizo el runtime de PHP a la version objetivo?". Genera `AuditFinding` de categoria `php_compatibility` a partir de los hallazgos de `PHPCompatibility` (un estandar de `PHP_CodeSniffer`).

A diferencia de los seis analizadores nativos (Fases 2-7), este **no** usa el AST de `php-parser` en JS puro. Delega la deteccion a una herramienta externa (`phpcs` + `PHPCompatibility`) que corre dentro de un contenedor Docker aislado. Por eso introduce un nuevo valor de `AuditFindingSource`: `external`. Sigue siendo analisis **estatico** (lee archivos `.php`, no levanta la aplicacion, ni Apache/Nginx, ni base de datos), pero rompe la invariante "sin requerir PHP instalado" de `docs/audit.md`: requiere Docker disponible en la maquina que corre Archscope. Esa ruptura se justifica en `docs/audit.md` y se mitiga con degradacion elegante (ver abajo).

## Regla de oro

El repo auditado **nunca** se modifica. No se ejecuta `composer require` dentro del proyecto del cliente. El repo solo se monta en modo lectura (`:ro`) dentro del contenedor. Toda la toolchain (`phpcs` + `PHPCompatibility`) vive en una imagen propia de Archscope, no en el repo escaneado.

## Tipo de hallazgo crudo (`PhpCompatibilityIssue`)

Resultado normalizado de un mensaje de `phpcs`. Vive en `app/modules/audit/domain/value-objects/PhpCompatibilityIssue.ts`:

- `file: string` — ruta relativa a la raiz del repo (sin el prefijo de montaje `/repo/`).
- `line: number`.
- `rule: string` — el `source` de phpcs (codigo del sniff), p. ej. `PHPCompatibility.FunctionUse.RemovedFunctions.eachFound`.
- `severityRaw: "error" | "warning"` — derivado del campo `type` de phpcs (`ERROR` / `WARNING`).
- `message: string` — el mensaje humano de phpcs (incluye desde/hasta que version aplica).

## Puerto de scanner (`PhpCompatibilityScanner`)

Puerto de dominio en `app/modules/audit/domain/repositories/PhpCompatibilityScanner.ts`. Mismo patron que `PhpSourceParser`: el dominio define la interfaz, la infraestructura la implementa. El dominio nunca invoca Docker.

```ts
export type PhpCompatibilityScanResult =
  | { status: "ok"; targetPhp: string; issues: PhpCompatibilityIssue[] }
  | { status: "unavailable"; reason: string };

export type PhpCompatibilityScanner = {
  scan(repoPath: string, targetPhp: string, extensions: string[]): Promise<PhpCompatibilityScanResult>;
};
```

- `status: "ok"`: el scan corrio. `issues` puede ser `[]` (proyecto ya compatible).
- `status: "unavailable"`: el entorno no permitio correr el scan (Docker ausente, build de imagen fallida, timeout). `reason` es un texto corto y legible. **Nunca** se lanza una excepcion por causas de entorno; el scanner las traduce a `unavailable` para no tumbar el resto del audit.

## Adapter Docker (`DockerPhpcsScanner`)

Implementacion real del puerto en `app/modules/audit/infrastructure/compat/DockerPhpcsScanner.ts`. Es la unica pieza que conoce Docker y el formato JSON de phpcs (igual que `PhpAstParser` es lo unico que conoce el AST de `php-parser`).

Comportamiento:

1. Verifica que Docker este disponible (`docker --version`). Si no: retorna `{ status: "unavailable", reason: "Docker no esta disponible" }`.
2. Asegura la imagen `chango/php-compat:<tag>`: si no existe localmente, la construye desde `tools/php-compatibility/Dockerfile`. Si el build falla: `unavailable`.
3. Ejecuta el contenedor montando el repo en solo lectura y un directorio temporal para la salida:

   ```bash
   docker run --rm \
     -v <repoPath>:/repo:ro \
     -v <outDir>:/output \
     chango/php-compat:<tag> \
     --standard=PHPCompatibility \
     --runtime-set testVersion <targetPhp> \
     --extensions=<extensions> \
     --report=json \
     --report-file=/output/php-compatibility.json \
     /repo
   ```

   `<extensions>` se deriva de `phpExtensions` de `chango-archscope.config` (las mismas que usan los analizadores nativos), no de un valor fijo `php`. La conversion la hace `phpcsExtensionsArg` (pura, testeable): quita el punto inicial de cada extension y la reduce a su ultimo segmento, porque phpcs solo mira la ultima extension del archivo (`foo.lib.inc` -> `inc`) y una extension sin tokenizer se tokeniza como PHP por defecto. Asi `[".php", ".inc", ".lib.inc"]` -> `php,inc`. La cache del endpoint web incluye las extensiones en su clave.

   `phpcs` sale con codigo distinto de 0 cuando encuentra hallazgos; eso es exito, no error. El adapter distingue "phpcs encontro issues" (esperado) de "phpcs no pudo correr" (-> `unavailable`).
4. Lee `php-compatibility.json` y mapea cada mensaje a `PhpCompatibilityIssue`:
   - Formato phpcs: `{ files: { "<ruta absoluta>": { messages: [{ message, source, type, line, column, fixable }] } } }`.
   - `file`: la clave del archivo, con el prefijo de montaje `/repo/` removido para quedar relativa a la raiz del repo.
   - `severityRaw`: `type === "ERROR"` -> `"error"`; `type === "WARNING"` -> `"warning"`.
   - `rule`: el campo `source` del mensaje.
   - Mensajes con `source` que no empieza por `PHPCompatibility` se ignoran (defensa por si la imagen trae sniffs extra).
5. Retorna `{ status: "ok", targetPhp, issues }`.

El adapter es asincrono e impuro; por eso vive en `infrastructure` y se inyecta. La construccion del `docker run`, el manejo de `outDir` temporal y el parseo del JSON quedan encapsulados aqui.

## Comportamiento del analizador (`phpCompatibilityAnalyzer`)

Funcion **pura y sincrona**, identica en forma a `phpSecurityAnalyzer`: solo mapea el resultado del scanner a `AuditFinding[]`. No toca Docker ni filesystem; el adapter ya hizo el trabajo impuro.

`phpCompatibilityAnalyzer(scan: PhpCompatibilityScanResult): AuditFinding[]`

- Si `scan.status === "unavailable"`: retorna `[]`. La ausencia del scan no produce findings; el estado "no corrio" se reporta en el `summary` del snapshot (ver "Integracion"), no como finding.
- Si `scan.status === "ok"`: un `AuditFinding` por cada `PhpCompatibilityIssue`, en el mismo orden recibido.
- Mapeo de severidad (sin thresholds):
  - `severityRaw: "error"` -> `high` (funcion/sintaxis removida en la version objetivo: rompe).
  - `severityRaw: "warning"` -> `medium` (deprecado o comportamiento cambiado: riesgoso, no rompe seguro).
  - Un mapeo mas fino por codigo de sniff (p. ej. `critical` para removidos en 8.0 como `each`/`create_function`) queda como extension futura documentada, no v1.
- Cada finding:
  - `category: "php_compatibility"`, `source: "external"`, `module: ""`, `class: null`.
  - `file`, `line`, `message` copiados del issue.
  - `suggestion`: `undefined` (phpcs no entrega remediacion estructurada en v1).
  - `details: { rule: issue.rule, targetPhp: scan.targetPhp }`.

## Version objetivo configurable por scan

`targetPhp` es un parametro de cada scan, no una constante:

- CLI: flag `--php-version <X.Y>`, por defecto `8.3`. Se valida con el patron `^\d+\.\d+$`; valor invalido aborta con error claro (es input del usuario, no del entorno, por eso aqui si se lanza error).
- Web/React: el modulo de scan envia `targetPhp` por request, de modo que un mismo repo puede auditarse contra 8.1, 8.3 u 8.4 sin reconstruir nada.
- El valor viaja sin tocarse hasta `--runtime-set testVersion` de phpcs, que acepta versiones y rangos.

## Integracion (resumen; detalle en spec posterior)

- `AuditFindingSource` pasa de `"architecture" | "native"` a `"architecture" | "native" | "external"`.
- `AuditSnapshot.summary` gana un campo opcional `scanners?: { php_compatibility?: { status: "ok" | "unavailable" | "skipped"; targetPhp?: string; reason?: string } }`. Opcional para no romper snapshots ni tests existentes. `skipped` = no se pidio compatibilidad en ese audit.
- `auditProject` recibe opcionalmente el `PhpCompatibilityScanResult` ya resuelto (el orquestador corre el adapter async antes de llamar a `auditProject`, que se mantiene sincrono y testeable). Si no se provee, la categoria queda en `skipped` y no se agregan findings.
- La construccion real del `DockerPhpcsScanner`, el flag `--php-version` en `bin/chango-archscope.mjs`, el endpoint web y el nodo de React Flow se especifican en una spec de `presentation`/`infrastructure` posterior.

## Casos invalidos o de borde

- Docker ausente: `scan` retorna `unavailable`; el audit nativo (Fases 1-7) corre normal y completo; `summary.scanners.php_compatibility.status = "unavailable"`.
- Proyecto ya compatible: `scan` retorna `ok` con `issues: []`; cero findings de la categoria; `status: "ok"`.
- Archivo con error y warning a la vez: dos issues, dos findings (uno `high`, uno `medium`).
- Mensaje de phpcs cuyo `source` no empieza por `PHPCompatibility`: se descarta, no genera finding.
- `targetPhp` con formato invalido (`"8"`, `"php8"`): error de validacion en CLI antes de tocar Docker.

## Criterios de Aceptacion

- Un `PhpCompatibilityScanResult` `ok` con N issues produce exactamente N findings, todos `category: "php_compatibility"` y `source: "external"`.
- Un issue `severityRaw: "error"` produce un finding `high`; uno `warning`, un finding `medium`.
- Un resultado `unavailable` produce `[]` findings (sin lanzar error).
- Cada finding lleva `details.rule` (el sniff de phpcs) y `details.targetPhp` (la version del scan).
- El mismo `PhpCompatibilityScanResult` produce siempre los mismos findings (funcion pura).
- El adapter mapea correctamente un JSON de phpcs de fixture (ERROR -> error, WARNING -> warning, ruta sin prefijo `/repo/`), sin necesidad de Docker en el test.

## Notas de implementacion

- `phpCompatibilityAnalyzer` vive en `app/modules/audit/application/analyzers/phpCompatibilityAnalyzer.ts`. Es puro: mapea `PhpCompatibilityIssue` -> `AuditFinding` (severityRaw -> severity), sin Docker, sin async, sin filesystem. Testeable con datos en memoria, igual que `phpSecurityAnalyzer`.
- `PhpCompatibilityScanner` (puerto) en `domain/repositories/`; `DockerPhpcsScanner` (adapter) en `infrastructure/compat/`. El adapter se testea contra un JSON de phpcs de fixture (el parseo/normalizacion), no contra Docker real.
- `tools/php-compatibility/Dockerfile`: `php:8.3-cli` + composer + `squizlabs/php_codesniffer` + `phpcompatibility/php-compatibility`, con `phpcs --config-set installed_paths`. La imagen es de Archscope, no del repo escaneado.
- Primero `docker run` directo; `docker compose` se reserva para ambientes controlados como envoltura opcional posterior, no es requisito de esta fase.
