import { describe, expect, it } from "vitest";

import {
  STATUS_ORDER,
  ageLabel,
  dependencyKey,
  filterDependencies,
  groupByStatus,
  filesLabel,
  groupMates,
  usageLabel,
  manifestLabel,
  runtimeKindLabel,
  securityBadge,
  severityColor,
  severityLabel,
  supportLabel,
  runtimeOptions,
  statusColor,
  statusLabel,
  upToDatePercent,
  upgradeHint,
  versionText,
} from "../../../../../modules/dependencies-explorer/presentation/utils/dependencyView";
import { entry, vuln } from "./fixtures";

describe("estados", () => {
  it("orden de lo mas urgente a lo sano, con etiqueta y color", () => {
    expect(STATUS_ORDER).toEqual(["abandoned", "deprecated", "major", "minor", "patch", "unknown", "up_to_date"]);
    expect(STATUS_ORDER.map(statusLabel)).toEqual(["Abandonado", "Deprecated", "Major", "Minor", "Patch", "Desconocido", "Al dia"]);
    expect(STATUS_ORDER.map(statusColor)).toEqual(["#dc2626", "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#64748b", "#16a34a"]);
  });

  it("dependencyKey une ecosistema y nombre", () => {
    expect(dependencyKey(entry({ ecosystem: "composer", name: "a/b" }))).toBe("composer:a/b");
  });
});

describe("filterDependencies", () => {
  const deps = [entry({ name: "React", status: "major" }), entry({ name: "jest", dev: true, status: "major" }), entry({ name: "lodash" })];
  const all = { status: "all" as const, query: "", hideDev: false, onlyVulnerable: false };

  it("sin filtros devuelve todo", () => {
    expect(filterDependencies(deps, all)).toEqual(deps);
  });

  it("por estado, por nombre (trim y sin mayusculas) y ocultando dev", () => {
    expect(filterDependencies(deps, { ...all, status: "major" }).map((d) => d.name)).toEqual(["React", "jest"]);
    expect(filterDependencies(deps, { ...all, query: "  reAC " }).map((d) => d.name)).toEqual(["React"]);
    expect(filterDependencies(deps, { ...all, hideDev: true }).map((d) => d.name)).toEqual(["React", "lodash"]);
  });

  it("onlyVulnerable deja solo los que tienen vulnerabilidades", () => {
    const vulnerable = entry({ name: "vite", security: { vulnerabilities: [vuln()], maxSeverity: "high", recommendedAffected: false } });

    expect(filterDependencies([...deps, vulnerable], { ...all, onlyVulnerable: true }).map((d) => d.name)).toEqual(["vite"]);
  });
});

describe("groupByStatus", () => {
  it("agrupa en STATUS_ORDER, sin grupos vacios y por nombre", () => {
    const groups = groupByStatus([entry({ name: "b" }), entry({ name: "z", status: "major" }), entry({ name: "a" }), entry({ name: "m", status: "major" })]);

    expect(groups.map((group) => [group.status, group.items.map((item) => item.name)])).toEqual([
      ["major", ["m", "z"]],
      ["up_to_date", ["a", "b"]],
    ]);
  });
});

describe("manifestLabel", () => {
  it.each([
    ["/p/src/a/package.json", "/p/src", "a/package.json"],
    ["/p/package.json", "/p/src", "../package.json"],
    ["/x/composer.json", "/p/src", "../../x/composer.json"],
    ["/p/src/package.json", "/p/src/", "package.json"],
    ["/p/srcx/package.json", "/p/src", "../srcx/package.json"],
  ])("%s desde %s → %s", (manifest, root, expected) => {
    expect(manifestLabel(manifest, root)).toBe(expected);
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-10-02T12:00:00.000Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  it.each([
    [null, ""],
    [daysAgo(0.5), "hoy"],
    [daysAgo(1), "hace 1 dia"],
    [daysAgo(29), "hace 29 dias"],
    [daysAgo(30), "hace 1 mes"],
    [daysAgo(364), "hace 12 meses"],
    [daysAgo(365), "hace 1 año"],
    [daysAgo(365 * 5 + 100), "hace 5 años"],
  ])("%s → %s", (publishedAt, expected) => {
    expect(ageLabel(publishedAt, now)).toBe(expected);
  });
});

describe("seguridad y soporte", () => {
  it("etiqueta y color por severidad", () => {
    const severities = ["critical", "high", "moderate", "low", "unknown"] as const;

    expect(severities.map(severityLabel)).toEqual(["Critica", "Alta", "Moderada", "Baja", "Desconocida"]);
    expect(severities.map(severityColor)).toEqual(["#991b1b", "#dc2626", "#ea580c", "#ca8a04", "#64748b"]);
  });

  it("securityBadge cuenta vulnerabilidades con la severidad maxima", () => {
    expect(securityBadge(entry())).toBe("");
    expect(securityBadge(entry({ security: { vulnerabilities: [vuln()], maxSeverity: "high", recommendedAffected: false } }))).toBe("1 vuln · Alta");
    expect(securityBadge(entry({ security: { vulnerabilities: [vuln(), vuln()], maxSeverity: "critical", recommendedAffected: false } }))).toBe("2 vulns · Critica");
  });

  it("supportLabel: vencido o vigente, con fecha o booleano", () => {
    const support = (eol: string | boolean, isEol: boolean) => ({ product: "php", cycle: "8.3", eol, isEol, latestInCycle: null });

    expect(supportLabel(null)).toBe("");
    expect(supportLabel(support("2025-04-30", true))).toBe("sin soporte desde 2025-04-30");
    expect(supportLabel(support(true, true))).toBe("sin soporte");
    expect(supportLabel(support("2027-12-31", false))).toBe("soporte hasta 2027-12-31");
    expect(supportLabel(support(false, false))).toBe("con soporte");
  });
});

describe("upgradeHint", () => {
  it("las vulnerabilidades van primero (despues de la falta de datos)", () => {
    const security = (recommendedAffected: boolean) => ({ vulnerabilities: [vuln()], maxSeverity: "high" as const, recommendedAffected });

    expect(upgradeHint(entry({ status: "major", recommended: "6.4.3", security: security(false) }))).toBe("Vulnerable (Alta): actualizar a 6.4.3");
    expect(upgradeHint(entry({ status: "patch", recommended: "3.2.7", security: security(true) }))).toBe("Vulnerable (Alta): ninguna version compatible corrige todo");
    expect(upgradeHint(entry({ status: "abandoned", recommended: null, replacement: "x/y", security: security(false) }))).toBe("Vulnerable (Alta): Abandonado: reemplazar por x/y");
    expect(upgradeHint(entry({ status: "abandoned", recommended: "1.8.1", replacement: "phpoffice/phpspreadsheet", security: security(true) }))).toBe(
      "Vulnerable (Alta): Abandonado: reemplazar por phpoffice/phpspreadsheet",
    );
    expect(upgradeHint(entry({ status: "unknown", lookupError: "timeout", security: security(false) }))).toBe("Sin datos del registro: timeout");
    expect(upgradeHint(entry({ status: "deprecated", deprecation: "Package no longer supported", recommended: null, security: security(false) }))).toBe(
      "Vulnerable (Alta): Deprecated: Package no longer supported",
    );
  });

  it("prioriza falta de datos, abandonado y falta de version compatible", () => {
    expect(upgradeHint(entry({ status: "unknown", lookupError: "timeout" }))).toBe("Sin datos del registro: timeout");
    expect(upgradeHint(entry({ status: "abandoned", replacement: "phpoffice/phpspreadsheet" }))).toBe("Abandonado: reemplazar por phpoffice/phpspreadsheet");
    expect(upgradeHint(entry({ status: "abandoned" }))).toBe("Abandonado: buscar reemplazo");
    expect(upgradeHint(entry({ status: "deprecated", recommended: null, limitedByRuntime: true, deprecation: "x" }))).toBe(
      "Ninguna version vigente funciona con el runtime elegido: requiere uno mas nuevo",
    );
  });

  it("deprecated, limitado por runtime, salto de version y al dia", () => {
    expect(upgradeHint(entry({ status: "deprecated", deprecation: "usa sass", recommended: "2.0.0" }))).toBe("Deprecated: usa sass · ir a 2.0.0");
    expect(upgradeHint(entry({ status: "deprecated", deprecation: "usa sass", recommended: null }))).toBe("Deprecated: usa sass");
    expect(upgradeHint(entry({ status: "major", recommended: "6.4.3", latest: "8.0.0", limitedByRuntime: true }))).toBe(
      "Actualizar a 6.4.3 (la 8.0.0 requiere un runtime mas nuevo)",
    );
    expect(upgradeHint(entry({ status: "minor", recommended: "1.3.0" }))).toBe("Actualizar a 1.3.0");
    expect(upgradeHint(entry({ status: "patch", recommended: "1.0.1" }))).toBe("Actualizar a 1.0.1");
    expect(upgradeHint(entry({ status: "major", recommended: "2.0.0" }))).toBe("Actualizar a 2.0.0");
    expect(upgradeHint(entry())).toBe("Al dia");
    expect(upgradeHint(entry({ status: "major", recommended: "2.0.0", lookupError: "timeout", stale: true }))).toBe("Actualizar a 2.0.0");
    expect(upgradeHint(entry({ status: "unknown" }))).toBe("Al dia");
  });
});

describe("runtimeKindLabel", () => {
  it("PHP, Node y npm", () => {
    expect(["php", "node", "npm"].map((kind) => runtimeKindLabel(kind as "php"))).toEqual(["PHP", "Node", "npm"]);
  });
});

describe("runtimeOptions con ciclos de endoflife.date", () => {
  const cycles = Array.from({ length: 14 }, (_, index) => ({ cycle: String(26 - index), latest: `${26 - index}.1.0`, eol: index < 2 ? false : "2025-01-01", isEol: index >= 2 }));

  it("detectada primero y hasta 12 ciclos con su soporte, sin repetir la detectada ni ciclos sin latest", () => {
    const options = runtimeOptions({ kind: "node", version: "25.1.0", source: "local", selected: "25.1.0", support: null, cycles: [...cycles.slice(0, 1), { cycle: "99", latest: null, eol: false, isEol: false }, ...cycles.slice(1)] });

    expect(options[0]).toEqual({ value: "25.1.0", label: "25.1.0 (detectado: local)" });
    expect(options[1]).toEqual({ value: "26.1.0", label: "Node 26 (26.1.0) · con soporte" });
    expect(options[2]).toEqual({ value: "24.1.0", label: "Node 24 (24.1.0) · sin soporte desde 2025-01-01" });
    expect(options).toHaveLength(13);
    expect(options.at(-1)?.value).toBe("14.1.0");
  });
});

describe("runtimeOptions", () => {
  it("la detectada primero y despues las lineas conocidas sin repetirla", () => {
    const options = runtimeOptions({ kind: "node", version: "20.19.5", source: "local", selected: "20.19.5", support: null, cycles: [] });

    expect(options[0]).toEqual({ value: "20.19.5", label: "20.19.5 (detectado: local)" });
    expect(options.slice(1).map((option) => option.label)).toEqual([
      "Node 12 (12.22.12)",
      "Node 14 (14.21.3)",
      "Node 16 (16.20.2)",
      "Node 18 (18.20.8)",
      "Node 22 (22.20.0)",
      "Node 24 (24.9.0)",
    ]);
  });

  it("php usa mayor.menor; sin detectada solo las lineas", () => {
    const php = runtimeOptions({ kind: "php", version: null, source: "desconocido", selected: null, support: null, cycles: [] });

    expect(php[0]).toEqual({ value: "5.6.40", label: "PHP 5.6 (5.6.40)" });
    expect(php.map((option) => option.value)).toEqual(["5.6.40", "7.0.33", "7.1.33", "7.2.34", "7.3.33", "7.4.33", "8.0.30", "8.1.33", "8.2.29", "8.3.26", "8.4.13"]);
    expect(runtimeOptions({ kind: "npm", version: "10.9.2", source: "local", selected: null, support: null, cycles: [] }).map((option) => option.label)).toEqual([
      "10.9.2 (detectado: local)",
      "npm 6 (6.14.18)",
      "npm 7 (7.24.2)",
      "npm 8 (8.19.4)",
      "npm 9 (9.9.4)",
      "npm 10 (10.9.3)",
      "npm 11 (11.6.1)",
    ]);
  });
});

describe("uso y grupos", () => {
  it("usageLabel", () => {
    const usage = (files: number, inManifest: boolean, unused = false) => entry({ usage: { files, inManifest, unused } });

    expect(usageLabel(entry())).toBe("");
    expect(usageLabel(usage(0, false, true))).toBe("sin uso");
    expect(usageLabel(usage(1, false))).toBe("1 archivo");
    expect(usageLabel(usage(12, false))).toBe("12 archivos");
    expect(usageLabel(usage(3, true))).toBe("3 archivos + manifiesto");
    expect(usageLabel(usage(0, true))).toBe("en el manifiesto");
  });

  it("filesLabel singular y plural", () => {
    expect([filesLabel(1), filesLabel(2), filesLabel(0)]).toEqual(["1 archivo", "2 archivos", "0 archivos"]);
  });

  it("groupMates: los otros del mismo grupo, por nombre", () => {
    const all = [entry({ name: "react-dom", group: "react" }), entry({ name: "react", group: "react" }), entry({ name: "@types/react", group: "react" }), entry({ name: "jest", group: "jest" }), entry({ name: "lodash" }), entry({ name: "moment" })];

    expect(groupMates(all[1], all)).toEqual(["@types/react", "react-dom"]);
    expect(groupMates(all[3], all)).toEqual([]);
    expect(groupMates(all[4], all)).toEqual([]);
  });
});

describe("versionText", () => {
  it("actual → recomendada solo si hay salto", () => {
    expect(versionText(entry({ current: null }))).toBe("—");
    expect(versionText(entry({ current: "1.0.0", recommended: null }))).toBe("1.0.0");
    expect(versionText(entry({ current: "1.0.0", recommended: "1.0.0" }))).toBe("1.0.0");
    expect(versionText(entry({ current: "1.0.0", recommended: "2.0.0" }))).toBe("1.0.0 → 2.0.0");
  });
});

describe("upToDatePercent", () => {
  it("redondea y es 100 sin paquetes", () => {
    const summary = (upToDate: number, total: number) => ({
      total,
      byStatus: { up_to_date: upToDate, patch: 0, minor: 0, major: 0, deprecated: 0, abandoned: 0, unknown: 0 },
      limitedByRuntime: 0,
      lookupErrors: 0,
      vulnerable: 0,
      bySeverity: { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 },
      endOfLife: 0,
      unused: 0,
    });

    expect(upToDatePercent(summary(1, 3))).toBe(33);
    expect(upToDatePercent(summary(2, 3))).toBe(67);
    expect(upToDatePercent(summary(0, 0))).toBe(100);
  });
});
