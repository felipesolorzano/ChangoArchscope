import type { AuditGraphAccent } from "../../domain/value-objects/AuditGraph";
import { accentStroke } from "../constants/auditView";

const ACCENTS: Array<{ accent: AuditGraphAccent; label: string }> = [
  { accent: "security", label: "Seguridad" },
  { accent: "database", label: "Base de datos" },
  { accent: "complexity", label: "Complejidad" },
  { accent: "testing", label: "Testing" },
  { accent: "dead_code", label: "Codigo muerto" },
  { accent: "coupling_low_level", label: "Acoplamiento" },
  { accent: "php_compatibility", label: "Compatibilidad PHP" },
  { accent: "mixed", label: "Mixto" },
];

export function AuditLegend() {
  return (
    <div className="audit-legend">
      <span className="audit-legend__title">Borde = categoria dominante</span>
      <div className="audit-legend__items">
        {ACCENTS.map(({ accent, label }) => (
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
