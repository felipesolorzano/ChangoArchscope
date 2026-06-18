import { describe, expect, it } from "vitest";

import { PhpAstParser } from "../../../../../app/modules/audit/infrastructure/parser/PhpAstParser.js";

const parser = new PhpAstParser();

describe("PhpAstParser", () => {
  it("extrae clases con su rango de lineas y sus metodos", () => {
    const source = `<?php
class Foo {
  public function bar() {
    echo "hi";
  }
}
`;
    const structure = parser.parse("Foo.php", source);

    expect(structure.file).toBe("Foo.php");
    expect(structure.classes).toHaveLength(1);
    expect(structure.classes[0]).toMatchObject({ name: "Foo", startLine: 2, endLine: 6 });
    expect(structure.classes[0].methods).toHaveLength(1);
    expect(structure.classes[0].methods[0]).toMatchObject({ name: "bar", startLine: 3, endLine: 5, parametersCount: 0 });
  });

  it("extrae extendsName cuando la clase usa extends", () => {
    const source = `<?php
class Foo extends Base {
}
`;
    const structure = parser.parse("Foo.php", source);

    expect(structure.classes[0].extendsName).toBe("Base");
  });

  it("extrae extendsName con namespace completo (fully qualified)", () => {
    const source = `<?php
class FooTest extends \\PHPUnit\\Framework\\TestCase {
}
`;
    const structure = parser.parse("FooTest.php", source);

    expect(structure.classes[0].extendsName).toBe("\\PHPUnit\\Framework\\TestCase");
  });

  it("extendsName es null cuando la clase no usa extends", () => {
    const source = `<?php
class Foo {
}
`;
    const structure = parser.parse("Foo.php", source);

    expect(structure.classes[0].extendsName).toBeNull();
  });

  it("extrae clases dentro de un bloque namespace", () => {
    const source = `<?php
namespace App\\Modules\\Foo;

class Bar {
  public function baz() {}
}
`;
    const structure = parser.parse("Bar.php", source);

    expect(structure.classes).toHaveLength(1);
    expect(structure.classes[0].name).toBe("Bar");
  });

  it("ignora propiedades y constantes de clase, solo conserva metodos", () => {
    const source = `<?php
class Foo {
  public \$bar;
  const BAZ = 1;
  public function greet() {}
}
`;
    const structure = parser.parse("Foo.php", source);

    expect(structure.classes[0].methods.map((method) => method.name)).toEqual(["greet"]);
  });

  it("extrae traits igual que clases", () => {
    const source = `<?php
trait Greets {
  public function greet() {
    echo "hi";
  }
}
`;
    const structure = parser.parse("Greets.php", source);

    expect(structure.classes).toHaveLength(1);
    expect(structure.classes[0].name).toBe("Greets");
  });

  it("extrae funciones sueltas fuera de clase", () => {
    const source = `<?php
function helper(\$a, \$b) {
  return \$a + \$b;
}
`;
    const structure = parser.parse("helpers.php", source);

    expect(structure.functions).toHaveLength(1);
    expect(structure.functions[0]).toMatchObject({ name: "helper", parametersCount: 2 });
  });

  it("cuenta parametersCount segun el numero de argumentos", () => {
    const source = `<?php
function f(\$a, \$b, \$c) {}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].parametersCount).toBe(3);
  });

  it("omite metodos sin body (interfaces)", () => {
    const source = `<?php
interface Greeter {
  public function greet();
}
`;
    const structure = parser.parse("Greeter.php", source);

    expect(structure.classes).toHaveLength(0);
  });

  it("omite metodos abstractos sin body dentro de una clase, pero conserva los que si tienen body", () => {
    const source = `<?php
abstract class Greeter {
  abstract public function greet();

  public function farewell() {
    echo "bye";
  }
}
`;
    const structure = parser.parse("Greeter.php", source);

    expect(structure.classes[0].methods.map((method) => method.name)).toEqual(["farewell"]);
  });

  it("cuenta un do-while como punto de decision", () => {
    const source = `<?php
function f(\$a) {
  do {
    echo \$a;
  } while (\$a);
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].decisionPointsCount).toBe(1);
  });

  it("cuenta un operador || como punto de decision", () => {
    const source = `<?php
function f(\$a, \$b) {
  if (\$a || \$b) {
    echo 1;
  }
}
`;
    const structure = parser.parse("f.php", source);

    // if(1) + ||(1)
    expect(structure.functions[0].decisionPointsCount).toBe(2);
  });

  it("calcula decisionPointsCount contando if/elseif, for, foreach, while, do, catch, case, &&/|| y ternario", () => {
    const source = `<?php
function f(\$a, \$b) {
  if (\$a && \$b) {
    for (\$i = 0; \$i < 10; \$i++) {
      foreach (\$a as \$x) {
        while (true) {
          echo \$x;
        }
      }
    }
  } elseif (\$a) {
    echo "x";
  } else {
    echo "y";
  }

  try {
    doStuff();
  } catch (Exception \$e) {
    echo \$e;
  }

  switch (\$a) {
    case 1:
      break;
    case 2:
      break;
    default:
      break;
  }

  return \$a ?: \$b;
}
`;
    const structure = parser.parse("f.php", source);

    // if(1) + && (1) + for(1) + foreach(1) + while(1) + elseif-as-if(1) + catch(1) + case 1(1) + case 2(1) + ternario(1)
    expect(structure.functions[0].decisionPointsCount).toBe(10);
  });

  it("no cuenta el case default como punto de decision", () => {
    const source = `<?php
function f(\$a) {
  switch (\$a) {
    default:
      break;
  }
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].decisionPointsCount).toBe(0);
  });

  it("cuenta directInstantiationsCount solo para new con nombre de clase conocido, no new dinamico", () => {
    const source = `<?php
function f(\$className) {
  \$a = new Foo();
  \$b = new Bar();
  \$c = new \$className();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].directInstantiationsCount).toBe(2);
  });

  it("un Clase::metodo() estatico no cuenta como directInstantiationsCount", () => {
    const source = `<?php
function f() {
  Logger::info("a");
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].directInstantiationsCount).toBe(0);
  });

  it("cuenta staticCallsCount para cualquier Clase::metodo()", () => {
    const source = `<?php
function f() {
  Logger::info("a");
  Logger::error("b");
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].staticCallsCount).toBe(2);
  });

  it("una llamada normal a funcion no cuenta como staticCallsCount", () => {
    const source = `<?php
function f() {
  doStuff();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].staticCallsCount).toBe(0);
  });

  it("una llamada a ::getInstance() cuenta como singletonAccessCount", () => {
    const source = `<?php
function f() {
  \$s = Singleton::getInstance();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].singletonAccessCount).toBe(1);
  });

  it("una llamada estatica que no es ::getInstance() no cuenta como singletonAccessCount", () => {
    const source = `<?php
function f() {
  Logger::info("a");
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].singletonAccessCount).toBe(0);
  });

  it("cuenta globalAccessCount por cada declaracion global, sin importar cuantas variables liste", () => {
    const source = `<?php
function f() {
  global \$a, \$b;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].globalAccessCount).toBe(1);
  });

  it("cuenta globalAccessCount por referencias a variables superglobales", () => {
    const source = `<?php
function f() {
  echo \$_SERVER["HTTP_HOST"];
  echo \$GLOBALS["x"];
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].globalAccessCount).toBe(2);
  });

  it.each([
    "_SERVER",
    "_GET",
    "_POST",
    "_REQUEST",
    "_COOKIE",
    "_FILES",
    "_ENV",
    "_SESSION",
    "GLOBALS",
  ])("cuenta globalAccessCount para la superglobal $%s", (superglobalName) => {
    const source = `<?php
function f() {
  echo \$${superglobalName};
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].globalAccessCount).toBe(1);
  });

  it("no cuenta una variable normal como acceso global", () => {
    const source = `<?php
function f(\$server) {
  echo \$server;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].globalAccessCount).toBe(0);
  });

  it("no cuenta una llamada a funcion cuyo nombre coincide con una superglobal", () => {
    const source = `<?php
function f() {
  _SERVER();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.functions[0].globalAccessCount).toBe(0);
  });

  it("referencedNames incluye el nombre de una funcion llamada por nombre literal", () => {
    const source = `<?php
function f() {
  helper();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toContain("helper");
  });

  it("referencedNames incluye la clase de un new", () => {
    const source = `<?php
function f() {
  new Mailer();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toContain("Mailer");
  });

  it("referencedNames incluye extends e implements de una clase", () => {
    const source = `<?php
class Foo extends Base implements Loggable, Serializable {
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toEqual(expect.arrayContaining(["Base", "Loggable", "Serializable"]));
  });

  it("referencedNames incluye el type hint de un parametro y el tipo de un catch", () => {
    const source = `<?php
function f(Logger \$logger) {
  try {
    doStuff();
  } catch (NotFoundException \$e) {
    echo \$e;
  }
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toEqual(expect.arrayContaining(["Logger", "NotFoundException"]));
  });

  it("referencedNames incluye el nombre de un metodo llamado en una instancia", () => {
    const source = `<?php
function f(\$obj) {
  \$obj->process();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toContain("process");
  });

  it("referencedNames incluye el nombre de un metodo llamado con nullsafe (?->)", () => {
    const source = `<?php
function f(\$obj) {
  \$obj?->process();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toContain("process");
  });

  it("referencedNames incluye clase y metodo de una llamada estatica", () => {
    const source = `<?php
function f() {
  Logger::info("a");
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toEqual(expect.arrayContaining(["Logger", "info"]));
  });

  it("referencedNames no incluye el nombre de declaracion de una funcion o metodo", () => {
    const source = `<?php
class Foo {
  public function bar() {}
}
function helper() {}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).not.toContain("bar");
    expect(structure.referencedNames).not.toContain("helper");
    expect(structure.referencedNames).not.toContain("Foo");
  });

  it("referencedNames no incluye una llamada a metodo dinamico (\$obj->\$metodo())", () => {
    const source = `<?php
function f(\$obj, \$method) {
  \$obj->\$method();
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.referencedNames).toEqual([]);
  });

  it("securityIssues detecta eval en cualquier parte del archivo, incluyendo codigo de nivel superior", () => {
    const source = `<?php
eval(\$code);
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "eval-usage", line: 2 }]);
  });

  it("securityIssues detecta eval dentro de una funcion", () => {
    const source = `<?php
function f(\$code) {
  eval(\$code);
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "eval-usage", line: 3 }]);
  });

  it("securityIssues detecta include/require con target dinamico", () => {
    const source = `<?php
function f(\$path) {
  include \$path;
  require_once \$path;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([
      { rule: "dynamic-include", line: 3 },
      { rule: "dynamic-include", line: 4 },
    ]);
  });

  it("securityIssues no marca un include con string literal", () => {
    const source = `<?php
function f() {
  include "config.php";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues detecta concatenacion de SQL con variable dinamica", () => {
    const source = `<?php
function f(\$id) {
  \$sql = "SELECT * FROM users WHERE id = " . \$id;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "sql-concatenation", line: 3 }]);
  });

  it("securityIssues detecta concatenacion de SQL con el orden de operandos invertido", () => {
    const source = `<?php
function f(\$id) {
  \$sql = \$id . " WHERE id matches SELECT";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "sql-concatenation", line: 3 }]);
  });

  it("securityIssues no marca una concatenacion entre dos strings literales", () => {
    const source = `<?php
function f() {
  \$sql = "SELECT * FROM " . "users";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca una concatenacion entre dos strings literales con el keyword del lado derecho", () => {
    const source = `<?php
function f() {
  \$sql = "prefix " . "SELECT * FROM users";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca una concatenacion sin palabra clave SQL", () => {
    const source = `<?php
function f(\$name) {
  \$greeting = "Hola " . \$name;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca una concatenacion entre dos variables, sin strings de por medio", () => {
    const source = `<?php
function f(\$a, \$b) {
  \$c = \$a . \$b;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca una comparacion (no concatenacion) aunque el string tenga keyword SQL", () => {
    const source = `<?php
function f(\$a) {
  return \$a == "SELECT * FROM users";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it.each(["_GET", "_POST", "_REQUEST", "_COOKIE"])(
    "securityIssues detecta echo de la superglobal de input $%s sin envolver",
    (superglobalName) => {
      const source = `<?php
function f() {
  echo \$${superglobalName}["name"];
}
`;
      const structure = parser.parse("f.php", source);

      expect(structure.securityIssues).toEqual([{ rule: "unsanitized-output", line: 3 }]);
    },
  );

  it("securityIssues detecta print de input de usuario sin envolver", () => {
    const source = `<?php
function f() {
  print \$_POST["name"];
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "unsanitized-output", line: 3 }]);
  });

  it("securityIssues no marca un echo cuando el input pasa por una funcion", () => {
    const source = `<?php
function f() {
  echo htmlspecialchars(\$_GET["name"]);
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca un echo de \$_SERVER/\$_SESSION (no se consideran input directo)", () => {
    const source = `<?php
function f() {
  echo \$_SERVER["HTTP_HOST"];
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues no marca un acceso a propiedad cuyo nombre coincide con una superglobal", () => {
    const source = `<?php
function f(\$obj) {
  echo \$obj->_GET;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("securityIssues detecta el finding una sola vez cuando solo una de varias expresiones del echo tiene input sin envolver", () => {
    const source = `<?php
function f(\$a) {
  echo \$a, \$_GET["x"];
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([{ rule: "unsanitized-output", line: 3 }]);
  });

  it("un archivo sin patrones de seguridad no genera securityIssues", () => {
    const source = `<?php
function f(\$a) {
  return \$a + 1;
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.securityIssues).toEqual([]);
  });

  it("sqlLiterals detecta un string con palabra clave SQL fuera de un loop", () => {
    const source = `<?php
function f() {
  \$sql = "SELECT * FROM users";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toEqual([{ value: "SELECT * FROM users", line: 3, insideLoop: false }]);
  });

  it("sqlLiterals recorta espacios del valor", () => {
    const source = `<?php
function f() {
  \$sql = "  SELECT * FROM users  ";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals[0].value).toBe("SELECT * FROM users");
  });

  it("sqlLiterals marca insideLoop cuando el string esta dentro de un foreach", () => {
    const source = `<?php
function f(\$users) {
  foreach (\$users as \$user) {
    \$sql = "SELECT * FROM orders WHERE user_id = " . \$user->id;
  }
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toHaveLength(1);
    expect(structure.sqlLiterals[0].insideLoop).toBe(true);
  });

  it.each(["for", "while", "do"])("sqlLiterals marca insideLoop dentro de un %s", (loopKind) => {
    const source =
      loopKind === "for"
        ? `<?php
function f() {
  for (\$i = 0; \$i < 10; \$i++) {
    \$sql = "SELECT * FROM users";
  }
}
`
        : loopKind === "while"
          ? `<?php
function f(\$i) {
  while (\$i) {
    \$sql = "SELECT * FROM users";
  }
}
`
          : `<?php
function f(\$i) {
  do {
    \$sql = "SELECT * FROM users";
  } while (\$i);
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toHaveLength(1);
    expect(structure.sqlLiterals[0].insideLoop).toBe(true);
  });

  it("sqlLiterals no marca insideLoop para un string fuera de cualquier loop, en un archivo que si tiene un loop", () => {
    const source = `<?php
function f(\$items) {
  \$sql = "SELECT * FROM users";
  foreach (\$items as \$item) {
    echo \$item;
  }
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toHaveLength(1);
    expect(structure.sqlLiterals[0].insideLoop).toBe(false);
  });

  it("sqlLiterals detecta strings de nivel superior, fuera de cualquier funcion", () => {
    const source = `<?php
\$sql = "SELECT * FROM users";
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toEqual([{ value: "SELECT * FROM users", line: 2, insideLoop: false }]);
  });

  it("sqlLiterals no incluye un string sin palabra clave SQL", () => {
    const source = `<?php
function f() {
  \$greeting = "Hola mundo";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toEqual([]);
  });

  it("sqlLiterals incluye cada ocurrencia por separado cuando el mismo string se repite", () => {
    const source = `<?php
function f() {
  \$a = "SELECT * FROM users";
  \$b = "SELECT * FROM users";
}
`;
    const structure = parser.parse("f.php", source);

    expect(structure.sqlLiterals).toHaveLength(2);
  });
});
