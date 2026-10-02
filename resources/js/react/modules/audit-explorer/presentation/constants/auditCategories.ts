import type { AuditGraphAccent } from "../../domain/value-objects/AuditGraph";
import type { AuditTarget } from "../hooks/useAuditGraphController";

export type AuditCategory = { accent: AuditGraphAccent; label: string };

// Solo las categorias que el stack puede producir: Laravel no tiene `api_access`; React no tiene
// compatibilidad PHP ni SQL (`database`). Evita filtros que nunca devuelven nada.
const CATEGORIES_BY_TARGET: Record<AuditTarget, AuditCategory[]> = {
  laravel: [
    { accent: "php_compatibility", label: "Compatibilidad PHP" },
    { accent: "security", label: "Seguridad" },
    { accent: "database", label: "Base de datos" },
    { accent: "complexity", label: "Complejidad" },
    { accent: "testing", label: "Testing" },
    { accent: "dead_code", label: "Codigo muerto" },
    { accent: "coupling_low_level", label: "Acoplamiento" },
  ],
  react: [
    { accent: "security", label: "Seguridad" },
    { accent: "api_access", label: "API / HTTP" },
    { accent: "complexity", label: "Complejidad" },
    { accent: "testing", label: "Testing" },
    { accent: "dead_code", label: "Codigo muerto" },
    { accent: "coupling_low_level", label: "Acoplamiento" },
  ],
};

export function auditCategoriesFor(target: AuditTarget): AuditCategory[] {
  return CATEGORIES_BY_TARGET[target];
}
