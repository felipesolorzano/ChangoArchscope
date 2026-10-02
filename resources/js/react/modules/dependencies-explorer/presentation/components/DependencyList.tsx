import type { DependencyEntry } from "../../domain/value-objects/DependencyReport";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";
import { ageLabel, dependencyKey, filterDependencies, groupByStatus, statusColor, statusLabel, upgradeHint, versionText } from "../utils/dependencyView";

// Paquetes agrupados de lo mas urgente a lo sano, con la version a la que ir y el siguiente paso.
export function DependencyList({ dependencies, now }: { dependencies: DependencyEntry[]; now: Date }) {
  const { status, query, hideDev, select } = useDependenciesExplorerStore();
  const groups = groupByStatus(filterDependencies(dependencies, { status, query, hideDev }));

  if (groups.length === 0) {
    return <p className="deps-empty">Ningun paquete coincide con los filtros</p>;
  }

  return (
    <div className="deps-list">
      {groups.map((group) => (
        <section key={group.status} className="deps-group" style={{ borderColor: statusColor(group.status) }}>
          <h2 className="deps-group__title" style={{ color: statusColor(group.status) }}>
            {statusLabel(group.status)} · {group.items.length}
          </h2>
          {group.items.map((dependency) => (
            <button key={dependencyKey(dependency)} type="button" className="deps-row" onClick={() => select(dependencyKey(dependency))}>
              <span className="deps-row__head">
                <span className="deps-row__name">{dependency.name}</span>
                {dependency.dev && <span className="deps-tag">dev</span>}
                <span className="deps-tag deps-tag--eco">{dependency.ecosystem}</span>
              </span>
              <span className="deps-row__versions">{versionText(dependency)}</span>
              <span className="deps-row__age">{ageLabel(dependency.currentPublishedAt, now)}</span>
              <span className="deps-row__hint">{upgradeHint(dependency)}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
