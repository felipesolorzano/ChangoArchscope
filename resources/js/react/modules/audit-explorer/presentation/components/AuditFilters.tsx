import type { AuditGraphAccent } from "../../domain/value-objects/AuditGraph";
import type { CategoryFilter } from "../utils/auditNodeFilter";

const PHP_VERSIONS = ["8.1", "8.2", "8.3", "8.4"] as const;

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "Todas las categorias" },
  { value: "php_compatibility", label: "Compatibilidad PHP" },
  { value: "security", label: "Seguridad" },
  { value: "database", label: "Base de datos" },
  { value: "complexity", label: "Complejidad" },
  { value: "testing", label: "Testing" },
  { value: "dead_code", label: "Codigo muerto" },
  { value: "coupling_low_level", label: "Acoplamiento" },
];

interface AuditFiltersProps {
  phpVersion: string | null;
  onPhpVersionChange: (value: string | null) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

export function AuditFilters({ phpVersion, onPhpVersionChange, category, onCategoryChange }: AuditFiltersProps) {
  return (
    <div className="audit-filters">
      <label className="audit-filters__field">
        <span className="audit-filters__label">PHP objetivo</span>
        <select
          className="audit-filters__select"
          value={phpVersion ?? ""}
          onChange={(event) => onPhpVersionChange(event.target.value === "" ? null : event.target.value)}
        >
          <option value="">Sin compatibilidad</option>
          {PHP_VERSIONS.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
        </select>
      </label>

      <label className="audit-filters__field">
        <span className="audit-filters__label">Categoria</span>
        <select
          className="audit-filters__select"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
