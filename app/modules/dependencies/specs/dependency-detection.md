# Deteccion de dependencias, runtimes y clasificacion (F1)

## Objetivo

Inventariar los paquetes declarados por el proyecto de un stack (npm y Composer) con su version
instalada, detectar el runtime que usa (PHP / Node / npm) y clasificar un paquete contra sus releases
publicadas y el runtime elegido. Plan general: `docs/dependencies-plan.md`.

## Value objects (`domain/value-objects/Dependency.ts`)

```ts
type Ecosystem = "npm" | "composer";
type RuntimeKind = "php" | "node" | "npm";
type DeclaredDependency = { ecosystem; name; constraint; installed: string | null; dev: boolean; manifest: string };
type DetectedRuntime = { kind; version: string | null; source: string };
type DependencyInventory = {
  root: string; manifests: string[]; runtimes: DetectedRuntime[];
  dependencies: DeclaredDependency[]; skipped: Array<{ manifest: string; reason: string }>;
};
```

`manifest` es la ruta absoluta del `package.json`/`composer.json` que lo declara.

## Versiones (`domain/services/versioning.ts`, puro)

- `normalizeVersion(raw)`: version semver `x.y.z[-pre]` o `null`. Quita `v`/`V` inicial y espacios
  (`"v1.2.3"` → `"1.2.3"`); completa con ceros (`"1.2"` → `"1.2.0"`); conserva prerelease
  (`"2.0.0-beta.1"`); cuatro partes se recortan a tres (`"1.2.3.4"` → `"1.2.3"`); sin numero
  (`"dev-master"`, `""`) o con texto antes del numero (`"release-1.2"`) → `null`.
- `toNpmRange(constraint, ecosystem)`: rango evaluable por `semver`.
  - npm: igual.
  - composer: alternativas por `||` o `|` (→ `||`); dentro, condiciones por `,` o espacios (AND,
    con espacios normalizados); `~X.Y` (dos partes) → `>=X.Y.0 <(X+1).0.0`; `~X.Y.Z`, `^`, `*`,
    `X.Y.*`, comparadores y rangos con guion quedan igual; se quitan flags de estabilidad
    (`@dev`, `@stable`...) y la `v` inicial de cada version.
- `satisfiesConstraint(version, constraint, ecosystem)`: `true` si la version cumple; version o
  rango invalido → `false`.
- `minVersionOf(constraint, ecosystem)`: menor version que cumple (`"^8.1"` → `"8.1.0"`,
  `">=18.18"` → `"18.18.0"`); invalido → `null`.
- `versionGap(from, to)`: `"major" | "minor" | "patch" | "none"`. `none` si `to <= from`; si no, la
  parte mas alta que cambia. Ir a una prerelease cuenta por la parte que cambia (`1.2.3` →
  `2.0.0-rc.1` es `major`, → `1.3.0-beta` es `minor`); un cambio solo de prerelease es `patch`.

## Parseo de manifiestos (`domain/services/parseManifests.ts`, puro, recibe texto)

- `parsePackageManifest(manifest, text, lockText)` → `{ dependencies, runtime }`:
  - `dependencies` → `dev: false`; `devDependencies` → `dev: true`; `optionalDependencies` →
    `dev: false`. Orden: el de aparicion (dependencies, devDependencies, optionalDependencies).
  - `installed`: del lock v2/v3 `packages["node_modules/<name>"].version`; si no, del lock v1
    `dependencies[<name>].version`; normalizado; sin lock o sin entrada → `null`.
  - `runtime`: `{ node: engines.node, npm: engines.npm, packageManager }` (constraints crudos;
    `undefined` si no estan).
- `parseComposerManifest(manifest, text, lockText)` → `{ dependencies, runtime }`:
  - `require` → `dev: false`, `require-dev` → `dev: true`.
  - Se omiten requisitos de plataforma: `php`, `php-64bit`, `hhvm`, `composer`,
    `composer-plugin-api`, `composer-runtime-api`, `ext-*`, `lib-*`.
  - `installed`: de `composer.lock` (`packages` y `packages-dev`, por `name`), normalizado.
  - `runtime`: `{ php: require.php, platformPhp: config.platform.php }`.
- JSON invalido en el manifiesto → se lanza error (el caso de uso lo registra en `skipped`); un lock
  invalido se ignora (`installed: null`).

## Manifiestos del stack (`application/use-cases/detectDependencies.ts`)

`detectDependencies({ root, ignoredPaths, reader, probe })` → `DependencyInventory`:

- **Abajo**: `reader.walkFiles(root, ["package.json", "composer.json"], [...ignoredPaths,
  "**/node_modules", "**/vendor"])`, solo archivos cuyo nombre es exactamente `package.json` o
  `composer.json`.
- **Arriba (principal)**: si `root` no tiene `package.json`/`composer.json`, por cada tipo se sube
  carpeta por carpeta y se toma el primero que exista; se deja de subir al pasar por una carpeta
  con `.git` (archivo o carpeta) o al llegar a la raiz del filesystem. Si `root` mismo tiene `.git`,
  no se sube.
- Manifiesto **principal** de un tipo: el que esta en `root` o el encontrado hacia arriba. Los
  anidados (debajo de `root`) aportan dependencias pero no definen el runtime.
- El lock se lee de la misma carpeta (`package-lock.json`, `composer.lock`) si existe.
- `manifests`: rutas absolutas sin repetir, ordenadas por codigo de caracter (incluye los que se
  omitieron por JSON invalido). `dependencies`: en el orden de `manifests`.
- La deteccion corre en cada llamada (sin cache): agregar un paquete aparece al refrescar.

## Runtimes (`domain/services/detectRuntimes.ts`, puro)

`detectRuntimes({ composer, npm, nodeVersionFile }, kinds, probe)` → un `DetectedRuntime` por cada
`kind` pedido, en el orden de `kinds` (`detectDependencies` los pide en orden `php`, `node`, `npm`):

- `kinds`: `php` si hay algun manifiesto composer o el target es `laravel`; `node` y `npm` si hay
  algun manifiesto npm o el target es `react`.
- **php**: `config.platform.php` del composer principal (source `"composer.json config.platform.php"`)
  → `minVersionOf(require.php)` (`"composer.json require.php"`) → `probe("php")` (`"local"`) → `null`
  (`"desconocido"`).
- **node**: `.nvmrc` (o `.node-version` si no hay `.nvmrc`) junto al `package.json` principal (texto sin
  `v`, si es una version; `lts/*` o alias no cuentan; source `".nvmrc"`/`".node-version"`) →
  `minVersionOf(engines.node)` (`"package.json engines.node"`) → `probe("node")` (`"local"`).
- **npm**: `packageManager` `"npm@x.y.z"` (`"package.json packageManager"`) →
  `minVersionOf(engines.npm)` (`"package.json engines.npm"`) → `probe("npm")` (`"local"`).
- Toda version sale normalizada; una declaracion invalida (version o rango que no se puede leer) cae
  al siguiente origen. `packageManager` solo cuenta si empieza con `npm@` (`yarn@`, `pnpm@` no).
- La entrada es `{ composer?, npm?, nodeVersionFile? }`: declaraciones del composer principal
  (`{ php?, platformPhp? }`), del package.json principal (`{ node?, npm?, packageManager? }`) y el
  archivo de version de Node junto a el (`{ name, text }`); cada una ausente/`null` si no hay; `probe` es una
  funcion `kind → version | null`.

`RuntimeProbe` (puerto, `application/contracts`): `versionOf(kind): string | null`. Adaptador
`infrastructure/runtime/LocalRuntimeProbe` ejecuta `php -r "echo PHP_VERSION;"`, `node -v`,
`npm -v` con timeout; error → `null`.

## Clasificacion (`domain/services/classifyDependency.ts`, puro)

```ts
type PackageRelease = { version; deprecated: string | null; requires: Partial<Record<RuntimeKind, string>>; publishedAt: string | null };
type PackageInfo = { ecosystem; name; releases: PackageRelease[]; abandoned: string | true | null };
type RuntimeSelection = Partial<Record<RuntimeKind, string>>;
type DependencyStatus = "up_to_date" | "patch" | "minor" | "major" | "deprecated" | "abandoned" | "unknown";
```

`classifyDependency(dependency, info | null, selection)` → `DependencyReport` = la dependencia +
`{ current, latest, recommended, gap, status, deprecation, replacement, limitedByRuntime,
currentPublishedAt, latestPublishedAt }`:

- `current`: `installed`, si no `minVersionOf(constraint)`, si no `null`.
- Releases estables: version valida sin prerelease. `latest`: la mayor estable (`null` si no hay).
- `recommended`: la mayor estable no deprecated cuyos `requires[kind]` cumple `selection[kind]`
  (constraint evaluado con las reglas del ecosistema); un `kind` sin valor en la seleccion no
  restringe. `null` si ninguna.
- `limitedByRuntime`: `true` si la mayor estable no deprecated existe y es distinta de
  `recommended` (si todas estan deprecated, `false`).
- Las releases pueden venir en cualquier orden: se ordenan por semver (`1.10.0` > `1.9.0`).
- `deprecated` se evalua solo sobre la release `current`: que otras esten deprecated no cambia el
  estado.
- `gap`: `versionGap(current, recommended)`; `none` si alguno es `null`.
- `status`: sin `info` o sin releases estables → `unknown`; `abandoned` no nulo → `abandoned`; la
  release igual a `current` esta deprecated → `deprecated`; si no, `gap` (`none` → `up_to_date`).
- `deprecation`: mensaje de la release `current`; si `current` no esta entre las releases y todas las
  estables estan deprecated (el paquete entero dejo de mantenerse, p. ej. `jquery-mobile`), el de la
  ultima; si no, `null`. `replacement`: `abandoned` si es string.
- `currentPublishedAt` / `latestPublishedAt`: `publishedAt` de la release estable igual a `current` /
  `latest` (`null` si no esta o no tiene fecha). Sirven para mostrar la antiguedad (F3).

## Endpoint

- `GET /dependencies.json?target=laravel|react` → `DependencyInventory` del stack (raiz =
  `modulesPath`, `ignoredPaths` del stack). Proxy de Vite para desarrollo.

## Errores / casos invalidos

- Manifiesto con JSON invalido: se omite y se agrega a `skipped` con el mensaje del error.
- Lock invalido: se ignora. Directorios ilegibles: lo que haya.
- `target` desconocido → `laravel` (mismo criterio que el resto).

## Capas

- `domain`: value objects, `versioning`, `parseManifests`, `detectRuntimes`, `classifyDependency`.
- `application`: `detectDependencies`, puerto `RuntimeProbe` (usa `SourceTreeReader` de shared).
- `infrastructure`: `LocalRuntimeProbe`.
- `presentation`: `DependenciesController`, `routes/api.ts`.

## Criterios de aceptacion

- `versioning`: los ejemplos de arriba, incluido `~1.2` composer vs npm y `|`/`,`.
- Un `package.json` con lock v1 y otro con lock v3 dan `installed` correcto; sin lock `null`.
- `composer.json` omite `php`/`ext-*` y toma `installed` de `packages-dev`.
- Raiz sin manifiesto con `package.json` en el padre y otro en el abuelo (que tiene `.git`): se toma
  solo el del padre; con `.git` en la raiz no se sube.
- `node_modules`/`vendor` no aportan manifiestos; `ignoredPaths` tambien aplica.
- Runtimes: precedencias de cada `kind` y fallback a `local`/`desconocido`.
- Clasificacion: `up_to_date`, `patch/minor/major`, `deprecated`, `abandoned` con reemplazo,
  `unknown`; `recommended` limitada por `require.php` / `engines.node` del runtime elegido.
