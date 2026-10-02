import { auditCategoriesFor } from "../constants/auditCategories";
import type { AuditTarget } from "../hooks/useAuditGraphController";
import type { CategoryFilter } from "../utils/auditNodeFilter";

const PHP_VERSIONS = ["8.1", "8.2", "8.3", "8.4"] as const;

interface AuditFiltersProps {
  target: AuditTarget;
  phpVersion: string | null;
  onPhpVersionChange: (value: string | null) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

export function AuditFilters({ target, phpVersion, onPhpVersionChange, category, onCategoryChange }: AuditFiltersProps) {
  return (
    <div className="audit-filters">
      {target === "laravel" && (
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
      )}

      <label className="audit-filters__field">
        <span className="audit-filters__label">Categoria</span>
        <select
          className="audit-filters__select"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
        >
          <option value="all">Todas las categorias</option>
          {auditCategoriesFor(target).map((option) => (
            <option key={option.accent} value={option.accent}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
