import { describe, expect, it } from "vitest";

import { phpIncludeSyntax } from "../../../../../app/modules/architecture/domain/services/phpIncludeSyntax.js";

describe("phpIncludeSyntax", () => {
  it("includes con y sin parentesis, _once y require, con su linea", () => {
    const source = `<?php
include_once("_config.lib.inc");
require_once _PRIVATE_DIR."lib/main.lib.inc";
  include 'menu.php' ;
require(PHPEXCEL_ROOT . 'PHPExcel/Autoloader.php');
`;

    expect(phpIncludeSyntax(source).includes).toEqual([
      { expression: '("_config.lib.inc")', line: 2 },
      { expression: '_PRIVATE_DIR."lib/main.lib.inc"', line: 3 },
      { expression: "'menu.php'", line: 4 },
      { expression: "(PHPEXCEL_ROOT . 'PHPExcel/Autoloader.php')", line: 5 },
    ]);
  });

  it("solo dentro de <?php ?>: el HTML de afuera no cuenta y ?> cierra la sentencia", () => {
    const source = `<p>include "fake.php"; require nada;</p>
<?php include "menu.php" ?><div>require "otro.php";</div><?= include "b.php"; ?>`;

    expect(phpIncludeSyntax(source).includes).toEqual([
      { expression: '"menu.php"', line: 2 },
      { expression: '"b.php"', line: 2 },
    ]);
  });

  it("ignora comentarios y strings, pero un // dentro de un string no es comentario", () => {
    const source = `<?php
// include "comentado.php";
# require "hash.php";
/* include "bloque.php";
   require "bloque2.php"; */
$texto = "include 'en-string.php';";
$url = 'http://x.com/a'; include "despues-de-url.php";
$this->require("metodo.php"); Foo::include("estatico.php"); $require = 1;
`;

    expect(phpIncludeSyntax(source).includes).toEqual([{ expression: '"despues-de-url.php"', line: 7 }]);
  });

  it("strings con comillas escapadas no cortan el analisis", () => {
    const source = `<?php $a = 'it\\'s'; $b = "say \\"hi\\""; include "ok.php";`;

    expect(phpIncludeSyntax(source).includes).toEqual([{ expression: '"ok.php"', line: 1 }]);
  });

  it("defines con comillas simples o dobles y tercer argumento booleano", () => {
    const source = `<?php
define('_PROOT_DIR', realpath ( dirname(__FILE__).'/..' ));
if(!defined('_PRIVATE_DIR')) define("_PRIVATE_DIR", _PROOT_DIR.'/private_html/');
define('X', 'y', true);
define($dinamico, 'z');
`;

    expect(phpIncludeSyntax(source).defines).toEqual([
      { name: "_PROOT_DIR", expression: "realpath ( dirname(__FILE__).'/..' )" },
      { name: "_PRIVATE_DIR", expression: "_PROOT_DIR.'/private_html/'" },
      { name: "X", expression: "'y'" },
    ]);
  });

  it("archivo sin PHP no tiene nada", () => {
    expect(phpIncludeSyntax("<html>include 'x.php';</html>")).toEqual({ includes: [], defines: [] });
  });

  it("comentarios raros: /*/ no cierra, sin cerrar llegan al final, // al final sin salto", () => {
    expect(phpIncludeSyntax(`<?php /*/ include "dentro.php"; */ include "fuera.php";`).includes.map((i) => i.expression)).toEqual(['"fuera.php"']);
    expect(phpIncludeSyntax(`<?php include "a.php"; /* include "b.php";`).includes.map((i) => i.expression)).toEqual(['"a.php"']);
    expect(phpIncludeSyntax(`<?php include "a.php"; // include "b.php";`).includes.map((i) => i.expression)).toEqual(['"a.php"']);
    expect(phpIncludeSyntax(`<?php include "a.php"; $s = "sin cerrar include 'x.php';`).includes.map((i) => i.expression)).toEqual(['"a.php"']);
  });

  it("defines con espacios en todas partes o sin ninguno; un define dentro de un string no cuenta", () => {
    const source = `<?php
define ( 'SPACED' , 'v' , false ) ;
define('TIGHT','x',true);
$s = "define('FAKE', 'y');";
`;

    expect(phpIncludeSyntax(source).defines).toEqual([
      { name: "SPACED", expression: "'v'" },
      { name: "TIGHT", expression: "'x'" },
    ]);
  });
});
