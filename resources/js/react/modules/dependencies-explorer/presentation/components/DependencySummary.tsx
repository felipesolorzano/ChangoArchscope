import type { DependencySummaryData } from "../../domain/value-objects/DependencyReport";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";
import { STATUS_ORDER, statusColor, statusLabel, upToDatePercent } from "../utils/dependencyView";

// KPI "% al dia", barra por estado y chips que filtran la lista.
export function DependencySummary({ summary }: { summary: DependencySummaryData }) {
  const active = useDependenciesExplorerStore((state) => state.status);
  const toggleStatus = useDependenciesExplorerStore((state) => state.toggleStatus);
  const present = STATUS_ORDER.filter((status) => summary.byStatus[status] > 0);

  return (
    <section className="deps-summary">
      <div className="deps-summary__head">
        <strong className="deps-summary__kpi">{upToDatePercent(summary)}% al dia</strong>
        <div className="deps-summary__bar">
          {present.map((status) => (
            <span
              key={status}
              className="deps-summary__segment"
              style={{ background: statusColor(status), width: `${(summary.byStatus[status] / summary.total) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="deps-summary__chips">
        {present.map((status) => (
          <button
            key={status}
            type="button"
            className={`deps-chip${active === status ? " deps-chip--active" : ""}`}
            style={{ borderColor: statusColor(status) }}
            onClick={() => toggleStatus(status)}
          >
            {statusLabel(status)} {summary.byStatus[status]}
          </button>
        ))}
        {summary.limitedByRuntime > 0 && <span className="deps-summary__note">{summary.limitedByRuntime} limitados por el runtime</span>}
        {summary.lookupErrors > 0 && <span className="deps-summary__note">{summary.lookupErrors} sin datos del registro</span>}
      </div>
    </section>
  );
}
