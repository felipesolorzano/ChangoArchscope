import { describe, expect, it } from "vitest";

import { evaluatePathExpression } from "../../../../../app/modules/architecture/domain/services/phpPathExpression.js";

const FILE = "/mc/admin/public_html/_config.lib.inc";
const constants: Record<string, string> = { _PRIVATE_DIR: "/mc/admin/private_html/", ROOT: "/mc" };
const evaluate = (expression: string) => evaluatePathExpression(expression, { file: FILE, constant: (name) => constants[name] ?? null });

describe("evaluatePathExpression", () => {
  it.each([
    ["'menu.php'", "menu.php"],
    ['"menu.php"', "menu.php"],
    ['("_config.lib.inc")', "_config.lib.inc"],
    ["'it\\'s.php'", "it's.php"],
    ['_PRIVATE_DIR."lib/main.lib.inc"', "/mc/admin/private_html/lib/main.lib.inc"],
    ["__DIR__ . '/bootstrap.php'", "/mc/admin/public_html/bootstrap.php"],
    ["__FILE__", FILE],
    ["dirname(__FILE__) . '/../'", "/mc/admin/public_html/../"],
    ["realpath ( dirname(__FILE__).'/..' )", "/mc/admin"],
    ["realpath(ROOT . '/web/')", "/mc/web"],
    ["realpath('lib/../x/')", "x"],
    ["realpath('/')", "/"],
    ["dirname(dirname(__FILE__))", "/mc/admin"],
    ["( ROOT ) . ( '/x' )", "/mc/x"],
  ])("%s → %s", (expression, expected) => {
    expect(evaluate(expression)).toBe(expected);
  });

  it.each([
    ['"{$uid[\'dir\']}/private_html/"'],
    ['"$dir/x.php"'],
    ["$file"],
    ["UNKNOWN_DIR . 'x'"],
    ["strtolower('x')"],
    ["'a' + 'b'"],
    ["'sin cerrar"],
    ["dirname('x'"],
    ["'a' ."],
    [""],
    ["'a' 'b'"],
    ["lowercase_const"],
  ])("%s → null", (expression) => {
    expect(evaluate(expression)).toBeNull();
  });

  it("comillas simples no interpolan; dirname/realpath exigen parentesis; parentesis sin cerrar no vale", () => {
    expect(evaluate("'$x.php'")).toBe("$x.php");
    expect(evaluate("dirname 'x'")).toBeNull();
    expect(evaluate("realpath __FILE__")).toBeNull();
    expect(evaluate("('a'x")).toBeNull();
  });

  it("solo identificadores en mayusculas completos son constantes", () => {
    const anything = (expression: string) => evaluatePathExpression(expression, { file: FILE, constant: (name) => `/${name}` });

    expect(anything("ROOT_DIR")).toBe("/ROOT_DIR");
    expect(anything("camelROOT")).toBeNull();
    expect(anything("ROOTlower")).toBeNull();
    expect(anything("'a' . $ROOT")).toBeNull();
  });
});
