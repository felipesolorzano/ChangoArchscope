import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlanGraph, PlanGraphNode, PlanTaskFindings } from "../../../../../modules/plan-explorer/domain/value-objects/PlanGraph";
import type { PlanExplorerDependencies } from "../../../../../modules/plan-explorer/infrastructure/factory/createPlanExplorerDependencies";
import { PlanCanvas } from "../../../../../modules/plan-explorer/presentation/components/PlanCanvas";
import { PlanFindingsDrawer, findingsCountLabel } from "../../../../../modules/plan-explorer/presentation/components/PlanFindingsDrawer";
import { PlanTaskCard } from "../../../../../modules/plan-explorer/presentation/components/PlanTaskCard";
import PlanExplorer from "../../../../../modules/plan-explorer/presentation/pages/PlanExplorer";

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

  it("un boton por estado con el actual activo", () => {
    const markup = card(task({ state: "done" }));

    for (const label of ["Pendiente", "En progreso", "Hecho", "Bloqueado"]) expect(markup).toContain(label);
    expect(markup.match(/plan-task__state--active/g)).toHaveLength(1);
    expect(markup).toMatch(/plan-task__state--active"[^>]*>Hecho</);
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
