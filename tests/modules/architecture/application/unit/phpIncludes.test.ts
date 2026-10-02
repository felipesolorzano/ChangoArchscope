import { describe, expect, it } from "vitest";

import { resolvePhpIncludes } from "../../../../../app/modules/architecture/application/analyzers/phpIncludes.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

const SOURCES: Record<string, string> = {
  "/mc/admin/public_html/_config.lib.inc": `<?php
define("_PRIVATE_DIR", "{$uid['dir']}/private_html/");
define('_PROOT_DIR', realpath ( dirname(__FILE__).'/..' ));
if(!defined('_PRIVATE_DIR')) define('_PRIVATE_DIR', _PROOT_DIR.'/private_html/');
`,
  "/mc/admin/public_html/index.php": `<?php
include_once("_config.lib.inc");
include_once(_PRIVATE_DIR."lib/main.lib.inc");
require_once(_COMPUMATIC_DIR.'cm.log.lib.inc');
require_once(_COMPUMATIC_DIR.'mailer.lib.inc');
include '/usr/local/lib/php/smarty/x.php';
include $dinamico;
include "../../web/public_html/shared.php";
include "lib/helper.php";
require_once("Net/Client.php");
include "no-existe.php";
`,
  "/mc/admin/private_html/lib/main.lib.inc": `<?php include_once(_PRIVATE_DIR."lib/main.lib.inc"); require_once(UNKNOWN.'x');`,
  "/mc/admin/public_html/lib/helper.php": "<?php",
  "/mc/web/public_html/shared.php": `<?php include_once(__DIR__ . '/../../admin/public_html/index.php');`,
  "/mc/xls/PHPExcel.php": `<?php define('PHPEXCEL_ROOT', dirname(__FILE__) . '/'); require(PHPEXCEL_ROOT . 'PHPExcel/Autoloader.php');`,
  "/mc/xls/PHPExcel/Autoloader.php": `<?php define('PHPEXCEL_ROOT', dirname(__FILE__) . '/../'); require(PHPEXCEL_ROOT . 'PHPExcel.php');`,
  "/mc/vendorlib/Net/Client.php": "<?php",
};

const reader: SourceTreeReader = {
  listDirectories: () => [],
  walkFiles: () => [],
  readText: (file) => SOURCES[file],
  isFile: (file) => file in SOURCES,
};

const moduleOf = (file: string) => file.split("/")[2];
const files = Object.keys(SOURCES).filter((file) => !file.startsWith("/mc/vendorlib")).map((file) => ({ file, module: moduleOf(file) }));

function resolve(overrides: Partial<Parameters<typeof resolvePhpIncludes>[0]> = {}) {
  return resolvePhpIncludes({ files, modulesPath: "/mc", reader, includeConstants: {}, includePaths: [], ...overrides });
}

const linksOf = (result: ReturnType<typeof resolve>) => result.links.map((link) => `${link.from.replace("/mc/", "")} → ${link.to.replace("/mc/", "")}:${link.line}`);

describe("resolvePhpIncludes", () => {
  it("resuelve literales, constantes del modulo (primera evaluable), __DIR__, relativas y constantes por archivo", () => {
    const result = resolve();

    expect(linksOf(result)).toEqual([
      "admin/private_html/lib/main.lib.inc → admin/private_html/lib/main.lib.inc:1",
      "admin/public_html/index.php → admin/public_html/_config.lib.inc:2",
      "admin/public_html/index.php → admin/private_html/lib/main.lib.inc:3",
      "admin/public_html/index.php → web/public_html/shared.php:8",
      "admin/public_html/index.php → admin/public_html/lib/helper.php:9",
      "web/public_html/shared.php → admin/public_html/index.php:1",
      "xls/PHPExcel.php → xls/PHPExcel/Autoloader.php:1",
      "xls/PHPExcel/Autoloader.php → xls/PHPExcel.php:1",
    ]);
    expect(result.links[1].expression).toBe('("_config.lib.inc")');
  });

  it("cuenta resueltos, externos y sin resolver, con las constantes que faltan", () => {
    expect(resolve().stats).toEqual({
      total: 15,
      resolved: 8,
      external: 1,
      unresolved: 6,
      unresolvedConstants: [
        { name: "_COMPUMATIC_DIR", count: 2 },
        { name: "UNKNOWN", count: 1 },
      ],
    });
  });

  it("la config gana a lo deducido; includePaths resuelve relativas que no estan junto al archivo", () => {
    const result = resolve({ includeConstants: { _COMPUMATIC_DIR: "/mc/admin/private_html/lib/", _PRIVATE_DIR: "/mc/xls/" }, includePaths: ["/mc/vendorlib"] });

    // _PRIVATE_DIR de la config apunta a /mc/xls/: el include de la linea 3 ya no resuelve.
    expect(linksOf(result)).not.toContain("admin/public_html/index.php → admin/private_html/lib/main.lib.inc:3");
    // _COMPUMATIC_DIR ya tiene valor: deja de figurar como constante faltante.
    expect(result.stats.unresolvedConstants).toEqual([{ name: "UNKNOWN", count: 1 }]);
  });

  it("includePaths encuentra archivos del grafo fuera de la carpeta del que incluye", () => {
    const withVendor = [...files, { file: "/mc/vendorlib/Net/Client.php", module: "vendorlib" }];

    expect(linksOf(resolve({ files: withVendor, includePaths: ["/mc/vendorlib"] }))).toContain("admin/public_html/index.php → vendorlib/Net/Client.php:10");
  });

  it("una constante definida en funcion de si misma no tiene valor", () => {
    const loop: Record<string, string> = { "/p/a.php": `<?php define('A', A . '/x'); include A . 'b.php';` };
    const loopReader: SourceTreeReader = { ...reader, readText: (file) => loop[file], isFile: (file) => file in loop };

    expect(resolvePhpIncludes({ files: [{ file: "/p/a.php", module: "p" }], modulesPath: "/p", reader: loopReader, includeConstants: {}, includePaths: [] }).stats).toMatchObject({
      resolved: 0,
      unresolved: 1,
      unresolvedConstants: [{ name: "A", count: 1 }],
    });
  });

  it("una definicion circular no impide usar la siguiente definicion valida", () => {
    const sources: Record<string, string> = {
      "/p/a/a.php": `<?php define('A', A . '/x'); define('A', '/p/b'); include A . '/b.php';`,
      "/p/b/b.php": `<?php include A . '/b.php';`,
    };
    const fs: SourceTreeReader = { ...reader, readText: (file) => sources[file], isFile: (file) => file in sources };
    const result = resolvePhpIncludes({ files: [{ file: "/p/a/a.php", module: "a" }, { file: "/p/b/b.php", module: "b" }], modulesPath: "/p", reader: fs, includeConstants: {}, includePaths: [] });

    expect(result.links.map((link) => `${link.from} → ${link.to}`)).toEqual(["/p/a/a.php → /p/b/b.php", "/p/b/b.php → /p/b/b.php"]);
  });

  it("DIRECTORY_SEPARATOR es una constante integrada", () => {
    const sources: Record<string, string> = { "/p/a.php": `<?php include __DIR__ . DIRECTORY_SEPARATOR . 'b.php';`, "/p/b.php": "<?php" };
    const fs: SourceTreeReader = { ...reader, readText: (file) => sources[file], isFile: (file) => file in sources };
    const result = resolvePhpIncludes({ files: [{ file: "/p/a.php", module: "p" }, { file: "/p/b.php", module: "p" }], modulesPath: "/p", reader: fs, includeConstants: { DIRECTORY_SEPARATOR: "x" }, includePaths: [] });

    expect(result.links.map((link) => link.to)).toEqual(["/p/b.php"]);
  });

  it("el modulo gana a otros modulos aunque esten antes por ruta", () => {
    const sources: Record<string, string> = {
      "/p/a/defs.php": `<?php define('LIB', '/p/a/');`,
      "/p/z/defs.php": `<?php define('LIB', '/p/z/');`,
      "/p/z/main.php": `<?php include LIB . 'x.php';`,
      "/p/z/x.php": "<?php",
      "/p/a/x.php": "<?php",
    };
    const fs: SourceTreeReader = { ...reader, readText: (file) => sources[file], isFile: (file) => file in sources };
    const files = Object.keys(sources).map((file) => ({ file, module: file.split("/")[2] }));

    expect(resolvePhpIncludes({ files, modulesPath: "/p", reader: fs, includeConstants: {}, includePaths: [] }).links.map((link) => link.to)).toEqual(["/p/z/x.php"]);
  });

  it("./ y ../ no buscan en includePaths; la raiz del proyecto no es externa", () => {
    const sources: Record<string, string> = {
      "/p/app/a.php": `<?php include "./lib.php"; include "../app2/lib.php"; include "lib.php"; include dirname(__DIR__);`,
      "/p/vendor/lib.php": "<?php",
      "/p/vendor/app2/lib.php": "<?php",
    };
    const fs: SourceTreeReader = { ...reader, readText: (file) => sources[file], isFile: (file) => file in sources };
    const files = Object.keys(sources).map((file) => ({ file, module: file.split("/")[2] }));
    const result = resolvePhpIncludes({ files, modulesPath: "/p", reader: fs, includeConstants: {}, includePaths: ["/p/vendor", "/p/vendor/x"] });

    expect(result.links.map((link) => link.to)).toEqual(["/p/vendor/lib.php"]);
    expect(result.stats).toMatchObject({ total: 4, resolved: 1, external: 0, unresolved: 3 });
  });

  it("constantes faltantes: empate por nombre y como maximo 10", () => {
    const names = ["K", "J", "I", "H", "G", "F", "E", "D", "C", "B", "A"];
    const sources: Record<string, string> = { "/p/a.php": `<?php ${names.map((name) => `include ${name} . 'x';`).join(" ")} include A . 'y';` };
    const fs: SourceTreeReader = { ...reader, readText: (file) => sources[file], isFile: () => false };
    const { unresolvedConstants } = resolvePhpIncludes({ files: [{ file: "/p/a.php", module: "p" }], modulesPath: "/p", reader: fs, includeConstants: {}, includePaths: [] }).stats;

    expect(unresolvedConstants).toHaveLength(10);
    expect(unresolvedConstants[0]).toEqual({ name: "A", count: 2 });
    expect(unresolvedConstants.slice(1).map((constant) => constant.name)).toEqual(["B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });
});
