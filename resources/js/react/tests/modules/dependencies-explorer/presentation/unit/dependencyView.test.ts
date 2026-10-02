import { describe, expect, it } from "vitest";

import {
  STATUS_ORDER,
  ageLabel,
  dependencyKey,
  filterDependencies,
  groupByStatus,
  manifestLabel,
  runtimeKindLabel,
  runtimeOptions,
  statusColor,
  statusLabel,
  upToDatePercent,
  upgradeHint,
  versionText,
} from "../../../../../modules/dependencies-explorer/presentation/utils/dependencyView";
import { entry } from "./fixtures";

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
  const all = { status: "all" as const, query: "", hideDev: false };

  it("sin filtros devuelve todo", () => {
    expect(filterDependencies(deps, all)).toEqual(deps);
  });

  it("por estado, por nombre (trim y sin mayusculas) y ocultando dev", () => {
    expect(filterDependencies(deps, { ...all, status: "major" }).map((d) => d.name)).toEqual(["React", "jest"]);
    expect(filterDependencies(deps, { ...all, query: "  reAC " }).map((d) => d.name)).toEqual(["React"]);
    expect(filterDependencies(deps, { ...all, hideDev: true }).map((d) => d.name)).toEqual(["React", "lodash"]);
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

describe("upgradeHint", () => {
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

describe("runtimeOptions", () => {
  it("la detectada primero y despues las lineas conocidas sin repetirla", () => {
    const options = runtimeOptions({ kind: "node", version: "20.19.5", source: "local", selected: "20.19.5" });

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
    const php = runtimeOptions({ kind: "php", version: null, source: "desconocido", selected: null });

    expect(php[0]).toEqual({ value: "5.6.40", label: "PHP 5.6 (5.6.40)" });
    expect(php.map((option) => option.value)).toEqual(["5.6.40", "7.0.33", "7.1.33", "7.2.34", "7.3.33", "7.4.33", "8.0.30", "8.1.33", "8.2.29", "8.3.26", "8.4.13"]);
    expect(runtimeOptions({ kind: "npm", version: "10.9.2", source: "local", selected: null }).map((option) => option.label)).toEqual([
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
    });

    expect(upToDatePercent(summary(1, 3))).toBe(33);
    expect(upToDatePercent(summary(2, 3))).toBe(67);
    expect(upToDatePercent(summary(0, 0))).toBe(100);
  });
});
