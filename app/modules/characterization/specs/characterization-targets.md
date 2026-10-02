# Objetivos de caracterizacion (XRay X4)

## Objetivo

Antes de refactorizar legacy hay que congelar su comportamiento. Este modulo decide QUE proteger
primero y entrega esqueletos de tests de caracterizacion para empezar (no los ejecuta ni los escribe en
el proyecto: es el insumo de "Guardian"). Plan: `docs/xray-plan.md`.

## Entradas

- El `AuditSnapshot` del target (contrato publicado de `audit`, igual que lo usa `plan`).
- Los `nodes`/`edges` del grafo de arquitectura del mismo target (cuantos archivos importan a cada uno).
- `sourceRoot` (raiz del stack).

## Candidatos (`domain/services/characterizationTargets.ts`, puro)

`characterizationTargets({ stack, sourceRoot, findings, riskByFile, importersByFile })` → hasta 20
objetivos, de mayor a menor `score` (empate por `file`):

- Candidato: archivo con hallazgos `untested-component` (react) o `untested-complex-method` (laravel).
- Se excluye un archivo con `manual-copy-file` o `possibly-unused-file`: lo que sobra se borra, no se
  protege.
- `file`: ruta relativa a `sourceRoot` (posix). `risk`: `riskByFile[file absoluto]` (0 si no esta).
  `importers`: archivos distintos que lo importan (0 si no esta).
- `score` = `round(risk × log2(2 + importers))` (el uso multiplica: romper algo muy importado es peor).
- `kind`: laravel → `"php"`; react → `"page"` si alguna carpeta del path es `pages`, `page`, `routes`,
  `views` o `screens`; si no `"component"`.
- `untested`: react → `{ name, complexity, exportedAs }` de cada `untested-component` (nombre
  `default` → nombre del archivo en PascalCase: `page.checkout` → `PageCheckout`; `exportedAs` del
  hallazgo; un hallazgo sin esa clave (snapshot viejo) → `"default"` si el nombre era `default`, si no
  el nombre); laravel → `{ name:
  "<Clase>::<metodo>", complexity: null }` de cada `untested-complex-method`. Sin repetir, en el orden
  de los hallazgos.
- `endpoints`: endpoints distintos de los hallazgos `http-in-component`, `duplicate-endpoint` y
  `hardcoded-api-url` del archivo (`details.endpoint` no nulo), en orden de aparicion.

## Esqueletos (`domain/services/characterizationSkeletons.ts`, puro)

`characterizationSkeletons(target)` → `[{ kind, path, content }]`:

- react: `rtl` si algun componente de `untested` se exporta; `msw` si hay `endpoints`; `playwright`
  si `kind` es `page`.
  - `rtl`: `path` = `<carpeta>/__characterization__/<archivo sin extension>.characterization.test.<jsx|tsx>`
    (tsx si el fuente es `.ts`/`.tsx`); importa `../<archivo sin extension>`. En JSX cada componente
    se usa con su nombre en PascalCase (`checkout` → `Checkout`: en minuscula seria una etiqueta
    HTML): el de `exportedAs: "default"` como import por defecto con ese nombre, los demas con import
    nombrado (`{ cartlist as Cartlist }` si el nombre cambia): `import Checkout, { Cart } from
    "../page.checkout"`. Un `it` por componente exportado que hace `render(<Nombre />)` y
    `expect(container).toMatchSnapshot()`, con un `TODO` para los props reales; los no exportados
    quedan como comentario (`// <nombre> no se exporta: se caracteriza a traves de quien lo usa`).
  - `msw`: `<carpeta>/__characterization__/<archivo sin extension>.handlers.js`; `import { http,
    HttpResponse } from "msw"`; un `http.all("*<endpoint>*" …)` por endpoint que responde
    `HttpResponse.json({})` con un `TODO` de capturar la respuesta real.
  - `playwright`: `e2e/characterization/<archivo sin extension>.spec.ts`; un `test` que hace
    `page.goto("/")` con `TODO` de la ruta real y `expect(page).toHaveScreenshot()`.
- laravel: `phpunit` por clase de `untested` (orden de aparicion): `tests/Characterization/<Clase>
  CharacterizationTest.php`, clase `<Clase>CharacterizationTest extends TestCase`, un metodo
  `test_<metodo>_golden_master` por metodo, que compara el resultado serializado contra
  `__DIR__ . '/golden/<Clase>_<metodo>.json'` (golden master), con `TODO` de las entradas reales y un
  comentario con el archivo fuente.

## Armado y endpoint

- `buildCharacterizationPlan({ snapshot, graph, sourceRoot, stack })` → `{ targets: [target +
  skeletons] }`: `riskByFile` desde `snapshot.riskBreakdown.byFile`, `importersByFile` contando, por
  archivo destino, las fuentes distintas de edges `import` entre nodos `file` (ruta absoluta =
  `sourceRoot` + `path`).
- `GET /characterization.json?target=` (snapshot cacheado del audit + grafo del stack).

## Criterios de aceptacion

- Candidatos, exclusiones, score y orden (con empate), limite 20, kind por carpetas, nombres
  `default`, endpoints y metodos PHP sin repetir.
- Esqueletos: rutas, extensiones, imports y contenido clave de cada tipo; msw y playwright solo cuando
  corresponde.
- Validacion real: brandsites (checkout, paginas con endpoints) y mc (clases con mas riesgo).
