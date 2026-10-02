import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { DependencyReport } from "../../../../../modules/dependencies-explorer/domain/value-objects/DependencyReport";
import { DependencyFilters } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyFilters";
import { DependencyDrawer } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyDrawer";
import { DependencyList } from "../../../../../modules/dependencies-explorer/presentation/components/DependencyList";
import { DependencySummary } from "../../../../../modules/dependencies-explorer/presentation/components/DependencySummary";
import { RuntimeSelector } from "../../../../../modules/dependencies-explorer/presentation/components/RuntimeSelector";
import DependenciesExplorer from "../../../../../modules/dependencies-explorer/presentation/pages/DependenciesExplorer";
import { initialDependenciesExplorerState, useDependenciesExplorerStore } from "../../../../../modules/dependencies-explorer/presentation/store/dependenciesExplorerStore";
import { entry } from "../unit/fixtures";

const html = (element: JSX.Element) => renderToStaticMarkup(element);
const NOW = new Date("2026-10-02T12:00:00.000Z");

const report: DependencyReport = {
  generatedAt: NOW.toISOString(),
  root: "/p/src",
  manifests: ["/p/package.json"],
  skipped: [],
  runtimes: [{ kind: "node", version: "18.18.0", source: "package.json engines.node", selected: "18.18.0" }],
  dependencies: [
    entry({ name: "react", status: "major", current: "16.14.0", recommended: "19.3.0", latest: "19.3.0", currentPublishedAt: "2020-10-14T00:00:00.000Z" }),
    entry({ name: "jest", dev: true, status: "major", current: "24.9.0", recommended: "29.7.0", latest: "30.5.2", limitedByRuntime: true }),
    entry({ name: "request", status: "deprecated", deprecation: "request has been deprecated", recommended: null, latest: "2.88.2", current: "2.88.2" }),
    entry({ ecosystem: "composer", name: "phpoffice/phpexcel", manifest: "/p/composer.json", status: "abandoned", replacement: "phpoffice/phpspreadsheet" }),
    entry({ name: "lodash" }),
  ],
  summary: {
    total: 5,
    byStatus: { up_to_date: 1, patch: 0, minor: 0, major: 2, deprecated: 1, abandoned: 1, unknown: 0 },
    limitedByRuntime: 1,
    lookupErrors: 0,
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
    expect(markup).not.toContain("sin datos del registro");
    expect(markup).toMatch(/deps-summary__segment[^>]*background:#ea580c;width:40%/);
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
    expect(markup).toContain("../composer.json");
    expect(markup).toContain('href="https://packagist.org/packages/phpoffice/phpexcel"');

    useDependenciesExplorerStore.setState({ selected: "npm:react" });
    const react = html(<DependencyDrawer report={report} now={NOW} />);
    expect(react).toContain('href="https://www.npmjs.com/package/react"');
    expect(react).toContain("hace 5 años");
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

describe("DependenciesExplorer", () => {
  it("monta con estado de carga y boton Refrescar deshabilitado", () => {
    const provider = { getReport: async () => report };
    const markup = html(<DependenciesExplorer target="react" dependencies={{ dependenciesProvider: provider }} />);

    expect(markup).toContain("Dependencias");
    expect(markup).toContain("Consultando registros… (la primera vez puede tardar unos segundos)");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Consultando…<\/button>/);
  });
});
