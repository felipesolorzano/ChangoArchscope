import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { AuditGraphNode } from "../../domain/value-objects/AuditGraph";
import { accentStroke, severityBarSegments, toneFill } from "../../presentation/constants/auditView";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function AuditNodeCard({ data }: NodeProps) {
  const node = data as unknown as AuditGraphNode;
  const fill = toneFill(node.tone);
  const stroke = accentStroke(node.accent);
  const segments = severityBarSegments(node.severityMix);
  const diameter = node.size;

  return (
    <div className="audit-node" style={{ width: diameter }}>
      <Handle type="target" position={Position.Top} className="audit-node__handle" />

      <div
        className="audit-node__bubble"
        style={{
          width: diameter,
          height: diameter,
          background: `radial-gradient(circle at 50% 38%, ${fill}, #0b1220 140%)`,
          borderColor: stroke,
          boxShadow: `0 0 0 2px rgba(2,6,23,0.6), 0 14px 36px -18px ${stroke}`,
        }}
        title={`${node.label} · ${formatNumber(node.metrics.findings)} hallazgos · risk ${formatNumber(node.metrics.risk)}`}
      >
        <span className="audit-node__label">{node.label}</span>
        <span className="audit-node__findings">{formatNumber(node.metrics.findings)}</span>
        <span className="audit-node__findings-label">hallazgos</span>

        {segments.length > 0 && (
          <div className="audit-node__bar" aria-hidden>
            {segments.map((segment) => (
              <span
                key={segment.key}
                className="audit-node__bar-seg"
                style={{ width: `${segment.percent}%`, background: segment.color }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="audit-node__meta">
        <span className="audit-node__risk" style={{ color: stroke }}>
          risk {formatNumber(node.metrics.risk)}
        </span>
        {node.badges.length > 0 && (
          <div className="audit-node__badges">
            {node.badges.map((badge) => (
              <span key={badge} className="audit-node__badge" style={{ borderColor: stroke }}>
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="audit-node__handle" />
    </div>
  );
}
