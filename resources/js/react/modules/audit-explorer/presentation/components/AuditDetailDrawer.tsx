import { X } from "lucide-react";

import type { AuditGraph } from "../../domain/value-objects/AuditGraph";
import { accentStroke, severityBarSegments, toneFill } from "../constants/auditView";

interface AuditDetailDrawerProps {
  graph: AuditGraph | null;
  focusedNodeId: string | null;
  onClose: () => void;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function AuditDetailDrawer({ graph, focusedNodeId, onClose }: AuditDetailDrawerProps) {
  const node = graph?.nodes.find((candidate) => candidate.id === focusedNodeId) ?? null;

  if (!node) {
    return null;
  }

  const segments = severityBarSegments(node.severityMix);

  return (
    <aside className="audit-drawer" style={{ borderColor: accentStroke(node.accent) }}>
      <header className="audit-drawer__head">
        <span className="audit-drawer__chip" style={{ background: toneFill(node.tone), borderColor: accentStroke(node.accent) }}>
          {node.type}
        </span>
        <h2 className="audit-drawer__title">{node.label}</h2>
        <button type="button" className="audit-drawer__close" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>

      <div className="audit-drawer__metrics">
        <div>
          <span className="audit-drawer__metric-value">{formatNumber(node.metrics.findings)}</span>
          <span className="audit-drawer__metric-label">hallazgos</span>
        </div>
        <div>
          <span className="audit-drawer__metric-value">{formatNumber(node.metrics.risk)}</span>
          <span className="audit-drawer__metric-label">risk score</span>
        </div>
      </div>

      <div className="audit-drawer__section">
        <span className="audit-drawer__section-title">Mezcla de severidad</span>
        <div className="audit-drawer__bar">
          {segments.map((segment) => (
            <span key={segment.key} className="audit-drawer__bar-seg" style={{ width: `${segment.percent}%`, background: segment.color }} />
          ))}
        </div>
        <div className="audit-drawer__sev-legend">
          <span>High {node.severityMix.high}</span>
          <span>Medium {node.severityMix.medium}</span>
          <span>Low {node.severityMix.low}</span>
        </div>
      </div>

      {node.badges.length > 0 && (
        <div className="audit-drawer__section">
          <span className="audit-drawer__section-title">Señales</span>
          <div className="audit-drawer__badges">
            {node.badges.map((badge) => (
              <span key={badge} className="audit-drawer__badge">{badge}</span>
            ))}
          </div>
        </div>
      )}

      {node.findings && node.findings.length > 0 && (
        <div className="audit-drawer__section">
          <span className="audit-drawer__section-title">
            Hallazgos
            {node.metrics.findings > node.findings.length && ` · mostrando ${node.findings.length} de ${formatNumber(node.metrics.findings)}`}
          </span>
          <ul className="audit-drawer__findings">
            {node.findings.map((item, index) => (
              <li key={`${item.line}:${index}`} className="audit-drawer__finding">
                <span className={`audit-drawer__sev audit-drawer__sev--${item.severity}`}>{item.severity}</span>
                <span className="audit-drawer__line">L{item.line}</span>
                <span className="audit-drawer__msg">{item.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.drill && <p className="audit-drawer__drill">Click para profundizar en este nodo.</p>}
    </aside>
  );
}
