import { describe, expect, it, vi } from "vitest";

import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
import type { PhpFileStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
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
