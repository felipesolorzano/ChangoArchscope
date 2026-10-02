import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { AuditGraphNode } from "../../domain/value-objects/AuditGraph";
import type { AuditNodeHealth } from "../../domain/value-objects/AuditGraph";
import { healthBarSegments, healthLabel } from "../../presentation/constants/auditHealth";
import { accentStroke, severityBarSegments, toneFill } from "../../presentation/constants/auditView";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function AuditNodeCard({ data }: NodeProps) {
  const node = data as unknown as AuditGraphNode;
  const stroke = accentStroke(node.accent);

  return (
    <div className="audit-node" style={{ width: node.size }}>
      <Handle type="target" position={Position.Top} className="audit-node__handle" />
      <AuditNodeBubble node={node} stroke={stroke} />
      <AuditNodeMeta node={node} stroke={stroke} />
      <Handle type="source" position={Position.Bottom} className="audit-node__handle" />
    </div>
  );
}

function AuditNodeBubble({ node, stroke }: { node: AuditGraphNode; stroke: string }) {
  const segments = severityBarSegments(node.severityMix);

  return (
    <div
      className="audit-node__bubble"
      style={{
        width: node.size,
        height: node.size,
        background: `radial-gradient(circle at 50% 38%, ${toneFill(node.tone)}, #0b1220 140%)`,
        borderColor: stroke,
        boxShadow: `0 0 0 2px rgba(2,6,23,0.6), 0 14px 36px -18px ${stroke}`,
      }}
      title={`${node.label} · ${formatNumber(node.metrics.findings)} hallazgos · risk ${formatNumber(node.metrics.risk)}`}
    >
      <span className="audit-node__label">{node.label}</span>
      {node.metrics.findings === 0 ? (
        <span className="audit-node__healthy">✓ sano</span>
      ) : (
        <>
          <span className="audit-node__findings">{formatNumber(node.metrics.findings)}</span>
          <span className="audit-node__findings-label">hallazgos</span>
        </>
      )}

      {segments.length > 0 && (
        <div className="audit-node__bar" aria-hidden>
          {segments.map((segment) => (
            <span key={segment.key} className="audit-node__bar-seg" style={{ width: `${segment.percent}%`, background: segment.color }} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditNodeMeta({ node, stroke }: { node: AuditGraphNode; stroke: string }) {
  return (
    <div className="audit-node__meta">
      {node.health && node.health.files > 1 && <NodeHealth health={node.health} />}
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
  );
}

// Archivos sanos vs con hallazgos de una app o del proyecto.
function NodeHealth({ health }: { health: AuditNodeHealth }) {
  return (
    <div className="audit-node__health">
      <div className="audit-node__health-bar" aria-hidden>
        {healthBarSegments(health).map((segment) => (
          <span key={segment.key} style={{ width: `${segment.percent}%`, background: segment.color }} />
        ))}
      </div>
      <span className="audit-node__health-label">{healthLabel(health)}</span>
    </div>
  );
}
