import { Fragment, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import type { NodeMouseHandler } from "@xyflow/react";
import { ChevronRight } from "lucide-react";

import type { AuditExplorerDependencies } from "../../infrastructure/factory/createAuditExplorerDependencies";
import type { AuditGraphNode } from "../../domain/value-objects/AuditGraph";
import { toFlowEdges, toFlowNodes } from "../../infrastructure/react-flow/auditFlowAdapter";
import { AuditCanvas } from "../components/AuditCanvas";
import { AuditDetailDrawer } from "../components/AuditDetailDrawer";
import { AuditLegend } from "../components/AuditLegend";
import { useAuditGraphController } from "../hooks/useAuditGraphController";
import { useAuditExplorerStore } from "../store/auditExplorerStore";
import { breadcrumbFor, drillTargetFor } from "../utils/auditNavigation";

import "./auditExplorer.css";

interface AuditExplorerProps {
  dependencies: AuditExplorerDependencies;
}

const UNIT_BY_VIEW = { overview: "apps", heatmap: "archivos", app: "archivos", file: "reglas" } as const;

export default function AuditExplorer({ dependencies }: AuditExplorerProps) {
  const { graph, view, focus, loading, error, goTo } = useAuditGraphController(dependencies);
  const focusedNodeId = useAuditExplorerStore((state) => state.focusedNodeId);
  const setFocusedNodeId = useAuditExplorerStore((state) => state.setFocusedNodeId);
  const clearFocus = useAuditExplorerStore((state) => state.clearFocus);

  const flowNodes = useMemo(() => toFlowNodes(graph?.nodes ?? []), [graph]);
  const flowEdges = useMemo(() => toFlowEdges(graph?.edges ?? []), [graph]);
  const crumbs = breadcrumbFor(view, focus);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setFocusedNodeId(node.id);

    const target = drillTargetFor(node.data as AuditGraphNode, view);
    if (target) {
      clearFocus();
      goTo(target.view, target.focus);
    }
  };

  return (
    <main className="audit-explorer">
      <header className="audit-explorer__bar">
        <div>
          <nav className="audit-breadcrumb">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.view}:${crumb.focus ?? ""}`}>
                {index > 0 && <ChevronRight size={14} className="audit-breadcrumb__sep" />}
                {crumb.current ? (
                  <span className="audit-breadcrumb__crumb audit-breadcrumb__crumb--current">{crumb.label}</span>
                ) : (
                  <button
                    type="button"
                    className="audit-breadcrumb__crumb audit-breadcrumb__link"
                    onClick={() => {
                      clearFocus();
                      goTo(crumb.view, crumb.focus);
                    }}
                  >
                    {crumb.label}
                  </button>
                )}
              </Fragment>
            ))}
          </nav>
          {graph && (
            <p className="audit-explorer__sub">
              {graph.summary.findings.toLocaleString("en-US")} hallazgos · risk{" "}
              {graph.summary.risk.toLocaleString("en-US")} ·{" "}
              {(view === "heatmap" ? graph.summary.nodes : graph.summary.nodes - 1)} {UNIT_BY_VIEW[view]}
              {view !== "file" && " · click en un nodo para profundizar"}
            </p>
          )}
        </div>

        <div className="audit-explorer__right">
          {(view === "overview" || view === "heatmap") && (
            <div className="audit-viewtoggle">
              <button
                type="button"
                className={`audit-viewtoggle__btn${view === "overview" ? " audit-viewtoggle__btn--active" : ""}`}
                onClick={() => goTo("overview", null)}
              >
                Mapa por apps
              </button>
              <button
                type="button"
                className={`audit-viewtoggle__btn${view === "heatmap" ? " audit-viewtoggle__btn--active" : ""}`}
                onClick={() => goTo("heatmap", null)}
              >
                Heatmap global
              </button>
            </div>
          )}
          <AuditLegend />
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
