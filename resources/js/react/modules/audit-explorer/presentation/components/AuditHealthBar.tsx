import type { AuditHealth } from "../../domain/value-objects/AuditGraph";
import { checkStatus, healthBarSegments, healthSummaryText } from "../constants/auditHealth";

// KPI de salud del proyecto: porcentaje sano, barra verde/roja y checklist de categorias auditadas.
export function AuditHealthBar({ health }: { health: AuditHealth | null }) {
  if (!health) {
    return null;
  }

  const { summary } = health;

  return (
    <section className="audit-health">
      <div className="audit-health__kpi">
        <strong className="audit-health__percent">{summary.healthyPercent}% sano</strong>
        <span className="audit-health__summary">{healthSummaryText(summary)}</span>
      </div>
      <div className="audit-health__bar">
        {healthBarSegments({ files: summary.files, withFindings: summary.withFindings }).map((segment) => (
          <span key={segment.key} style={{ width: `${segment.percent}%`, background: segment.color }} />
        ))}
      </div>
      <ul className="audit-health__checks">
        {health.checks.map((check) => {
          const status = checkStatus(check.findings);
          return (
            <li key={check.category} className={`audit-health__check audit-health__check--${status.ok ? "ok" : "bad"}`}>
              <span className="audit-health__check-icon">{status.text}</span>
              {check.label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
