import { ReactFlowProvider } from "@xyflow/react";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { copyText } from "../../../../../modules/plan-explorer/infrastructure/browser/copyText";

import type { PlanGraph, PlanGraphNode, PlanTaskFindings } from "../../../../../modules/plan-explorer/domain/value-objects/PlanGraph";
import { CharacterizationDrawer } from "../../../../../modules/plan-explorer/presentation/components/CharacterizationDrawer";
import { CharacterizationList } from "../../../../../modules/plan-explorer/presentation/components/CharacterizationList";
import { CodemodDrawer } from "../../../../../modules/plan-explorer/presentation/components/CodemodDrawer";
import { CodemodList } from "../../../../../modules/plan-explorer/presentation/components/CodemodList";
import { usePlanDrawerStore } from "../../../../../modules/plan-explorer/presentation/store/planDrawerStore";
import { PhaseDrawer } from "../../../../../modules/plan-explorer/presentation/components/PhaseDrawer";
import { PhaseIndicator } from "../../../../../modules/plan-explorer/presentation/components/PhaseIndicator";
import { PhaseList } from "../../../../../modules/plan-explorer/presentation/components/PhaseList";
import { PlanLaneHeader } from "../../../../../modules/plan-explorer/presentation/components/PlanLaneHeader";
import { ProtectionStrip } from "../../../../../modules/plan-explorer/presentation/components/ProtectionStrip";
import type { PlanExplorerDependencies } from "../../../../../modules/plan-explorer/infrastructure/factory/createPlanExplorerDependencies";
import { PlanCanvas } from "../../../../../modules/plan-explorer/presentation/components/PlanCanvas";
import { PlanFindingsDrawer, findingsCountLabel } from "../../../../../modules/plan-explorer/presentation/components/PlanFindingsDrawer";
import { PlanTaskCard } from "../../../../../modules/plan-explorer/presentation/components/PlanTaskCard";
import { stateColor } from "../../../../../modules/plan-explorer/presentation/constants/planView";
import PlanExplorer from "../../../../../modules/plan-explorer/presentation/pages/PlanExplorer";

vi.mock("../../../../../modules/plan-explorer/infrastructure/browser/copyText", () => ({ copyText: vi.fn() }));

const task = (over: Partial<PlanGraphNode> = {}): PlanGraphNode => ({
  id: "remove-jquery",
  title: "Sacar jQuery",
  description: "Reemplazar $(...)",
  category: "coupling",
  state: "in_progress",
  metric: 120,
  stage: 1,
  position: { x: 0, y: 0 },
  ...over,
});
const graph: PlanGraph = { generated_at: "t", summary: { tasks: 1, by_state: { in_progress: 1 } }, nodes: [task()], edges: [] };
const findings = (total: number, count: number): PlanTaskFindings => ({
  taskKey: "remove-jquery",
  total,
  items: Array.from({ length: count }, (_, index) => ({
    file: `/src/a/File${index}.js`,
    line: index,
    rule: "jquery-usage",
    severity: "medium",
    message: `msg ${index}`,
  })),
});
const html = (element: JSX.Element) => renderToStaticMarkup(element);
const noop = () => {};

describe("PlanCanvas", () => {
  const base = { loading: false, error: null, empty: false, nodes: [], edges: [], onInit: noop };

  it("muestra carga, error y vacio", () => {
    expect(html(<PlanCanvas {...base} loading />)).toContain("Cargando plan de remediacion...");
    expect(html(<PlanCanvas {...base} error="se cayo" />)).toContain("se cayo");
    expect(html(<PlanCanvas {...base} empty />)).toContain("Sin tareas: la auditoria no encontro deuda accionable.");
  });

  it("sin tareas muestra el checklist auditado", () => {
    const checks = [
      { category: "security", label: "Seguridad", findings: 0 },
      { category: "testing", label: "Tests", findings: 2 },
    ];
    const markup = html(<PlanCanvas {...base} empty checks={checks} />);

    expect(markup).toMatch(/plan-check--ok[^>]*>.*Seguridad/);
    expect(markup).toMatch(/plan-check--bad[^>]*>.*Tests/);
    expect(markup).toContain(">2<");
  });

  it("con tareas renderiza el lienzo de React Flow", () => {
    const markup = html(<PlanCanvas {...base} />);

    expect(markup).toContain("react-flow");
    expect(markup).not.toContain("Cargando");
  });
});

describe("PlanFindingsDrawer", () => {
  const base = { graph, focusedTaskKey: "remove-jquery", findings: null, loading: false, onClose: noop };

  it("sin tarea enfocada no renderiza nada", () => {
    expect(html(<PlanFindingsDrawer {...base} focusedTaskKey={null} />)).toBe("");
  });

  it("titulo de la tarea, o su clave si no esta en el grafo", () => {
    expect(html(<PlanFindingsDrawer {...base} />)).toContain("Sacar jQuery");
    expect(html(<PlanFindingsDrawer {...base} focusedTaskKey="otra" />)).toContain("otra");
  });

  it("carga y vacio", () => {
    expect(html(<PlanFindingsDrawer {...base} loading />)).toContain("Cargando hallazgos...");
    expect(html(<PlanFindingsDrawer {...base} findings={findings(0, 0)} />)).toContain("Esta tarea no tiene hallazgos concretos asociados.");
  });

  it("lista severidad, archivo sin carpetas, :linea solo si es > 0 y mensaje", () => {
    const markup = html(<PlanFindingsDrawer {...base} findings={findings(2, 2)} />);

    expect(markup).toContain("2 hallazgos");
    expect(markup).toContain("File0.js");
    expect(markup).not.toContain("/src/a/File0.js<");
    expect(markup).not.toContain(":0<");
    expect(markup).toContain(":1<");
    expect(markup).toContain("msg 1");
    expect(markup).toContain("plan-drawer__sev--medium");
  });

  it("findingsCountLabel resume cuando hay mas de los listados", () => {
    expect(findingsCountLabel(findings(1500, 100))).toBe("Mostrando 100 de 1,500");
    expect(findingsCountLabel(findings(3, 3))).toBe("3 hallazgos");
  });
});

describe("PlanTaskCard", () => {
  const card = (data: PlanGraphNode) =>
    html(
      <ReactFlowProvider>
        <PlanTaskCard {...({ id: data.id, data } as never)} />
      </ReactFlowProvider>,
    );

  it("muestra categoria, titulo, descripcion, metrica y link a hallazgos", () => {
    const markup = card(task());

    expect(markup).toContain("coupling");
    expect(markup).toContain("Sacar jQuery");
    expect(markup).toContain("Reemplazar $(...)");
    expect(markup).toContain("120");
    expect(markup).toContain("Ver hallazgos →");
  });

  it("sin metrica no muestra numero ni link", () => {
    const markup = card(task({ metric: 0 }));

    expect(markup).not.toContain("plan-task__metric");
    expect(markup).not.toContain("Ver hallazgos");
  });

  it("siguiente paso: resaltada con su marca (XRay X6)", () => {
    const markup = card(task({ next: true }));

    expect(markup).toContain('class="plan-task plan-task--next"');
    expect(markup).toContain('<span class="plan-task__next">▶ Siguiente paso</span>');
    expect(card(task())).not.toContain("Siguiente paso");
  });

  it("bloqueada: motivo y sin en progreso ni hecho (XRay X6)", () => {
    const markup = card(task({ lockReason: "Espera a: Tests" }));

    expect(markup).toContain('class="plan-task plan-task--locked"');
    expect(markup).toContain("🔒 Espera a: Tests");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*title="Espera a: Tests"[^>]*>En progreso</);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*title="Espera a: Tests"[^>]*>Hecho</);
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(card(task())).not.toContain("plan-task--locked");
    expect(card(task())).not.toContain("disabled");
    expect(card(task())).not.toContain("🔒");
  });

  it("un boton por estado con el actual activo", () => {
    const markup = card(task({ state: "done" }));

    for (const label of ["Pendiente", "En progreso", "Hecho", "Bloqueado"]) expect(markup).toContain(label);
    expect(markup.match(/plan-task__state--active/g)).toHaveLength(1);
    expect(markup).toMatch(/plan-task__state--active"[^>]*>Hecho</);
    const done = stateColor("done");
    expect(markup).toContain(`<div class="plan-task" style="border-color:${done}">`);
    expect(markup).toContain(`<button type="button" class="plan-task__state plan-task__state--active" style="background:${done};border-color:${done}">Hecho</button>`);
    expect(markup).toContain('<button type="button" class="plan-task__state">Pendiente</button>');
  });
});

describe("PlanExplorer", () => {
  it("encabezado, progreso por estado y estado de carga inicial", () => {
    const dependencies: PlanExplorerDependencies = {
      planProvider: {
        getPlan: () => new Promise(() => {}),
        setTaskState: () => new Promise(() => {}),
        getTaskFindings: () => new Promise(() => {}),
      },
    };
    const markup = html(<PlanExplorer dependencies={dependencies} target="react" />);

    expect(markup).toContain("Plan de remediacion");
    expect(markup).toContain("0 tareas derivadas de la auditoria");
    for (const label of ["Pendiente", "En progreso", "Hecho", "Bloqueado"]) expect(markup).toContain(`${label}: <strong>0</strong>`);
    expect(markup).toContain("Cargando plan de remediacion...");
  });
});

describe("ProtectionStrip", () => {
  const protection = {
    root: "/p",
    tests: { testFiles: 0, sourceFiles: 269 },
    coverage: null,
    mutation: null,
    e2e: null,
    level: "none" as const,
  };

  it("sin datos no renderiza; con nivel none muestra la ayuda", () => {
    expect(renderToStaticMarkup(<ProtectionStrip protection={null} />)).toBe("");

    const markup = renderToStaticMarkup(<ProtectionStrip protection={protection} />);
    expect(markup).toMatch(/Red de seguridad: <strong style="color:#dc2626">Ninguna<\/strong>/);
    expect(markup).toContain("0 archivos de test · 269 fuente");
    expect(markup).toContain("Cobertura: sin reporte");
    expect(markup).toContain("Sin red de seguridad: empezar por tests de caracterizacion");
    expect(markup).toMatch(/<button[^>]*class="plan-protection__action"[^>]*>Que proteger primero<\/button>/);
    expect(markup).toMatch(/<button[^>]*class="plan-protection__action"[^>]*>Codemods<\/button>/);
  });

  it("con nivel distinto de none no muestra la ayuda", () => {
    expect(renderToStaticMarkup(<ProtectionStrip protection={{ ...protection, level: "medium" }} />)).not.toContain("Sin red de seguridad");
  });
});

describe("CharacterizationList", () => {
  const plan = {
    targets: [
      {
        file: "pages/page.checkout.js",
        kind: "page" as const,
        score: 80,
        risk: 80,
        importers: 3,
        untested: [{ name: "PageCheckout", complexity: 40 }],
        endpoints: ["DoPayment"],
        skeletons: [
          { kind: "rtl" as const, path: "pages/__characterization__/page.checkout.characterization.test.jsx", content: "x" },
          { kind: "msw" as const, path: "pages/__characterization__/page.checkout.handlers.js", content: "y" },
        ],
      },
    ],
  };

  it("un item por objetivo con razones y un boton por esqueleto", () => {
    const markup = renderToStaticMarkup(<CharacterizationList plan={plan} />);

    expect(markup).toContain("pages/page.checkout.js");
    expect(markup).toContain("Pagina");
    expect(markup).toContain("80");
    expect(markup).toContain("riesgo 80 · importado por 3 · 1 sin test: PageCheckout · 1 endpoint");
    expect(markup).toMatch(/<button[^>]*title="pages\/__characterization__\/page.checkout.characterization.test.jsx"[^>]*>Test RTL<\/button>/);
    expect(markup).toContain(">Handlers MSW<");
  });

  it("sin objetivos lo dice", () => {
    expect(renderToStaticMarkup(<CharacterizationList plan={{ targets: [] }} />)).toContain("No hay objetivos: todo lo riesgoso ya tiene evidencia de test");
  });
});

describe("CharacterizationDrawer", () => {
  const provider = { getCharacterization: () => new Promise(() => {}) } as never;

  it("cerrado no renderiza; abierto muestra la carga y el boton Cerrar", () => {
    usePlanDrawerStore.setState({ drawer: "codemods" });
    expect(renderToStaticMarkup(<CharacterizationDrawer provider={provider} target="react" />)).toBe("");

    usePlanDrawerStore.setState({ drawer: "characterization" });
    const markup = renderToStaticMarkup(<CharacterizationDrawer provider={provider} target="react" />);
    expect(markup).toContain("Que proteger primero");
    expect(markup).toContain("Calculando objetivos…");
    expect(markup).toContain(">Cerrar<");
    usePlanDrawerStore.setState({ drawer: null });
  });
});

describe("CodemodList (XRay X5)", () => {
  const automatic = {
    pattern: "unsafe-lifecycles",
    title: "Lifecycles deprecados",
    tool: "react-codemod",
    command: 'npx react-codemod rename-unsafe-lifecycles "a.js" "b.js"',
    note: "Solo renombra a UNSAFE_*",
    timing: "before-upgrade" as const,
    files: [
      { file: "a.js", occurrences: 3, testedBy: ["a.test.js", "a.spec.js"] },
      { file: "b.js", occurrences: 1, testedBy: [] },
    ],
    occurrences: 4,
    protectedFiles: 1,
  };
  const manual = { ...automatic, pattern: "money-format", title: "money_format", tool: null, command: null, note: "", timing: "after-upgrade" as const, files: [{ file: "c.php", occurrences: 2, testedBy: ["CTest.php"] }], occurrences: 2, protectedFiles: 1 };

  it("titulo, herramienta, resumen, aviso, nota, comando con Copiar y archivos", () => {
    const markup = renderToStaticMarkup(<CodemodList plan={{ candidates: [automatic, manual] }} />);

    expect(markup).toContain("Lifecycles deprecados");
    expect(markup).toContain("Automatico · react-codemod");
    expect(markup).toContain('<span class="plan-codemods__timing plan-codemods__timing--before-upgrade">Antes de actualizar</span>');
    expect(markup).toContain('<span class="plan-codemods__timing plan-codemods__timing--after-upgrade">Despues de actualizar</span>');
    expect(markup).toContain("2 archivos · 4 ocurrencias · 1/2 con tests");
    expect(markup).toContain("Caracterizar antes: 1 archivo sin tests");
    expect(markup).toContain("Solo renombra a UNSAFE_*");
    expect(markup).toContain("<code>npx react-codemod rename-unsafe-lifecycles &quot;a.js&quot; &quot;b.js&quot;</code>");
    expect(markup.match(/>Copiar<\/button>/g)).toHaveLength(1);
    expect(markup).toContain("<summary>Archivos</summary>");
    expect(markup).toMatch(/a\.js<\/span><span[^>]*>3<\/span><span class="plan-codemods__tested" title="a\.test\.js, a\.spec\.js">con tests<\/span>/);
    expect(markup).toMatch(/b\.js<\/span><span[^>]*>1<\/span><span class="plan-codemods__untested" title="">sin tests<\/span>/);
    expect(markup).toContain("Manual");
  });

  it("un candidato manual con todo cubierto no muestra aviso, nota ni comando", () => {
    const markup = renderToStaticMarkup(<CodemodList plan={{ candidates: [manual] }} />);

    expect(markup).not.toContain("plan-codemods__warning");
    expect(markup).not.toContain("<code>");
    expect(markup).not.toContain("plan-codemods__note");
  });

  it("Copiar copia el comando del candidato", () => {
    const copy = vi.mocked(copyText);
    copy.mockClear();
    const buttons: Array<{ props: { onClick?: () => void; children?: unknown } }> = [];
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!isValidElement(node)) return;
      // Los subcomponentes de la lista no usan hooks: se expanden llamandolos.
      if (typeof node.type === "function") return collect((node.type as (props: unknown) => unknown)(node.props));
      if (node.type === "button") buttons.push(node as never);
      collect((node.props as { children?: unknown }).children);
    };
    collect(CodemodList({ plan: { candidates: [automatic, manual] } }));

    buttons.find((button) => button.props.children === "Copiar")!.props.onClick!();
    expect(copy).toHaveBeenCalledWith('npx react-codemod rename-unsafe-lifecycles "a.js" "b.js"');
  });

  it("sin candidatos lo dice", () => {
    expect(renderToStaticMarkup(<CodemodList plan={{ candidates: [] }} />)).toContain("No hay APIs legacy con reemplazo conocido");
  });
});

describe("CodemodDrawer (XRay X5)", () => {
  const provider = { getCodemods: () => new Promise(() => {}) } as never;

  it("solo con el panel codemods: carga y boton Cerrar", () => {
    usePlanDrawerStore.setState({ drawer: "characterization" });
    expect(renderToStaticMarkup(<CodemodDrawer provider={provider} target="react" />)).toBe("");

    usePlanDrawerStore.setState({ drawer: "codemods" });
    const markup = renderToStaticMarkup(<CodemodDrawer provider={provider} target="react" />);
    expect(markup).toContain("Candidatos a codemod");
    expect(markup).toContain("Buscando APIs legacy…");
    expect(markup).toContain(">Cerrar<");
    usePlanDrawerStore.setState({ drawer: null });
  });
});


describe("Fases (XRay X6)", () => {
  const passed = { number: 0, key: "baseline", title: "Linea base", goal: "Todo se analiza", status: "passed" as const, current: false, tasks: [], gates: [{ key: "parse-errors", label: "Archivos que no parsean", value: 0, target: 0, comparator: "max" as const, format: "count" as const, status: "passed" as const }] };
  const current = {
    number: 1,
    key: "security",
    title: "Seguridad",
    goal: "Sin inyecciones",
    status: "failed" as const,
    current: true,
    tasks: ["close-xss-sinks", "fix-vulnerable-packages"],
    gates: [
      { key: "xss-sinks", label: "Sinks XSS", value: 113, target: 0, comparator: "max" as const, format: "count" as const, status: "failed" as const },
      { key: "vulnerable-packages", label: "Paquetes vulnerables", value: null, target: 0, comparator: "max" as const, format: "count" as const, status: "unknown" as const },
    ],
  };
  const skipped = { ...passed, number: 7, key: "decoupling", title: "Desacople", status: "not-applicable" as const, gates: [] };

  it("PhaseIndicator: fase actual, todo cumplido o nada; boton Fases", () => {
    expect(renderToStaticMarkup(<PhaseIndicator phases={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<PhaseIndicator phases={[]} />)).toBe("");

    const markup = renderToStaticMarkup(<PhaseIndicator phases={[passed, current]} />);
    expect(markup).toContain("Fase 1 · Seguridad");
    expect(markup).toMatch(/<button[^>]*class="plan-protection__action"[^>]*>Fases<\/button>/);
    expect(renderToStaticMarkup(<PhaseIndicator phases={[passed]} />)).toContain("Todas las fases cumplidas");
    expect(markup).not.toContain("Siguiente:");
    const withNext = renderToStaticMarkup(<PhaseIndicator phases={[passed, current]} next={{ ...task(), title: "Eliminar copias manuales" }} />);
    expect(withNext).toContain('<button type="button" class="plan-phases__next">Siguiente: Eliminar copias manuales</button>');
    expect(renderToStaticMarkup(<PhaseIndicator phases={[]} next={task()} />)).toBe("");
  });

  it("PhaseList: estado, meta, gates con valor y objetivo, tareas por titulo; la actual marcada", () => {
    const markup = renderToStaticMarkup(<PhaseList phases={[passed, current, skipped]} taskTitles={{ "close-xss-sinks": "Cerrar vectores de XSS" }} />);

    expect(markup).toContain("0. Linea base");
    expect(markup).toMatch(/style="color:#16a34a">Cumplida</);
    expect(markup).toMatch(/style="color:#dc2626">Pendiente</);
    expect(markup).toMatch(/style="color:#475569">No aplica</);
    expect(markup).toContain("Sin inyecciones");
    expect(markup).toContain("✓ Archivos que no parsean: 0 (meta ≤ 0)");
    expect(markup).toContain("✗ Sinks XSS: 113 (meta ≤ 0)");
    expect(markup).toContain("? Paquetes vulnerables: sin datos (meta ≤ 0)");
    expect(markup).toContain("Tareas: Cerrar vectores de XSS · fix-vulnerable-packages");
    expect(markup.match(/plan-phases__item--current/g)).toHaveLength(1);
    expect(markup).toMatch(/plan-phases__item plan-phases__item--current[^>]*>[\s\S]*1\. Seguridad/);
    expect(markup.match(/Tareas:/g)).toHaveLength(1);
    expect(markup.match(/class="plan-phases__item"/g)).toHaveLength(2);
    expect(markup).toContain('<span class="plan-phases__gate plan-phases__gate--failed">✗ Sinks XSS');
  });

  it("PhaseDrawer: solo con el panel phases; sin fases, cargando", () => {
    const graph = { generated_at: "", summary: { tasks: 1, by_state: {} }, nodes: [{ ...task(), id: "close-xss-sinks", title: "Cerrar vectores de XSS" }], edges: [], phases: [current] };

    usePlanDrawerStore.setState({ drawer: "codemods" });
    expect(renderToStaticMarkup(<PhaseDrawer graph={graph} />)).toBe("");

    usePlanDrawerStore.setState({ drawer: "phases" });
    const markup = renderToStaticMarkup(<PhaseDrawer graph={graph} />);
    expect(markup).toContain("Fases y quality gates");
    expect(markup).toContain(">Cerrar<");
    expect(markup).toContain("Tareas: Cerrar vectores de XSS · fix-vulnerable-packages");
    expect(renderToStaticMarkup(<PhaseDrawer graph={null} />)).toContain("Calculando fases…");
    expect(renderToStaticMarkup(<PhaseDrawer graph={{ ...graph, phases: undefined }} />)).toContain("Calculando fases…");
    usePlanDrawerStore.setState({ drawer: null });
  });
});

describe("PlanLaneHeader (XRay X6)", () => {
  const props = (data: object) => ({ data }) as never;

  it("fase, titulo y estado; la actual marcada", () => {
    const markup = renderToStaticMarkup(<PlanLaneHeader {...props({ phase: 3, title: "Seguridad del codigo", status: "failed", current: true, x: 0 })} />);

    expect(markup).toContain('class="plan-lane plan-lane--current"');
    expect(markup).toContain("Fase 3");
    expect(markup).toContain("Seguridad del codigo");
    expect(markup).toMatch(/style="color:#dc2626">Pendiente</);
    expect(renderToStaticMarkup(<PlanLaneHeader {...props({ phase: 0, title: "Linea base", status: "passed", current: false, x: 0 })} />)).toContain('class="plan-lane"');
  });
});
