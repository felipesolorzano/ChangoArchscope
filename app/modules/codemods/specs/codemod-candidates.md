# Candidatos a codemod (XRay X5)

## Objetivo

Responder "que se puede modernizar en bloque, con que herramienta, y es seguro hacerlo hoy?". Agrupa
por patron los hallazgos de APIs legacy del audit, sugiere el codemod (o marca la migracion como
manual) y dice que archivos afectados tienen tests que los cubran: sin tests, primero se caracteriza
(X4). No ejecuta nada ni escribe en el proyecto: es el insumo de "Refactor". Plan: `docs/xray-plan.md`.

## Entradas

- El `AuditSnapshot` del target (contrato publicado de `audit`): findings `legacy_api`
  (`app/modules/audit/specs/legacy-api.md`), `jquery-usage` (React) y `testedBy`.
- `sourceRoot` (raiz del stack) y el `stack`.

## Catalogo (`domain/services/codemodCatalog.ts`, datos)

Por `pattern`: `{ stack, title, tool, command, note }`. `tool`/`command` nulos = migracion manual.
`command` puede traer `{paths}`.

| pattern | stack | title | tool | command | note |
|---|---|---|---|---|---|
| `unsafe-lifecycles` | react | Lifecycles deprecados (componentWillMount/ReceiveProps/Update) | react-codemod | `npx react-codemod rename-unsafe-lifecycles {paths}` | Solo renombra a UNSAFE_*: pasarlos a componentDidMount / getDerivedStateFromProps / componentDidUpdate sigue siendo manual. |
| `react-dom-render` | react | ReactDOM.render / hydrate → createRoot | codemod | `npx codemod@latest react/19/replace-reactdom-render` | Correr en la raiz del proyecto (React 18+). |
| `string-refs` | react | String refs → createRef | codemod | `npx codemod@latest react/19/replace-string-ref` | Correr en la raiz del proyecto. |
| `find-dom-node` | react | findDOMNode → ref | – | – | Pasar una ref al elemento y usar ref.current. |
| `with-router` | react | withRouter → hooks de React Router v6 | – | – | useNavigate / useLocation / useParams; los componentes de clase necesitan un wrapper funcion o pasar a funcion. |
| `jquery` | react | jQuery → DOM nativo / estado de React | – | – | Reemplazar selectores y efectos por refs/estado; $.ajax por fetch. |
| `lib-moment` | react | moment → date-fns / dayjs | – | – | Mantenimiento finalizado; revisar formatos y locales. |
| `lib-request` | react | request → fetch / axios | – | – | Libreria deprecada. |
| `lib-react-ga` | react | react-ga → react-ga4 | – | – | Universal Analytics ya no recibe datos. |
| `ereg` | laravel | ereg / split → preg_* | rector | `vendor/bin/rector process {paths} --dry-run` | Regla EregToPregMatchRector (PHP 7.0). |
| `each` | laravel | each() → foreach | rector | `vendor/bin/rector process {paths} --dry-run` | Reglas WhileEachToForeachRector y ListEachRector (PHP 7.2); otros usos de each() son manuales. |
| `create-function` | laravel | create_function → closure | rector | `vendor/bin/rector process {paths} --dry-run` | Regla CreateFunctionToClosureRector (PHP 7.2). |
| `utf8-encode` | laravel | utf8_encode / utf8_decode → mb_convert_encoding | rector | `vendor/bin/rector process {paths} --dry-run` | Regla Utf8DecodeEncodeToMbConvertEncodingRector (PHP 8.2). |
| `mysql` | laravel | mysql_* → mysqli / PDO | – | – | Cambia el manejo de conexion y errores: migracion manual. |
| `mcrypt` | laravel | mcrypt → openssl | – | – | Verificar que lo cifrado antes se pueda descifrar despues. |
| `money-format` | laravel | money_format → NumberFormatter | – | – | |
| `magic-quotes` | laravel | magic quotes → quitar | – | – | Devuelven false desde PHP 5.4: el codigo que depende de ellas es muerto. |

## Candidatos (`domain/services/codemodCandidates.ts`, puro)

`codemodCandidates({ stack, sourceRoot, findings, testedBy })` → candidatos:

- Hallazgo de un patron: `legacy_api` con `details.pattern` del catalogo del `stack`; en react ademas
  `jquery-usage` → `jquery`. Patrones sin hallazgos no aparecen.
- Se excluyen los archivos con `manual-copy-file` o `possibly-unused-file` (se borran, no se migran).
- Por archivo: `{ file, occurrences, testedBy }`; `file` relativo a `sourceRoot` (posix);
  `occurrences` = suma de `details.count` (1 si no viene) de sus hallazgos del patron; `testedBy` =
  `testedBy[archivo absoluto]` relativo a `sourceRoot` (`[]` si no hay). Orden: mas ocurrencias
  primero, empate por `file`.
- Candidato: `{ pattern, title, tool, command, note, files, occurrences, protectedFiles }`;
  `occurrences` = suma de los archivos; `protectedFiles` = archivos con `testedBy` no vacio;
  `command` con `{paths}` reemplazado por las rutas de `files` entre comillas dobles, separadas por espacio.
- Orden: primero los que tienen `tool` (automaticos), despues mas archivos, empate por `pattern`.

## Armado y endpoint

- `buildCodemodPlan({ snapshot, sourceRoot, stack })` → `{ candidates }` (`testedBy` ausente → `{}`).
- `GET /codemods.json?target=` (snapshot cacheado del audit, igual que `characterization`).

## Criterios de aceptacion

- Patrones de cada stack, `jquery-usage` solo en react, patrones de otro stack ignorados.
- Exclusiones, ocurrencias con y sin `count`, `testedBy` relativo, `protectedFiles`.
- `command` con y sin `{paths}`, manual con nulos; orden de archivos y de candidatos.
- Validacion real: brandsites (lifecycles, withRouter, moment, jQuery) y mc (each, split, utf8_encode).
