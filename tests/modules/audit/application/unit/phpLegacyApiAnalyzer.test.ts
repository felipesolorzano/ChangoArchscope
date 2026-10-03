import { describe, expect, it } from "vitest";

import { phpLegacyApiAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpLegacyApiAnalyzer.js";
import { phpFile } from "../../support/phpStructures.js";

const calls = (...entries: Array<[string, number]>) => entries.map(([name, line]) => ({ name, line }));

describe("phpLegacyApiAnalyzer (XRay X5)", () => {
  it("un finding por archivo y funcion: primera linea y cantidad de llamadas", () => {
    const file = phpFile("/mc/a.php", { functionCalls: calls(["strlen", 1], ["each", 3], ["utf8_encode", 4], ["each", 9], ["each", 12]) });

    expect(phpLegacyApiAnalyzer([file])).toEqual([
      {
        category: "legacy_api",
        rule: "removed-php-function",
        severity: "high",
        source: "native",
        module: "",
        class: null,
        file: "/mc/a.php",
        line: 3,
        message: '"each()" se elimino en PHP 8.0.',
        details: { pattern: "each", function: "each", count: 3, since: "8.0" },
      },
      {
        category: "legacy_api",
        rule: "deprecated-php-function",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/mc/a.php",
        line: 4,
        message: '"utf8_encode()" esta deprecada desde PHP 8.2.',
        details: { pattern: "utf8-encode", function: "utf8_encode", count: 1, since: "8.2" },
      },
    ]);
  });

  it("catalogo: patron y version de cada funcion", () => {
    const names = [
      "mysql_query", "mysql_connect", "ereg", "eregi", "ereg_replace", "eregi_replace", "split", "spliti", "sql_regcase",
      "mcrypt_encrypt", "create_function", "money_format", "get_magic_quotes_gpc", "get_magic_quotes_runtime",
      "set_magic_quotes_runtime", "utf8_decode", "mysqli_query", "mysql", "preg_split", "explode",
    ];
    const findings = phpLegacyApiAnalyzer([phpFile("/mc/b.php", { functionCalls: calls(...names.map((name, index): [string, number] => [name, index + 1])) })]);

    expect(findings.map((finding) => [finding.details.function, finding.details.pattern, finding.details.since, finding.rule])).toEqual([
      ["mysql_query", "mysql", "7.0", "removed-php-function"],
      ["mysql_connect", "mysql", "7.0", "removed-php-function"],
      ["ereg", "ereg", "7.0", "removed-php-function"],
      ["eregi", "ereg", "7.0", "removed-php-function"],
      ["ereg_replace", "ereg", "7.0", "removed-php-function"],
      ["eregi_replace", "ereg", "7.0", "removed-php-function"],
      ["split", "ereg", "7.0", "removed-php-function"],
      ["spliti", "ereg", "7.0", "removed-php-function"],
      ["sql_regcase", "ereg", "7.0", "removed-php-function"],
      ["mcrypt_encrypt", "mcrypt", "7.2", "removed-php-function"],
      ["create_function", "create-function", "8.0", "removed-php-function"],
      ["money_format", "money-format", "8.0", "removed-php-function"],
      ["get_magic_quotes_gpc", "magic-quotes", "8.0", "removed-php-function"],
      ["get_magic_quotes_runtime", "magic-quotes", "8.0", "removed-php-function"],
      ["set_magic_quotes_runtime", "magic-quotes", "8.0", "removed-php-function"],
      ["utf8_decode", "utf8-encode", "8.2", "deprecated-php-function"],
    ]);
    expect(findings[0].message).toBe('"mysql_query()" se elimino en PHP 7.0.');
  });

  it("varios archivos en orden", () => {
    const files = [phpFile("/mc/a.php", { functionCalls: calls(["each", 1]) }), phpFile("/mc/b.php"), phpFile("/mc/c.php", { functionCalls: calls(["split", 2]) })];

    expect(phpLegacyApiAnalyzer(files).map((finding) => finding.file)).toEqual(["/mc/a.php", "/mc/c.php"]);
  });
});
