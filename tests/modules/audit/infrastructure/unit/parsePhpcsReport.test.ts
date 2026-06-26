import { describe, expect, it } from "vitest";

import { parsePhpcsReport, parsePhpcsReportByFile } from "../../../../../app/modules/audit/infrastructure/compat/parsePhpcsReport.js";

const report = {
  totals: { errors: 1, warnings: 1, fixable: 0 },
  files: {
    "/repo/app/Legacy/User.php": {
      errors: 1,
      warnings: 1,
      messages: [
        {
          message: "Function each() is removed since PHP 8.0",
          source: "PHPCompatibility.FunctionUse.RemovedFunctions.eachFound",
          severity: 5,
          type: "ERROR",
          line: 120,
          column: 5,
          fixable: false,
        },
        {
          message: "Passing null to count() is deprecated",
          source: "PHPCompatibility.FunctionUse.ArgumentValues.countNull",
          severity: 5,
          type: "WARNING",
          line: 8,
          column: 1,
          fixable: false,
        },
      ],
    },
  },
};

describe("parsePhpcsReport", () => {
  it("mapea cada mensaje a un PhpCompatibilityIssue", () => {
    const issues = parsePhpcsReport(report);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual({
      file: "app/Legacy/User.php",
      line: 120,
      rule: "PHPCompatibility.FunctionUse.RemovedFunctions.eachFound",
      severityRaw: "error",
      message: "Function each() is removed since PHP 8.0",
    });
  });

  it("traduce type ERROR a 'error' y WARNING a 'warning'", () => {
    const issues = parsePhpcsReport(report);

    expect(issues.map((issue) => issue.severityRaw)).toEqual(["error", "warning"]);
  });

  it("remueve el prefijo de montaje /repo/ de la ruta del archivo", () => {
    const issues = parsePhpcsReport(report);

    expect(issues[0].file).toBe("app/Legacy/User.php");
  });

  it("descarta mensajes cuyo source no es de PHPCompatibility", () => {
    const mixed = {
      files: {
        "/repo/a.php": {
          messages: [
            { source: "Generic.WhiteSpace.ScopeIndent", type: "ERROR", line: 1, message: "indent" },
            { source: "PHPCompatibility.X.Y", type: "ERROR", line: 2, message: "real" },
          ],
        },
      },
    };

    const issues = parsePhpcsReport(mixed);

    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("PHPCompatibility.X.Y");
  });

  it("deja la ruta intacta cuando no trae el prefijo de montaje /repo/", () => {
    const noPrefix = {
      files: { "app/Already/Relative.php": { messages: [{ source: "PHPCompatibility.X.Y", type: "ERROR", line: 1, message: "m" }] } },
    };

    expect(parsePhpcsReport(noPrefix)[0].file).toBe("app/Already/Relative.php");
  });

  it("colapsa la raiz exacta /repo a cadena vacia", () => {
    const rootOnly = {
      files: { "/repo": { messages: [{ source: "PHPCompatibility.X.Y", type: "ERROR", line: 1, message: "m" }] } },
    };

    expect(parsePhpcsReport(rootOnly)[0].file).toBe("");
  });

  it("retorna [] ante un reporte sin archivos o con forma inesperada", () => {
    expect(parsePhpcsReport({ files: {} })).toEqual([]);
    expect(parsePhpcsReport({})).toEqual([]);
    expect(parsePhpcsReport(null)).toEqual([]);
    expect(parsePhpcsReport({ files: null })).toEqual([]);
    expect(parsePhpcsReport({ files: { "/repo/a.php": {} } })).toEqual([]);
  });

  it("omite entradas de archivo nulas sin lanzar", () => {
    expect(parsePhpcsReport({ files: { "/repo/a.php": null } })).toEqual([]);
  });

  it("descarta mensajes sin source o con source no-string", () => {
    const malformed = {
      files: {
        "/repo/a.php": {
          messages: [
            { type: "ERROR", line: 1, message: "sin source" },
            { source: 123, type: "ERROR", line: 2, message: "source numerico" },
            { source: "PHPCompatibility.X.Y", type: "ERROR", line: 3, message: "valido" },
          ],
        },
      },
    };

    const issues = parsePhpcsReport(malformed);

    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(3);
  });

  it("usa line 0 y message vacio cuando phpcs omite esos campos", () => {
    const partial = {
      files: { "/repo/a.php": { messages: [{ source: "PHPCompatibility.X.Y", type: "ERROR" }] } },
    };

    expect(parsePhpcsReport(partial)[0]).toMatchObject({ line: 0, message: "" });
  });
});

describe("parsePhpcsReportByFile", () => {
  it("agrupa los issues por archivo (ruta sin prefijo /repo/)", () => {
    const byFile = parsePhpcsReportByFile(report);

    expect([...byFile.keys()]).toEqual(["app/Legacy/User.php"]);
    expect(byFile.get("app/Legacy/User.php")).toHaveLength(2);
  });

  it("incluye un archivo escaneado SIN hallazgos como [] (clave para detectar correcciones)", () => {
    const clean = { files: { "/repo/app/Fixed.php": { errors: 0, warnings: 0, messages: [] } } };

    const byFile = parsePhpcsReportByFile(clean);

    expect(byFile.has("app/Fixed.php")).toBe(true);
    expect(byFile.get("app/Fixed.php")).toEqual([]);
  });

  it("un archivo cuyos unicos mensajes no son de PHPCompatibility queda con []", () => {
    const other = {
      files: { "/repo/a.php": { messages: [{ source: "Generic.WhiteSpace.ScopeIndent", type: "ERROR", line: 1 }] } },
    };

    expect(parsePhpcsReportByFile(other).get("a.php")).toEqual([]);
  });

  it("retorna un Map vacio ante forma inesperada", () => {
    expect(parsePhpcsReportByFile(null).size).toBe(0);
    expect(parsePhpcsReportByFile({}).size).toBe(0);
  });
});
