import { X } from "lucide-react";

import type { AuditGraph, AuditGraphNode, AuditHealthCheck } from "../../domain/value-objects/AuditGraph";
import { checkStatus } from "../constants/auditHealth";
import { accentStroke, severityBarSegments, toneFill } from "../constants/auditView";

interface AuditDetailDrawerProps {
  graph: AuditGraph | null;
  focusedNodeId: string | null;
  checks?: AuditHealthCheck[];
  onClose: () => void;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function AuditDetailDrawer({ graph, focusedNodeId, checks = [], onClose }: AuditDetailDrawerProps) {
  const node = graph?.nodes.find((candidate) => candidate.id === focusedNodeId) ?? null;

  if (!node) {
    return null;
  }

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
        <Metric value={node.metrics.findings} label="hallazgos" />
        <Metric value={node.metrics.risk} label="risk score" />
      </div>

      {node.type === "file" && <CategoryChecklist node={node} checks={checks} />}
      <SeveritySection node={node} />
      <BadgesSection badges={node.badges} />
      <FindingsSection node={node} />

      {node.drill && <p className="audit-drawer__drill">Click para profundizar en este nodo.</p>}
    </aside>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span className="audit-drawer__metric-value">{formatNumber(value)}</span>
      <span className="audit-drawer__metric-label">{label}</span>
    </div>
  );
}

function SeveritySection({ node }: { node: AuditGraphNode }) {
  return (
    <div className="audit-drawer__section">
      <span className="audit-drawer__section-title">Mezcla de severidad</span>
      <div className="audit-drawer__bar">
        {severityBarSegments(node.severityMix).map((segment) => (
          <span key={segment.key} className="audit-drawer__bar-seg" style={{ width: `${segment.percent}%`, background: segment.color }} />
        ))}
      </div>
      <div className="audit-drawer__sev-legend">
        <span>High {node.severityMix.high}</span>
        <span>Medium {node.severityMix.medium}</span>
        <span>Low {node.severityMix.low}</span>
      </div>
    </div>
  );
}

function BadgesSection({ badges }: { badges: string[] }) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="audit-drawer__section">
      <span className="audit-drawer__section-title">Señales</span>
      <div className="audit-drawer__badges">
        {badges.map((badge) => (
          <span key={badge} className="audit-drawer__badge">
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}

function FindingsSection({ node }: { node: AuditGraphNode }) {
  const findings = node.findings ?? [];

  if (findings.length === 0) {
    return null;
  }

  return (
    <div className="audit-drawer__section">
      <span className="audit-drawer__section-title">
        Hallazgos
        {node.metrics.findings > findings.length && ` · mostrando ${findings.length} de ${formatNumber(node.metrics.findings)}`}
      </span>
      <ul className="audit-drawer__findings">
        {findings.map((item, index) => (
          <li key={`${item.line}:${index}`} className="audit-drawer__finding">
            <span className={`audit-drawer__sev audit-drawer__sev--${item.severity}`}>{item.severity}</span>
            <span className="audit-drawer__line">L{item.line}</span>
            <span className="audit-drawer__msg">{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Una fila por categoria auditada: ✓ si el archivo no tiene hallazgos de esa categoria.
function CategoryChecklist({ node, checks }: { node: AuditGraphNode; checks: AuditHealthCheck[] }) {
  return (
    <div className="audit-drawer__section">
      <span className="audit-drawer__section-title">Por categoría</span>
      <ul className="audit-drawer__checks">
        {checks.map((check) => {
          const status = checkStatus(node.byCategory[check.category] ?? 0);
          return (
            <li key={check.category} className={`audit-drawer__check audit-drawer__check--${status.ok ? "ok" : "bad"}`}>
              <span>{status.text}</span>
              {check.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
