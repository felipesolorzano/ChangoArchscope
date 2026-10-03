import { describe, expect, it, vi } from "vitest";

import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
import type { PhpFileStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import type { JsSourceParser } from "../../../../../app/modules/audit/domain/repositories/JsSourceParser.js";
import type { JsFileStructure } from "../../../../../app/modules/audit/domain/value-objects/JsFileStructure.js";
import { auditProject } from "../../../../../app/modules/audit/application/use-cases/AuditProject.js";

function buildCheckResult(overrides: Partial<ArchitectureCheckResult> = {}): ArchitectureCheckResult {
  return {
    checked_at: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    fail_on_coupling: true,
    passed: false,
    summary: { modules: 1, files_scanned: 3, violations_count: 1, couplings_count: 0 },
    reports: [
      {
        module: "Users",
        module_path: "app/modules/Users",
        passed: false,
        files_scanned: 3,
        violations_count: 1,
        couplings_count: 0,
        violations: [
          {
            module: "Users",
            layer: "Domain",
            file: "Users/Domain/User.php",
            line: 3,
            import: "Illuminate\\Support\\Str",
            message: "Domain no debe importar Illuminate",
            suggestion: "Mueve la dependencia a Infrastructure",
          },
        ],
        couplings: [],
      },
    ],
    ...overrides,
  };
}

function fileStructure(file: string): PhpFileStructure {
  return {
    file,
    classes: [],
    functions: [],
    referencedNames: [],
    securityIssues: [{ rule: "eval-usage", line: 7 }],
    sqlLiterals: [],
    functionCalls: [],
  };
}

function fakeReader(files: string[]): SourceTreeReader {
  return {
    listDirectories: () => [],
    walkFiles: () => files,
    readText: () => "<?php\n",
    isFile: () => true,
  };
}

const fakeParser: PhpSourceParser = { parse: (file) => fileStructure(file) };

describe("auditProject", () => {
  it("usa el scanFiles inyectado (incremental) en vez de scanPhpFiles cuando se provee", () => {
    const scanFiles = vi.fn((phpRoot: string, extensions: string[], ignoredPaths: string[]) => ({
      files: [fileStructure("app/modules/Users/Domain/User.php")],
      skipped: [],
    }));
    const walkFiles = vi.fn(() => ["no/deberia/usarse.php"]);

    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: { listDirectories: () => [], walkFiles, readText: () => "<?php\n", isFile: () => true },
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php", ".inc"],
      ignoredPaths: ["**/vendor/**"],
      scanFiles,
    });

    expect(scanFiles).toHaveBeenCalledWith("app/modules", [".php", ".inc"], ["**/vendor/**"]);
    expect(walkFiles).not.toHaveBeenCalled(); // no cayo al scanPhpFiles por defecto
    expect(snapshot.findings.some((finding) => finding.category === "security")).toBe(true);
  });

  it("combina findings de arquitectura con los nativos de PHP cuando phpRoot esta presente", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    const categories = snapshot.findings.map((finding) => finding.category);

    expect(categories).toContain("architecture_violation");
    expect(categories).toContain("security");
  });

  it("usa phpRoot para agrupar en riskBreakdown.byModule los findings nativos (module derivado del path)", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    // El finding de arquitectura (module "Users") y el nativo (module "" -> derivado "Users"
    // via phpRoot) se agregan bajo el mismo modulo. Sin phpRoot el nativo quedaria fuera.
    expect(snapshot.riskBreakdown.byModule.find((entry) => entry.key === "Users")?.findingsCount).toBe(2);
  });

  it("pone los findings de arquitectura antes que los nativos", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.findings[0].source).toBe("architecture");
    expect(snapshot.findings.at(-1)?.source).toBe("native");
  });

  it("reenvia phpRoot, extensiones e ignoredPaths al escaneo de archivos", () => {
    const walkFiles = vi.fn(() => ["app/modules/Users/Domain/User.php"]);
    const reader: SourceTreeReader = {
      listDirectories: () => [],
      walkFiles,
      readText: () => "<?php\n",
      isFile: () => true,
    };

    auditProject({
      checkResult: buildCheckResult(),
      reader,
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php", ".inc"],
      ignoredPaths: ["**/vendor/**"],
    });

    expect(walkFiles).toHaveBeenCalledWith("app/modules", [".php", ".inc"], ["**/vendor/**"]);
  });

  it("no escanea PHP cuando phpRoot es null y solo devuelve findings de arquitectura", () => {
    const walkFiles = vi.fn(() => []);
    const reader: SourceTreeReader = {
      listDirectories: () => [],
      walkFiles,
      readText: () => "<?php\n",
      isFile: () => true,
    };

    const snapshot = auditProject({
      checkResult: buildCheckResult({ target: "react", module: "Billing" }),
      reader,
      parser: fakeParser,
      phpRoot: null,
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(walkFiles).not.toHaveBeenCalled();
    expect(snapshot.findings.every((finding) => finding.source === "architecture")).toBe(true);
  });

  it("PHP: legacy_api y testedBy desde las clases de test (XRay X5)", () => {
    const structures: Record<string, PhpFileStructure> = {
      "/mc/Trafic.php": { ...fileStructure("/mc/Trafic.php"), classes: [{ name: "Trafic", startLine: 1, endLine: 9, extendsName: null, methods: [] }], functionCalls: [{ name: "each", line: 4 }] },
      "/mc/tests/TraficTest.php": { ...fileStructure("/mc/tests/TraficTest.php"), classes: [{ name: "TraficTest", startLine: 1, endLine: 9, extendsName: "TestCase", methods: [] }], referencedNames: ["Trafic"] },
    };

    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(Object.keys(structures)),
      parser: { parse: (file) => structures[file] },
      phpRoot: "/mc",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.testedBy).toEqual({ "/mc/Trafic.php": ["/mc/tests/TraficTest.php"] });
    expect(snapshot.findings.filter((finding) => finding.category === "legacy_api")).toEqual([
      expect.objectContaining({ rule: "removed-php-function", file: "/mc/Trafic.php", line: 4 }),
    ]);
  });

  it("scannedFiles incluye los PHP parseados", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php", "app/modules/Users/Domain/Account.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.scannedFiles).toEqual(["app/modules/Users/Domain/Account.php", "app/modules/Users/Domain/User.php"]);
  });

  it("reporta en snapshot.skippedFiles los archivos que el parser no pudo procesar", () => {
    const parser: PhpSourceParser = {
      parse: (file) => {
        if (file === "app/modules/Users/Domain/Broken.php") {
          throw new Error("Parse Error : unexpected token");
        }
        return fileStructure(file);
      },
    };

    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php", "app/modules/Users/Domain/Broken.php"]),
      parser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.skippedFiles).toEqual([
      { file: "app/modules/Users/Domain/Broken.php", error: "Parse Error : unexpected token" },
    ]);
    expect(snapshot.summary.files_skipped).toBe(1);
    // El archivo bueno si se analizo (produce su finding nativo).
    expect(snapshot.findings.some((finding) => finding.source === "native")).toBe(true);
  });

  it("deja skippedFiles vacio cuando phpRoot es null", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult({ target: "react", module: "Billing" }),
      reader: fakeReader([]),
      parser: fakeParser,
      phpRoot: null,
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.skippedFiles).toEqual([]);
    expect(snapshot.summary.files_skipped).toBe(0);
  });

  it("marca php_compatibility como skipped cuando no se provee compatibilityScan", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.summary.scanners?.php_compatibility).toEqual({ status: "skipped" });
    expect(snapshot.findings.some((finding) => finding.source === "external")).toBe(false);
  });

  it("agrega findings external y status ok cuando el compatibilityScan trae issues", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
      compatibilityScan: {
        status: "ok",
        targetPhp: "8.3",
        issues: [
          {
            file: "app/modules/Users/Domain/User.php",
            line: 10,
            rule: "PHPCompatibility.FunctionUse.RemovedFunctions.eachFound",
            severityRaw: "error",
            message: "each() removed",
          },
        ],
      },
    });

    expect(snapshot.summary.scanners?.php_compatibility).toEqual({ status: "ok", targetPhp: "8.3" });
    const compat = snapshot.findings.filter((finding) => finding.category === "php_compatibility");
    expect(compat).toHaveLength(1);
    expect(compat[0].source).toBe("external");
  });

  it("propaga el motivo cuando el compatibilityScan esta unavailable y no agrega findings", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult(),
      reader: fakeReader(["app/modules/Users/Domain/User.php"]),
      parser: fakeParser,
      phpRoot: "app/modules",
      phpExtensions: [".php"],
      ignoredPaths: [],
      compatibilityScan: { status: "unavailable", reason: "Docker no esta disponible" },
    });

    expect(snapshot.summary.scanners?.php_compatibility).toEqual({
      status: "unavailable",
      reason: "Docker no esta disponible",
    });
    expect(snapshot.findings.some((finding) => finding.category === "php_compatibility")).toBe(false);
  });

  describe("con js (target react)", () => {
    const jsStructure = (file: string): JsFileStructure => ({
      file,
      linesCount: 3,
      classes: [],
      functions: [],
      imports: [],
      exports: [],
      securityIssues: [{ rule: "eval-usage", line: 2 }],
      httpCalls: [],
      globalAccesses: [],
      legacyReactApis: [],
    });
    const jsParser: JsSourceParser = {
      parse: (file) => {
        if (file.endsWith("broken.js")) throw new Error("Unexpected token");
        return jsStructure(file);
      },
    };
    const jsInput = { root: "/src", extensions: [".js"], ignoredPaths: ["**/__tests__/**"], parser: jsParser };

    it("escanea la raiz JS con su config y suma los findings nativos de JS", () => {
      const walkFiles = vi.fn(() => ["/src/pages/index.js"]);

      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react" }),
        reader: { listDirectories: () => [], walkFiles, readText: () => "", isFile: () => true },
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: jsInput,
      });

      expect(walkFiles).toHaveBeenCalledTimes(1);
      expect(walkFiles).toHaveBeenCalledWith("/src", [".js"], ["**/__tests__/**"]);
      expect(snapshot.findings.filter((finding) => finding.source === "native")).toEqual([
        expect.objectContaining({ category: "security", rule: "eval-usage", file: "/src/pages/index.js", line: 2 }),
      ]);
      expect(snapshot.findings[0].source).toBe("architecture");
    });

    it("corre los analizadores JS (incluye legacy_api, XRay X5)", () => {
      const file: JsFileStructure = {
        ...jsStructure("/src/pages/a_old.js"),
        functions: [{ name: "A", kind: "function", startLine: 1, endLine: 400, parametersCount: 0, decisionPointsCount: 0, containsJsx: true }],
        httpCalls: [{ client: "fetch", endpoint: "/x", line: 3 }],
        globalAccesses: [{ kind: "jquery", line: 4 }],
        legacyReactApis: [{ api: "render", line: 5 }],
      };

      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react" }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: { ...jsInput, scanFiles: () => ({ files: [file], skipped: [] }) },
      });

      expect(new Set(snapshot.findings.filter((finding) => finding.source === "native").map((finding) => finding.category))).toEqual(
        new Set(["complexity", "coupling_low_level", "dead_code", "security", "api_access", "testing", "legacy_api"]),
      );
    });

    it("usa el scanFiles JS inyectado en vez de recorrer el arbol", () => {
      const walkFiles = vi.fn(() => []);
      const scanFiles = vi.fn(() => ({ files: [jsStructure("/src/a.js")], skipped: [] }));

      auditProject({
        checkResult: buildCheckResult({ target: "react" }),
        reader: { listDirectories: () => [], walkFiles, readText: () => "", isFile: () => true },
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: { ...jsInput, scanFiles },
      });

      expect(scanFiles).toHaveBeenCalledWith("/src", [".js"], ["**/__tests__/**"]);
      expect(walkFiles).not.toHaveBeenCalled();
    });

    it("reporta los archivos JS que no parsean en skippedFiles", () => {
      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react" }),
        reader: fakeReader(["/src/ok.js", "/src/broken.js"]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: jsInput,
      });

      expect(snapshot.skippedFiles).toEqual([{ file: "/src/broken.js", error: "Unexpected token" }]);
      expect(snapshot.summary.files_skipped).toBe(1);
    });

    it("testRoots: sus archivos son evidencia de tests y no generan findings propios", () => {
      const component: JsFileStructure = {
        ...jsStructure("/src/pages/Card.tsx"),
        securityIssues: [],
        functions: [{ name: "Card", kind: "function", startLine: 1, endLine: 5, parametersCount: 0, decisionPointsCount: 0, containsJsx: true }],
      };
      const testFile: JsFileStructure = {
        ...jsStructure("/tests/pages/Card.test.tsx"),
        imports: [{ source: "../../src/pages/Card.js", names: [], line: 1 }],
        functions: [{ name: "big", kind: "function", startLine: 1, endLine: 400, parametersCount: 0, decisionPointsCount: 30, containsJsx: false }],
      };
      const scanFiles = vi.fn((root: string) => ({ files: root === "/tests" ? [testFile] : [component], skipped: [] }));

      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: { ...jsInput, root: "/src", testRoots: ["/tests"], scanFiles },
      });

      expect(scanFiles).toHaveBeenCalledWith("/tests", [".js"], []);
      expect(snapshot.findings.some((finding) => finding.rule === "untested-component")).toBe(false);
      expect(snapshot.findings.some((finding) => finding.file.startsWith("/tests/"))).toBe(false);
    });

    it("un helper con componentes dentro de testRoots (sin .test.) no se reporta como componente sin test", () => {
      const untested: JsFileStructure = {
        ...jsStructure("/src/pages/Orphan.tsx"),
        securityIssues: [],
        functions: [{ name: "Orphan", kind: "function", startLine: 1, endLine: 5, parametersCount: 0, decisionPointsCount: 0, containsJsx: true }],
      };
      const helper: JsFileStructure = {
        ...jsStructure("/tests/support/Harness.tsx"),
        securityIssues: [],
        functions: [{ name: "Harness", kind: "function", startLine: 1, endLine: 5, parametersCount: 0, decisionPointsCount: 0, containsJsx: true }],
      };

      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: {
          ...jsInput,
          root: "/src",
          testRoots: ["/tests"],
          scanFiles: (root: string) => ({ files: root === "/tests" ? [helper] : [untested], skipped: [] }),
        },
      });

      // El helper de tests no se reporta; el componente real sin test, si.
      expect(snapshot.findings.filter((finding) => finding.rule === "untested-component").map((finding) => finding.file)).toEqual([
        "/src/pages/Orphan.tsx",
      ]);
    });

    it("testedBy: tests del escaneo y de testRoots que importan cada archivo; legacy_api sin findings de testRoots (XRay X5)", () => {
      const legacy = { legacyReactApis: [{ api: "render" as const, line: 1 }] };
      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: {
          ...jsInput,
          root: "/src",
          testRoots: ["/tests"],
          scanFiles: (root: string) => ({
            files:
              root === "/tests"
                ? [{ ...jsStructure("/tests/a.test.js"), imports: [{ source: "../src/a", names: [], line: 1 }] }, { ...jsStructure("/tests/support/mount.js"), ...legacy }]
                : [{ ...jsStructure("/src/a.js"), ...legacy }, { ...jsStructure("/src/a.spec.js"), imports: [{ source: "./a", names: [], line: 1 }] }],
            skipped: [],
          }),
        },
      });

      expect(snapshot.testedBy).toEqual({ "/src/a.js": ["/src/a.spec.js", "/tests/a.test.js"] });
      expect(snapshot.findings.filter((finding) => finding.category === "legacy_api").map((finding) => finding.file)).toEqual(["/src/a.js"]);
    });

    it("scannedFiles: los JS analizados (no los de testRoots), ordenados", () => {
      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: {
          ...jsInput,
          root: "/src",
          testRoots: ["/tests"],
          scanFiles: (root: string) => ({
            files: root === "/tests" ? [jsStructure("/tests/a.test.js")] : [jsStructure("/src/z.js"), jsStructure("/src/a.js")],
            skipped: [],
          }),
        },
      });

      expect(snapshot.scannedFiles).toEqual(["/src/a.js", "/src/z.js"]);
    });

    it("sin testRoots el componente queda sin test", () => {
      const component: JsFileStructure = {
        ...jsStructure("/src/pages/Card.tsx"),
        functions: [{ name: "Card", kind: "function", startLine: 1, endLine: 5, parametersCount: 0, decisionPointsCount: 0, containsJsx: true }],
      };

      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader([]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: { ...jsInput, root: "/src", scanFiles: () => ({ files: [component], skipped: [] }) },
      });

      expect(snapshot.findings.some((finding) => finding.rule === "untested-component")).toBe(true);
    });

    it("agrupa byModule por la primera carpeta bajo js.root", () => {
      const snapshot = auditProject({
        checkResult: buildCheckResult({ target: "react", reports: [] }),
        reader: fakeReader(["/src/pages/a.js", "/src/pages/b.js", "/src/globals/g.js"]),
        parser: fakeParser,
        phpRoot: null,
        phpExtensions: [".php"],
        ignoredPaths: [],
        js: jsInput,
      });

      const modules = Object.fromEntries(snapshot.riskBreakdown.byModule.map((entry) => [entry.key, entry.findingsCount]));
      expect(modules.pages).toBeGreaterThanOrEqual(2);
      expect(modules.globals).toBeGreaterThanOrEqual(1);
    });
  });

  it("toma target, module y los conteos del summary desde el checkResult", () => {
    const snapshot = auditProject({
      checkResult: buildCheckResult({ target: "react", module: "Billing" }),
      reader: fakeReader([]),
      parser: fakeParser,
      phpRoot: null,
      phpExtensions: [".php"],
      ignoredPaths: [],
    });

    expect(snapshot.target).toBe("react");
    expect(snapshot.module).toBe("Billing");
    expect(snapshot.summary.files_scanned).toBe(3);
    expect(snapshot.summary.modules).toBe(1);
  });
});
