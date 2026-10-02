import { Fragment, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { NodeMouseHandler } from "@xyflow/react";
import { ChevronRight, RefreshCw } from "lucide-react";

import type { AuditExplorerDependencies } from "../../infrastructure/factory/createAuditExplorerDependencies";
import type { AuditGraph, AuditGraphNode, AuditGraphView } from "../../domain/value-objects/AuditGraph";
import { toFlowEdges, toFlowNodes } from "../../infrastructure/react-flow/auditFlowAdapter";
import { AuditCanvas } from "../components/AuditCanvas";
import { AuditDetailDrawer } from "../components/AuditDetailDrawer";
import { AuditFilters } from "../components/AuditFilters";
import { AuditLegend } from "../components/AuditLegend";
import { useAuditGraphController, type AuditTarget } from "../hooks/useAuditGraphController";
import { useAuditExplorerStore } from "../store/auditExplorerStore";
import { breadcrumbFor, drillTargetFor } from "../utils/auditNavigation";
import { filterGraphByCategory, type CategoryFilter } from "../utils/auditNodeFilter";

import "./auditExplorer.css";

interface AuditExplorerProps {
  dependencies: AuditExplorerDependencies;
  target: AuditTarget;
}

type GoTo = (view: AuditGraphView, focus: string | null) => void;

const UNIT_BY_VIEW = { overview: "apps", heatmap: "archivos", app: "archivos", file: "reglas" } as const;

// "N hallazgos · risk R · K <unidad>": K = nodos sin la raiz (el heatmap no tiene raiz).
export function summaryText(graph: AuditGraph, view: AuditGraphView): string {
  const count = view === "heatmap" ? graph.summary.nodes : graph.summary.nodes - 1;
  const hint = view === "file" ? "" : " · click en un nodo para profundizar";

  return `${graph.summary.findings.toLocaleString("en-US")} hallazgos · risk ${graph.summary.risk.toLocaleString("en-US")} · ${count} ${UNIT_BY_VIEW[view]}${hint}`;
}

export default function AuditExplorer({ dependencies, target }: AuditExplorerProps) {
  const { graph, view, focus, phpVersion, loading, error, goTo, setPhpVersion } = useAuditGraphController(dependencies, target);
  const { focusedNodeId, clearFocus } = useAuditExplorerStore();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const { flowNodes, flowEdges } = useFilteredFlow(graph, category);
  const { navigate, handleNodeClick } = useNodeNavigation(view, goTo);

  return (
    <main className="audit-explorer">
      <header className="audit-explorer__bar">
        <div>
          <AuditBreadcrumb view={view} focus={focus} onNavigate={navigate} />
          {graph && <p className="audit-explorer__sub">{summaryText(graph, view)}</p>}
        </div>

        <div className="audit-explorer__right">
          <RefreshButton loading={loading} onRefresh={() => goTo(view, focus)} />
          <AuditFilters target={target} phpVersion={phpVersion} onPhpVersionChange={setPhpVersion} category={category} onCategoryChange={setCategory} />
          <AuditViewToggle view={view} onNavigate={goTo} />
          <AuditLegend target={target} />
        </div>
      </header>

      <AuditCanvas
        key={`${view}:${focus ?? ""}`}
        loading={loading}
        error={error}
        nodes={flowNodes}
        edges={flowEdges}
        onInit={(instance) => instance.fitView({ padding: 0.25 })}
        onNodeClick={handleNodeClick}
      />

      <AuditDetailDrawer graph={graph} focusedNodeId={focusedNodeId} onClose={clearFocus} />
    </main>
  );
}

// Navegar limpia el foco; un click en un nodo lo enfoca y, si tiene nivel mas profundo, entra.
function useNodeNavigation(view: AuditGraphView, goTo: GoTo) {
  const { setFocusedNodeId, clearFocus } = useAuditExplorerStore();

  const navigate: GoTo = (nextView, nextFocus) => {
    clearFocus();
    goTo(nextView, nextFocus);
  };

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setFocusedNodeId(node.id);
    const drill = drillTargetFor(node.data as AuditGraphNode, view);
    if (drill) {
      navigate(drill.view, drill.focus);
    }
  };

  return { navigate, handleNodeClick };
}

// Grafo filtrado por categoria y adaptado a nodos/edges de React Flow.
function useFilteredFlow(graph: AuditGraph | null, category: CategoryFilter) {
  const filtered = useMemo(() => filterGraphByCategory(graph?.nodes ?? [], graph?.edges ?? [], category), [graph, category]);
  const flowNodes = useMemo(() => toFlowNodes(filtered.nodes), [filtered]);
  const flowEdges = useMemo(() => toFlowEdges(filtered.edges), [filtered]);

  return { flowNodes, flowEdges };
}

function AuditBreadcrumb({ view, focus, onNavigate }: { view: AuditGraphView; focus: string | null; onNavigate: GoTo }) {
  return (
    <nav className="audit-breadcrumb">
      {breadcrumbFor(view, focus).map((crumb, index) => (
        <Fragment key={`${crumb.view}:${crumb.focus ?? ""}`}>
          {index > 0 && <ChevronRight size={14} className="audit-breadcrumb__sep" />}
          {crumb.current ? (
            <span className="audit-breadcrumb__crumb audit-breadcrumb__crumb--current">{crumb.label}</span>
          ) : (
            <button type="button" className="audit-breadcrumb__crumb audit-breadcrumb__link" onClick={() => onNavigate(crumb.view, crumb.focus)}>
              {crumb.label}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

function RefreshButton({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <button
      type="button"
      className="audit-refresh"
      onClick={onRefresh}
      disabled={loading}
      title="Re-escanea el repo y recarga la vista actual (refleja tus ediciones)"
    >
      <RefreshCw size={14} className={loading ? "audit-refresh__icon audit-refresh__icon--spin" : "audit-refresh__icon"} />
      {loading ? "Escaneando…" : "Refrescar"}
    </button>
  );
}

// Solo en las vistas globales: alternar entre el mapa por apps y el heatmap.
function AuditViewToggle({ view, onNavigate }: { view: AuditGraphView; onNavigate: GoTo }) {
  if (view !== "overview" && view !== "heatmap") {
    return null;
  }

  const option = (target: "overview" | "heatmap", label: string) => (
    <button
      type="button"
      className={`audit-viewtoggle__btn${view === target ? " audit-viewtoggle__btn--active" : ""}`}
      onClick={() => onNavigate(target, null)}
    >
      {label}
    </button>
  );

  return (
    <div className="audit-viewtoggle">
      {option("overview", "Mapa por apps")}
      {option("heatmap", "Heatmap global")}
    </div>
  );
}
