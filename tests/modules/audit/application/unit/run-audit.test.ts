import { describe, expect, it } from "vitest";

import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import { runAudit } from "../../../../../app/modules/audit/application/use-cases/RunAudit.js";

function buildCheckResult(overrides: Partial<ArchitectureCheckResult> = {}): ArchitectureCheckResult {
  return {
    checked_at: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    fail_on_coupling: true,
    passed: false,
    summary: {
      modules: 1,
      files_scanned: 10,
      violations_count: 1,
      couplings_count: 1,
    },
    reports: [
      {
        module: "Users",
        module_path: "app/modules/Users",
        passed: false,
        files_scanned: 10,
        violations_count: 1,
        couplings_count: 1,
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
        couplings: [
          {
            module: "Users",
            layer: "Application",
            file: "Users/Application/UseCases/CreateUser.php",
            line: 12,
            import: "App\\Modules\\Billing\\Application\\UseCases\\ChargeCard",
            message: "Users depende directamente de Billing",
            target_module: "Billing",
            assessment: "Acoplamiento directo entre modulos",
            recommendation: "Definir un puerto compartido",
            action: "extract-interface",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("runAudit", () => {
  it("convierte violations en findings de categoria architecture_violation y severidad high", () => {
    const snapshot = runAudit(buildCheckResult());

    expect(snapshot.findings[0]).toMatchObject({
      category: "architecture_violation",
      rule: "layer-violation",
      severity: "high",
      source: "architecture",
      module: "Users",
      class: null,
      file: "Users/Domain/User.php",
      line: 3,
      message: "Domain no debe importar Illuminate",
      suggestion: "Mueve la dependencia a Infrastructure",
    });
  });

  it("convierte couplings en findings de categoria coupling_module y severidad medium, preservando details", () => {
    const snapshot = runAudit(buildCheckResult());

    expect(snapshot.findings[1]).toMatchObject({
      category: "coupling_module",
      rule: "module-coupling",
      severity: "medium",
      source: "architecture",
      module: "Users",
      file: "Users/Application/UseCases/CreateUser.php",
      details: {
        target_module: "Billing",
        assessment: "Acoplamiento directo entre modulos",
        recommendation: "Definir un puerto compartido",
        action: "extract-interface",
      },
    });
  });

  it("respeta el orden: dentro de cada modulo, violations antes que couplings", () => {
    const snapshot = runAudit(buildCheckResult());

    expect(snapshot.findings.map((finding) => finding.category)).toEqual([
      "architecture_violation",
      "coupling_module",
    ]);
  });

  it("calcula riskScore.value como violations*3 + couplings*2 usando los totales del summary", () => {
    const snapshot = runAudit(buildCheckResult());

    expect(snapshot.riskScore.value).toBe(1 * 3 + 1 * 2);
    expect(snapshot.riskScore.breakdown).toEqual({
      architecture_violation: 3,
      coupling_module: 2,
    });
  });

  it("summary.findings_count coincide con findings.length y agrega by_category/by_severity", () => {
    const snapshot = runAudit(buildCheckResult());

    expect(snapshot.summary.findings_count).toBe(snapshot.findings.length);
    expect(snapshot.summary.by_category).toEqual({ architecture_violation: 1, coupling_module: 1 });
    expect(snapshot.summary.by_severity).toEqual({ high: 1, medium: 1 });
    expect(snapshot.summary.files_scanned).toBe(10);
    expect(snapshot.summary.modules).toBe(1);
  });

  it("un coupling sin campos opcionales no falla y details solo incluye las claves presentes", () => {
    const checkResult = buildCheckResult({
      summary: { modules: 1, files_scanned: 4, violations_count: 0, couplings_count: 1 },
      reports: [
        {
          module: "Billing",
          module_path: "app/modules/Billing",
          passed: false,
          files_scanned: 4,
          violations_count: 0,
          couplings_count: 1,
          violations: [],
          couplings: [
            {
              module: "Billing",
              layer: "Application",
              file: "Billing/Application/UseCases/ChargeCard.php",
              line: 5,
              import: "App\\Modules\\Users\\Domain\\User",
              message: "Billing depende directamente de Users",
            },
          ],
        },
      ],
    });

    const snapshot = runAudit(checkResult);

    expect(snapshot.findings[0].details).toStrictEqual({});
  });

  it("checkResult sin modulos produce un snapshot vacio sin lanzar error", () => {
    const checkResult = buildCheckResult({
      summary: { modules: 0, files_scanned: 0, violations_count: 0, couplings_count: 0 },
      reports: [],
    });

    const snapshot = runAudit(checkResult);

    expect(snapshot.findings).toEqual([]);
    expect(snapshot.riskScore.value).toBe(0);
    expect(snapshot.summary.findings_count).toBe(0);
  });

  it("hereda target y module del checkResult, y genera un generatedAt en formato ISO", () => {
    const snapshot = runAudit(buildCheckResult({ target: "react", module: "Billing" }));

    expect(snapshot.target).toBe("react");
    expect(snapshot.module).toBe("Billing");
    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
