# Plan — Dependencias y actualizacion del proyecto (ChangoArchscope)

> Documento de plan. Describe QUE construir y en que orden para que la herramienta detecte los
> paquetes del proyecto con sus versiones, las compare con las publicadas y proponga a que version
> actualizar cada una segun el runtime elegido (PHP / Node / npm). Sigue
> `docs/development-rules.md` (SDD → TDD → DDD → hexagonal → mutation).

## 0. Contexto

Objetivo central: **poder actualizar el proyecto**. No basta con listar paquetes viejos: hay que
decir a que version ir, si el runtime lo permite, que esta deprecated/abandonado o es vulnerable, y
en que orden conviene actualizar.

Casos reales que guian el trabajo:

- **brandsites (React, CRA eyectado)**: `react_/package.json` (92 deps, `package-lock` v1) un nivel
  arriba de `react.modulesPath` (`react_/src`). El `.git` esta en `brandsites/`, que tiene OTRO
  `package.json` (de otro proyecto): el manifiesto se busca subiendo solo hasta el mas cercano y
  nunca mas alla de la raiz git.
- **mc (PHP legacy)**: sin manifiesto en la raiz; solo manifiestos anidados
  (`admin/reports-src/package.json`, `web/public_html/fatfreedemo/composer.json`, que es la copia de
  una libreria) y ~400 librerias JS/PHP copiadas a mano (`jquery-1.7.1.min.js`, `PHPExcel`). El PHP
  por defecto no puede salir de esos anidados: sale del binario local.

## 1. Bounded context

`dependencies` es un bounded context propio (backend `app/modules/dependencies`, frontend
`resources/js/react/modules/dependencies-explorer`, pestaña "Dependencias"):

- Tiene I/O de red con cache e invalidacion propias (el resto de la herramienta solo lee codigo).
- Lenguaje propio: paquete, release, rango/constraint, runtime, deprecated, abandonado, advisory.
- Se integra como Audit: publica señales al **Plan** (tareas de actualizacion) y un resumen al
  **Mapa de salud**.

## 2. Fases

| Fase | Entrega | Estado |
|---|---|---|
| **F1 Deteccion** | Manifiestos (`package.json`/lock v1-3, `composer.json`/lock) abajo de la raiz del stack y el mas cercano hacia arriba (hasta la raiz git); runtimes declarados (o locales); helpers de versiones (npm y composer); clasificacion pura de un paquete contra sus releases y el runtime elegido; `GET /dependencies.json` (inventario). Spec: `app/modules/dependencies/specs/dependency-detection.md` | Completa |
| **F2 Registros** | Puerto `PackageRegistry` + adaptadores npm (`registry.npmjs.org`) y Packagist (`repo.packagist.org/p2`); cache SQLite con TTL; `/dependencies.json?php=&node=&npm=&refresh=1` con el reporte clasificado | Pendiente |
| **F3 Pestaña** | `dependencies-explorer`: selector de runtime (default = detectado), KPI, lista por estado (actual → recomendada → ultima, antiguedad), drawer de detalle, boton Refrescar | Pendiente |
| **F4 Seguridad y soporte** | Advisories de `api.osv.dev` (npm y Packagist) y fin de soporte de runtimes/frameworks (`endoflife.date`) | Pendiente |
| **F5 Uso y Plan** | Archivos que importan cada paquete (esfuerzo), dependencias declaradas sin uso, grupos que se actualizan juntos; tareas en Plan ordenadas (seguridad → deprecated/abandonado → patch/minor → majors) | Pendiente |
| **F6 Librerias copiadas** | Reconocer librerias vendorizadas sin manifiesto por nombre de archivo y cabecera (`/*! jQuery v1.7.1`), y manifiestos anidados que son copias de una libreria | Pendiente |

### F1 — validacion contra los proyectos reales

- brandsites (`react_/src`): toma solo `react_/package.json` (no el de `brandsites/`), 93 paquetes,
  todos con version instalada (lock v1); Node/npm locales (no declara `engines`). ~95 ms.
- mc: 3 manifiestos anidados (`admin/reports-src`, `web/public_html/fatfreedemo` y
  `admin/public_html/kendoui/src`, copia de Kendo UI: caso para F6), 36 paquetes, 8 con lock; PHP,
  Node y npm locales. ~300 ms.
- ChangoArchscope (`resources/js/react/modules`): sube 3 niveles al `package.json` de la raiz, 23
  paquetes; Node 18.18.0 desde `engines.node`.

## 3. Decisiones

- **Runtime elegible**: PHP, Node y npm se pueden elegir en la UI; el default es el que usa el
  proyecto (declarado en su manifiesto principal: `config.platform.php`, `require.php`, `.nvmrc`,
  `engines`, `packageManager`) o, si no declara, el binario local. La version recomendada de cada
  paquete es la mas alta estable, no deprecated, cuyos requisitos (`require.php` de Packagist,
  `engines` de npm) cumple el runtime elegido.
- **Refrescar**: la deteccion de manifiestos se hace en cada request (barata), asi que agregar una
  libreria al `package.json`/`composer.json` aparece al refrescar. La cache aplica solo a los datos
  de los registros (F2) y `refresh=1` la salta.
- **Versiones**: libreria `semver` (JS puro, sin I/O) para comparar y evaluar rangos npm; las
  constraints de Composer se traducen a rangos npm (`~1.2` de Composer = `>=1.2.0 <2.0.0`, distinto
  de npm; `,`/espacio = AND; `|`/`||` = OR; sin flags de estabilidad).
- Los tests nunca tocan la red: los registros son puertos con fakes.
