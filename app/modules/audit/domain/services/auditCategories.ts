export type AuditCategoryCheck = { category: string; label: string };

// Categorias que audita cada stack, en el orden en que se muestran en el checklist de salud.
const COMMON: AuditCategoryCheck[] = [
  { category: "security", label: "Seguridad" },
  { category: "architecture_violation", label: "Arquitectura" },
  { category: "coupling_module", label: "Acoplamiento entre módulos" },
  { category: "complexity", label: "Complejidad" },
  { category: "coupling_low_level", label: "Acoplamiento de bajo nivel" },
  { category: "dead_code", label: "Código muerto" },
  { category: "testing", label: "Tests" },
];

const BY_TARGET: Record<"laravel" | "react", AuditCategoryCheck[]> = {
  laravel: [...COMMON, { category: "database", label: "Base de datos" }, { category: "php_compatibility", label: "Compatibilidad PHP" }],
  react: [...COMMON, { category: "api_access", label: "API / HTTP" }],
};

export function auditCategoriesFor(target: "laravel" | "react"): AuditCategoryCheck[] {
  return BY_TARGET[target];
}
