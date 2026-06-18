# PHP Testing Analyzer

## Objetivo

Sexto y ultimo analizador nativo de PHP de Audit (Fase 7 de `docs/audit.md`): un proxy heuristico de cobertura. Detecta clases de PHPUnit (`extends TestCase`), y a partir de eso aproxima que clases de produccion no tienen ninguna evidencia de test, y dentro de esas, que metodos con logica real (no triviales) son los de mayor riesgo por falta de test.

No es cobertura real (no ejecuta nada): es presencia o ausencia de referencia al nombre de la clase dentro de archivos que contienen al menos una clase de test. Mismo nivel de certeza que `dead_code`: "posiblemente sin test", nunca "sin test garantizado". "Flujos criticos sin test" en sentido estricto (cruzar este resultado con que tan importante es el flujo para el negocio) queda fuera de esta fase: Audit no decide prioridades de negocio (ver `docs/audit.md`, seccion "Limites reales"); esta fase se queda en aproximar que metodos no triviales carecen de evidencia de test, dejando la priorizacion para un futuro `Planning`.

## Extension de `PhpClassStructure`

`PhpClassStructure` gana un campo nuevo:

- `extendsName: string | null`: el nombre de la clase que extiende (`class.extends`, un nodo `name`), o `null` si la clase no usa `extends`. `PhpAstParser` ya tenia toda la informacion para esto (el nodo `class` siempre trae `extends`), solo faltaba exponerla.

## Comportamiento del analizador (`phpTestingAnalyzer`)

`phpTestingAnalyzer(files: PhpFileStructure[]): AuditFinding[]`. Recibe el arreglo completo (necesita vista global, igual que `phpDeadCodeAnalyzer`/`phpDatabaseAnalyzer`).

- Una clase es "de test" si `extendsName` termina en `TestCase` (cubre `extends TestCase` y `extends \PHPUnit\Framework\TestCase`, sin distinguir el resto del namespace). Limitacion conocida: frameworks que no usan herencia de clase para definir tests (por ejemplo Pest, que usa funciones) no se detectan.
- `testReferencedNames`: union de `referencedNames` de todos los archivos que contienen al menos una clase de test.
- Por cada clase que **no** es de test, en cualquier archivo:
  - Si su nombre no esta en `testReferencedNames`: finding `category: "testing"`, `rule: "untested-class"`, `severity: "medium"`, `details: { name: <nombre de la clase> }`.
  - Si **ademas** no esta en `testReferencedNames`, por cada uno de sus metodos con `decisionPointsCount > 0` (logica real, no un getter/setter trivial): finding adicional `rule: "untested-complex-method"`, `severity: "high"`, `details: { name: <clase>, method: <metodo> }`. Un metodo con `decisionPointsCount === 0` dentro de una clase sin test no genera este segundo finding (evita ruido en getters/setters/delegacion simple).
- Las clases de test nunca generan findings de esta categoria (no se auditan a si mismas).
- Cada finding usa `source: "native"`, `module: ""`, `file`/`line` de la clase (para `untested-class`) o del metodo (para `untested-complex-method`).

## Salidas

`AuditFinding[]`: como maximo un `untested-class` por clase de produccion sin evidencia de test, mas un `untested-complex-method` por cada metodo no trivial de esa clase.

## Casos invalidos o de borde

- Un archivo sin ninguna clase no genera findings.
- Una clase de test (extiende algo que termina en `TestCase`) nunca genera findings, sin importar si tiene metodos complejos.
- Una clase de produccion cuyo nombre aparece referenciado en `referencedNames` de un archivo de test no genera `untested-class` (se asume que ese archivo de test la instancia, la usa como type hint, etc.).
- Una clase sin evidencia de test pero cuyos metodos son todos triviales (`decisionPointsCount === 0`) genera `untested-class` pero ningun `untested-complex-method`.
- Si el conjunto escaneado no tiene ninguna clase de test, todas las clases de produccion califican como sin evidencia de test (el set `testReferencedNames` queda vacio): es el comportamiento esperado, no un caso especial.

## Criterios de Aceptacion

- Una clase de produccion nunca referenciada en ningun archivo de test genera `untested-class`.
- Una clase de produccion referenciada en un archivo de test (por `new`, type hint, etc.) no genera `untested-class`.
- Una clase de test (`extends TestCase`) nunca genera findings, incluso si tiene metodos con `decisionPointsCount` alto.
- Dentro de una clase sin evidencia de test, cada metodo con `decisionPointsCount > 0` genera su propio `untested-complex-method`; los metodos con `decisionPointsCount === 0` no.
- Una clase con `extendsName: null` (no usa `extends`) se trata como clase de produccion normal, sujeta a las mismas reglas.

## Notas de implementacion

- `phpTestingAnalyzer` vive en `app/modules/audit/application/analyzers/phpTestingAnalyzer.ts`.
- En `bin/chango-archscope.mjs`, el comando `audit` agrega `phpTestingAnalyzer(phpFiles)` a la lista de analizadores nativos. Con esta fase quedan completos los seis analizadores nativos de PHP listados en `docs/audit.md`; la Fase 8 (agregacion de `RiskScore`/`TechnicalDebtSignal`) ya no agrega analizadores nuevos, solo combina lo que produjeron las fases 1 a 7.

## Pendiente (baja prioridad, fuera de alcance de esta fase)

Quedan fuera, evaluados y descartados por ahora por relacion costo/beneficio:

- Detectar Pest (`test(...)`/`it(...)` de nivel superior, sin clase): este proyecto apunta principalmente a Laravel/PHPUnit.
- Detectar carpetas `tests/` como senal adicional de "archivo de test": redundante con la deteccion por herencia en proyectos PSR-4 bien organizados.
- Tests vacios o debiles (sin ninguna llamada a `assert*`/`expect`): requeriria identificar metodos de test especificos (prefijo `test`/atributo `#[Test]`) y rastrear llamadas a aserciones, un nuevo recorrido en `PhpAstParser`.
- Demasiados mocks (`Mockery::mock`, `createMock`, `getMockBuilder`): mismo costo que el punto anterior.
- Tests que solo prueban implementacion en vez de comportamiento: el mas dificil de los siete, heuristicamente poco confiable sin acceso a la cobertura real.

Si se retoma, el patron a seguir es el mismo que ya uso esta fase: extender `PhpAstParser` con la metrica nueva, spec, tests, analizador, mutation testing.
