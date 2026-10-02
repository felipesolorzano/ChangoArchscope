import { accentStroke } from "../constants/auditView";
import { auditCategoriesFor } from "../constants/auditCategories";
import type { AuditTarget } from "../hooks/useAuditGraphController";

interface AuditLegendProps {
  target: AuditTarget;
}

export function AuditLegend({ target }: AuditLegendProps) {
  const items = [...auditCategoriesFor(target), { accent: "mixed" as const, label: "Mixto" }];

  return (
    <div className="audit-legend">
      <span className="audit-legend__title">Borde = categoria dominante</span>
      <div className="audit-legend__items">
        {items.map(({ accent, label }) => (
          <span key={accent} className="audit-legend__item">
            <span className="audit-legend__dot" style={{ background: accentStroke(accent) }} />
            {label}
          </span>
        ))}
      </div>
      <span className="audit-legend__hint">Tamano ∝ riesgo · relleno = severidad · barra = mezcla de severidad</span>
    </div>
  );
}
