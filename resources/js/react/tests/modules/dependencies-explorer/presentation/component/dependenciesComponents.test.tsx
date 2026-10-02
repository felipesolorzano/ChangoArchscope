import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { DependencyReport } from "../../../../../modules/dependencies-explorer/domain/value-objects/DependencyReport";
import { DependencyVulnerabilities } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyVulnerabilities";
import { DependencyFilters } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyFilters";
import { DependencyDrawer } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyDrawer";
import { DependencyList } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyList";
import { DependencySummary } from "../../../../../modules/dependencies-explorer/presentation/components/DependencySummary";
import { RuntimeSelector } from "../../../../../modules/dependencies-explorer/presentation/components/RuntimeSelector";
import DependenciesExplorer from "../../../../../modules/dependencies-explorer/presentation/pages/DependenciesExplorer";
import { initialDependenciesExplorerState, useDependenciesExplorerStore } from "../../../../../modules/dependencies-explorer/presentation/store/dependenciesExplorerStore";
import { entry, vuln } from "../unit/fixtures";

const html = (element: JSX.Element) => renderToStaticMarkup(element);
const NOW = new Date("2026-10-02T12:00:00.000Z");

const report: DependencyReport = {
  generatedAt: NOW.toISOString(),
  root: "/p/src",
  manifests: ["/p/package.json"],
  skipped: [],
  runtimes: [
    {
      kind: "node",
      version: "18.18.0",
      source: "package.json engines.node",
      selected: "18.18.0",
      support: { product: "nodejs", cycle: "18", eol: "2025-04-30", isEol: true, latestInCycle: "18.20.8" },
      cycles: [],
    },
  ],
  dependencies: [
    entry({
      name: "react",
      status: "major",
      current: "16.14.0",
      recommended: "19.3.0",
      latest: "19.3.0",
      currentPublishedAt: "2020-10-14T00:00:00.000Z",
      support: { product: "react", cycle: "16", eol: true, isEol: true, latestInCycle: "16.14.0" },
      security: { vulnerabilities: [vuln({ id: "GHSA-r", cve: "CVE-9", summary: "XSS en render", fixedIn: "16.14.1" }), vuln({ id: "GHSA-s", cve: null, severity: "moderate", fixedIn: null })], maxSeverity: "high", recommendedAffected: false },
      advisoryError: "timeout",
    }),
    entry({ name: "jest", dev: true, status: "major", current: "24.9.0", recommended: "29.7.0", latest: "30.5.2", limitedByRuntime: true }),
    entry({ name: "request", status: "deprecated", deprecation: "request has been deprecated", recommended: null, latest: "2.88.2", current: "2.88.2" }),
    entry({ ecosystem: "composer", name: "phpoffice/phpexcel", manifest: "/p/src/xls/Classes/PHPExcel.php", status: "abandoned", replacement: "phpoffice/phpspreadsheet", vendored: { files: 2 } }),
    entry({ name: "lodash", group: "react", usage: { files: 0, inManifest: false, unused: true } }),
  ],
  summary: {
    total: 5,
    byStatus: { up_to_date: 1, patch: 0, minor: 0, major: 2, deprecated: 1, abandoned: 1, unknown: 0 },
    limitedByRuntime: 1,
    lookupErrors: 0,
    vulnerable: 1,
    bySeverity: { critical: 0, high: 1, moderate: 0, low: 0, unknown: 0 },
    endOfLife: 1,
    unused: 1,
    vendored: 1,
  },
};

beforeEach(() => {
  useDependenciesExplorerStore.setState(initialDependenciesExplorerState());
});

describe("RuntimeSelector", () => {
  it("un select por runtime con la seleccion del reporte por default", () => {
    const markup = html(<RuntimeSelector runtimes={report.runtimes} />);

    expect(markup).toContain("Calcular con");
    expect(markup).toContain("Node");
    expect(markup).toMatch(/<option value="18.18.0" selected="">18.18.0 \(detectado: package.json engines.node\)<\/option>/);
    expect(markup).toContain("Node 22 (22.20.0)");
  });

  it("muestra el soporte del runtime elegido y avisa si ya no tiene", () => {
    expect(html(<RuntimeSelector runtimes={report.runtimes} />)).toMatch(/deps-runtime__support deps-runtime__support--eol[^>]*>Node 18: sin soporte desde 2025-04-30</);

    const supported = [{ ...report.runtimes[0], support: { product: "nodejs", cycle: "22", eol: "2027-04-30", isEol: false, latestInCycle: null } }];
    expect(html(<RuntimeSelector runtimes={supported} />)).toMatch(/class="deps-runtime__support">Node 22: soporte hasta 2027-04-30</);
    expect(html(<RuntimeSelector runtimes={[{ ...report.runtimes[0], support: null }]} />)).not.toContain("deps-runtime__support");
  });

  it("la eleccion del store gana a la del reporte", () => {
    useDependenciesExplorerStore.setState({ runtimes: { node: "22.20.0" } });

    expect(html(<RuntimeSelector runtimes={report.runtimes} />)).toMatch(/<option value="22.20.0" selected="">/);
  });
});

describe("DependencySummary", () => {
  it("porcentaje al dia, chips por estado con cantidad y avisos", () => {
    const markup = html(<DependencySummary summary={report.summary} />);

    expect(markup).toContain("20% al dia");
    expect(markup).toContain("Major 2");
    expect(markup).toContain("Abandonado 1");
    expect(markup).not.toContain("Patch 0");
    expect(markup).toContain("1 limitados por el runtime");
    expect(markup).toContain("1 fuera de soporte");
    expect(markup).toContain("1 sin uso");
    expect(markup).toContain("1 copiadas a mano");
    expect(markup.indexOf("Vulnerables 1")).toBeLessThan(markup.indexOf("Abandonado 1"));
    expect(markup).not.toContain("sin datos del registro");
    expect(markup).toMatch(/deps-summary__segment[^>]*background:#ea580c;width:40%/);
  });

  it("sin vulnerables ni paquetes vencidos no hay chip ni nota", () => {
    const markup = html(<DependencySummary summary={{ ...report.summary, vulnerable: 0, endOfLife: 0, unused: 0, vendored: 0 }} />);

    expect(markup).not.toContain("copiadas a mano");

    expect(markup).not.toContain("sin uso");

    expect(markup).not.toContain("Vulnerables");
    expect(markup).not.toContain("fuera de soporte");
  });

  it("el chip de vulnerables queda activo con el filtro", () => {
    useDependenciesExplorerStore.setState({ onlyVulnerable: true });

    expect(html(<DependencySummary summary={report.summary} />)).toMatch(/deps-chip deps-chip--danger deps-chip--active[^>]*>Vulnerables 1/);
  });

  it("el chip del estado filtrado queda activo", () => {
    useDependenciesExplorerStore.setState({ status: "major" });

    expect(html(<DependencySummary summary={report.summary} />)).toMatch(/deps-chip deps-chip--active[^>]*>[^<]*Major 2/);
  });
});

describe("DependencyList", () => {
  it("agrupa por estado con la version a la que ir, antiguedad y siguiente paso", () => {
    const markup = html(<DependencyList dependencies={report.dependencies} now={NOW} />);

    expect(markup.indexOf("Abandonado · 1")).toBeLessThan(markup.indexOf("Deprecated · 1"));
    expect(markup.indexOf("Deprecated · 1")).toBeLessThan(markup.indexOf("Major · 2"));
    expect(markup).toContain("16.14.0 → 19.3.0");
    expect(markup).toMatch(/deps-badge" style="background:#dc2626">2 vulns · Alta</);
    expect(markup).toContain('<span class="deps-tag deps-tag--eol">sin soporte</span>');
    expect(markup).toMatch(/lodash<\/span><span class="deps-tag deps-tag--eco">npm<\/span><span class="deps-tag deps-tag--unused">sin uso<\/span>/);
    expect(markup.match(/deps-tag--unused/g)).toHaveLength(1);
    expect(markup).toMatch(/phpoffice\/phpexcel<\/span><span class="deps-tag deps-tag--eco">composer<\/span><span class="deps-tag deps-tag--vendored">copiada<\/span>/);
    expect(markup.match(/deps-tag--vendored/g)).toHaveLength(1);
    expect(markup).toContain("Vulnerable (Alta): actualizar a 19.3.0");
    expect(markup).toContain("hace 5 años");
    expect(markup).toContain("Actualizar a 29.7.0 (la 30.5.2 requiere un runtime mas nuevo)");
    expect(markup).toContain("Abandonado: reemplazar por phpoffice/phpspreadsheet");
    expect(markup).toMatch(/jest<\/span><span class="deps-tag">dev<\/span>/);
    expect(markup).toContain(">2.88.2<");
  });

  it("respeta los filtros del store y avisa si no hay coincidencias", () => {
    useDependenciesExplorerStore.setState({ hideDev: true, query: "re" });
    const markup = html(<DependencyList dependencies={report.dependencies} now={NOW} />);

    expect(markup).toContain("request");
    expect(markup).toContain("react");
    expect(markup).not.toContain("jest");

    useDependenciesExplorerStore.setState({ query: "zzz" });
    expect(html(<DependencyList dependencies={report.dependencies} now={NOW} />)).toContain("Ningun paquete coincide con los filtros");
  });
});

describe("DependencyDrawer", () => {
  it("cerrado sin seleccion; abierto muestra detalle y link al registro", () => {
    expect(html(<DependencyDrawer report={report} now={NOW} />)).toBe("");

    useDependenciesExplorerStore.setState({ selected: "composer:phpoffice/phpexcel" });
    const markup = html(<DependencyDrawer report={report} now={NOW} />);

    expect(markup).toContain("phpoffice/phpexcel");
    expect(markup).toContain("<dt>Copia en</dt><dd>xls/Classes/PHPExcel.php</dd>");
    expect(markup).toContain("<dt>Copias</dt><dd>2 archivos</dd>");
    expect(markup).not.toContain("<dt>Manifiesto</dt>");
    expect(markup).toContain('href="https://packagist.org/packages/phpoffice/phpexcel"');

    useDependenciesExplorerStore.setState({ selected: "npm:react" });
    const react = html(<DependencyDrawer report={report} now={NOW} />);
    expect(react).toContain('href="https://www.npmjs.com/package/react"');
    expect(react).toContain("<dt>Manifiesto</dt>");
    expect(react).not.toContain("<dt>Copias</dt>");
    expect(react).toContain("hace 5 años");
    expect(react).toContain("react 16 · sin soporte");
    expect(react).toContain("CVE-9");
    expect(react).toContain("XSS en render");
    expect(react).toContain("corregida en 16.14.1");
    expect(react).toContain("GHSA-s");
    expect(react).toContain("sin version corregida");
    expect(react).toContain('href="https://osv.dev/vulnerability/GHSA-r"');
    expect(react).toContain("OSV: timeout");
    expect(react).not.toContain("<dt>Uso</dt>");

    useDependenciesExplorerStore.setState({ selected: "npm:lodash" });
    const lodash = html(<DependencyDrawer report={{ ...report, dependencies: [...report.dependencies, entry({ name: "react-dom", group: "react" })] }} now={NOW} />);
    expect(lodash).toContain("<dt>Uso</dt><dd>sin uso</dd>");
    expect(lodash).toContain("<dt>Actualizar junto con</dt><dd>react-dom</dd>");
  });

  it("muestra el error de consulta y si son datos viejos", () => {
    const stale = { ...report, dependencies: [entry({ name: "x", lookupError: "timeout", stale: true })] };
    useDependenciesExplorerStore.setState({ selected: "npm:x" });

    expect(html(<DependencyDrawer report={stale} now={NOW} />)).toContain("timeout (datos de cache viejos)");
  });
});

describe("DependencyFilters", () => {
  it("buscador y casilla reflejan el store", () => {
    expect(html(<DependencyFilters />)).toMatch(/<input class="deps-filters__search"[^>]*value=""/);

    useDependenciesExplorerStore.setState({ query: "react", hideDev: true });
    const markup = html(<DependencyFilters />);

    expect(markup).toMatch(/<input class="deps-filters__search"[^>]*value="react"/);
    expect(markup).toMatch(/<input type="checkbox" checked=""\/>Ocultar dev/);
  });
});

describe("DependencyVulnerabilities", () => {
  it("lista cada vulnerabilidad con severidad, correccion y link a OSV; sin nada no renderiza", () => {
    const security = { vulnerabilities: [vuln({ id: "GHSA-a", cve: null, severity: "critical", fixedIn: null })], maxSeverity: "critical" as const, recommendedAffected: false };
    const markup = html(<DependencyVulnerabilities security={security} advisoryError={null} />);

    expect(markup).toContain("<strong>GHSA-a</strong>");
    expect(markup).toMatch(/color:#991b1b">Critica</);
    expect(markup).toContain("sin version corregida");
    expect(markup).not.toContain("OSV:");
    expect(html(<DependencyVulnerabilities security={{ vulnerabilities: [], maxSeverity: null, recommendedAffected: false }} advisoryError={null} />)).toBe("");
    expect(html(<DependencyVulnerabilities security={{ vulnerabilities: [], maxSeverity: null, recommendedAffected: false }} advisoryError="caido" />)).toContain("OSV: caido");
  });
});

describe("DependenciesExplorer", () => {
  it("monta con estado de carga y boton Refrescar deshabilitado", () => {
    const provider = { getReport: async () => report };
    const markup = html(<DependenciesExplorer target="react" dependencies={{ dependenciesProvider: provider }} />);

    expect(markup).toContain("Dependencias");
    expect(markup).toContain("Consultando registros… (la primera vez puede tardar unos segundos)");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Consultando…<\/button>/);
  });
});
