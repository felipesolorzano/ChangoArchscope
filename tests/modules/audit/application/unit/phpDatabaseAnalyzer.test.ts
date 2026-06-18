import { describe, expect, it } from "vitest";

import type { PhpFileStructure, PhpSqlLiteral } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpDatabaseAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpDatabaseAnalyzer.js";

function buildLiteral(overrides: Partial<PhpSqlLiteral> = {}): PhpSqlLiteral {
  return {
    value: "SELECT * FROM users",
    line: 5,
    insideLoop: false,
    ...overrides,
  };
}

function buildFile(overrides: Partial<PhpFileStructure> = {}): PhpFileStructure {
  return {
    file: "app/Modules/Users/Application/UseCases/Foo.php",
    classes: [],
    functions: [],
    referencedNames: [],
    securityIssues: [],
    sqlLiterals: [],
    ...overrides,
  };
}

describe("phpDatabaseAnalyzer", () => {
  it("genera n-plus-one-query para un literal dentro de un loop", () => {
    const file = buildFile({ sqlLiterals: [buildLiteral({ insideLoop: true, line: 8 })] });

    const findings = phpDatabaseAnalyzer([file]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        category: "database",
        rule: "n-plus-one-query",
        severity: "high",
        source: "native",
        module: "",
        file: "app/Modules/Users/Application/UseCases/Foo.php",
        line: 8,
        details: { value: "SELECT * FROM users" },
        message: "Query SQL dentro de un loop: posible problema de N+1. Verificar antes de optimizar.",
      }),
    );
  });

  it("no genera n-plus-one-query para un literal fuera de un loop", () => {
    const file = buildFile({ sqlLiterals: [buildLiteral({ insideLoop: false })] });

    expect(phpDatabaseAnalyzer([file]).map((finding) => finding.rule)).not.toContain("n-plus-one-query");
  });

  it("genera raw-sql-outside-infrastructure cuando la ruta no contiene infrastructure", () => {
    const file = buildFile({
      file: "app/Modules/Users/Application/UseCases/Foo.php",
      sqlLiterals: [buildLiteral()],
    });

    const findings = phpDatabaseAnalyzer([file]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        rule: "raw-sql-outside-infrastructure",
        severity: "medium",
        message: "SQL crudo fuera de la capa de infraestructura. Verificar antes de mover.",
      }),
    );
  });

  it.each(["app/Modules/Users/Infrastructure/Persistence/Repo.php", "app/modules/users/infrastructure/persistence/repo.php"])(
    "no genera raw-sql-outside-infrastructure cuando la ruta contiene infrastructure (%s)",
    (filePath) => {
      const file = buildFile({ file: filePath, sqlLiterals: [buildLiteral()] });

      const findings = phpDatabaseAnalyzer([file]);

      expect(findings.map((finding) => finding.rule)).not.toContain("raw-sql-outside-infrastructure");
    },
  );

  it("genera duplicate-sql para cada ocurrencia cuando el mismo valor se repite en dos archivos", () => {
    const fileA = buildFile({ file: "A.php", sqlLiterals: [buildLiteral({ line: 1 })] });
    const fileB = buildFile({ file: "B.php", sqlLiterals: [buildLiteral({ line: 2 })] });

    const findings = phpDatabaseAnalyzer([fileA, fileB]).filter((finding) => finding.rule === "duplicate-sql");

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
    expect(findings[0]).toMatchObject({
      severity: "low",
      message: "Este SQL aparece repetido en el codigo escaneado. Verificar antes de unificar.",
    });
  });

  it("genera duplicate-sql para cada una de tres ocurrencias del mismo valor", () => {
    const file = buildFile({
      sqlLiterals: [buildLiteral({ line: 1 }), buildLiteral({ line: 2 }), buildLiteral({ line: 3 })],
    });

    const findings = phpDatabaseAnalyzer([file]).filter((finding) => finding.rule === "duplicate-sql");

    expect(findings).toHaveLength(3);
  });

  it("no genera duplicate-sql para un valor unico en todo el conjunto", () => {
    const file = buildFile({ sqlLiterals: [buildLiteral({ value: "SELECT * FROM orders" })] });

    expect(phpDatabaseAnalyzer([file]).map((finding) => finding.rule)).not.toContain("duplicate-sql");
  });

  it("un mismo literal puede disparar varias reglas a la vez", () => {
    const file = buildFile({
      file: "app/Modules/Users/Application/Foo.php",
      sqlLiterals: [buildLiteral({ insideLoop: true })],
    });

    const rules = phpDatabaseAnalyzer([file]).map((finding) => finding.rule);

    expect(rules).toEqual(["n-plus-one-query", "raw-sql-outside-infrastructure"]);
  });

  it("un archivo sin sqlLiterals no genera findings", () => {
    expect(phpDatabaseAnalyzer([buildFile()])).toEqual([]);
  });
});
