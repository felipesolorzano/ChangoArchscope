import type { AuditGraphNode, AuditGraphView } from "../../domain/value-objects/AuditGraph";

export interface AuditDrillTarget {
  view: AuditGraphView;
  focus: string;
}

export interface AuditCrumb {
  label: string;
  view: AuditGraphView;
  focus: string | null;
  current: boolean;
}

// Decide a donde profundizar al hacer click en un nodo:
// - overview + nodo app -> vista app de esa app.
// - app + nodo file -> vista file de ese archivo (focus = ruta relativa, el id sin "file:").
// En cualquier otro caso, no se profundiza.
export function drillTargetFor(
  node: Pick<AuditGraphNode, "id" | "type" | "label">,
  view: AuditGraphView,
): AuditDrillTarget | null {
  if (view === "overview" && node.type === "app") {
    return { view: "app", focus: node.label };
  }

  // Desde app o desde el heatmap, un nodo file abre su vista de reglas.
  if ((view === "app" || view === "heatmap") && node.type === "file") {
    return { view: "file", focus: node.id.replace(/^file:/, "") };
  }

  return null;
}

// Construye el rastro de navegacion (breadcrumb) a partir de la vista y el foco actuales.
export function breadcrumbFor(view: AuditGraphView, focus: string | null): AuditCrumb[] {
  if (view === "heatmap") {
    return [{ label: "Heatmap", view: "heatmap", focus: null, current: true }];
  }

  const root: AuditCrumb = { label: "Monorepo", view: "overview", focus: null, current: view === "overview" };

  if (view === "overview" || focus === null) {
    return [root];
  }

  if (view === "app") {
    return [{ ...root, current: false }, { label: focus, view: "app", focus, current: true }];
  }

  const segments = focus.split("/");
  const app = segments[0];
  const fileName = segments[segments.length - 1];

  return [
    { ...root, current: false },
    { label: app, view: "app", focus: app, current: false },
    { label: fileName, view: "file", focus, current: true },
  ];
}
