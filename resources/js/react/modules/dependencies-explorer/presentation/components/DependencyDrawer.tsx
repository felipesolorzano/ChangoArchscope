import { X } from "lucide-react";

import type { DependencyEntry, DependencyReport } from "../../domain/value-objects/DependencyReport";
import { DependencyVulnerabilities } from "./DependencyVulnerabilities";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";
import { ageLabel, dependencyKey, filesLabel, groupMates, manifestLabel, statusColor, statusLabel, supportLabel, upgradeHint, usageLabel } from "../utils/dependencyView";

function registryUrl(dependency: DependencyEntry): string {
  return dependency.ecosystem === "npm" ? `https://www.npmjs.com/package/${dependency.name}` : `https://packagist.org/packages/${dependency.name}`;
}

// Detalle del paquete abierto: versiones, antiguedad, siguiente paso y link al registro.
export function DependencyDrawer({ report, now }: { report: DependencyReport; now: Date }) {
  const selected = useDependenciesExplorerStore((state) => state.selected);
  const select = useDependenciesExplorerStore((state) => state.select);
  const dependency = report.dependencies.find((entry) => dependencyKey(entry) === selected);

  if (!dependency) {
    return null;
  }

  return (
    <aside className="deps-drawer">
      <header className="deps-drawer__head">
        <div>
          <h2 className="deps-drawer__title">{dependency.name}</h2>
          <span className="deps-drawer__status" style={{ color: statusColor(dependency.status) }}>
            {statusLabel(dependency.status)}
          </span>
        </div>
        <button type="button" className="deps-drawer__close" aria-label="Cerrar" onClick={() => select(null)}>
          <X size={16} />
        </button>
      </header>
      <p className="deps-drawer__hint">{upgradeHint(dependency)}</p>
      <DependencyFacts dependency={dependency} root={report.root} now={now} mates={groupMates(dependency, report.dependencies)} />
      <DependencyVulnerabilities security={dependency.security} advisoryError={dependency.advisoryError} />
      {dependency.lookupError && (
        <p className="deps-drawer__error">
          {dependency.lookupError}
          {dependency.stale ? " (datos de cache viejos)" : ""}
        </p>
      )}
      <a className="deps-drawer__link" href={registryUrl(dependency)} target="_blank" rel="noreferrer">
        Ver en el registro
      </a>
    </aside>
  );
}

type FactsProps = { dependency: DependencyEntry; root: string; now: Date; mates: string[] };

function DependencyFacts({ dependency, root, now, mates }: FactsProps) {
  const withAge = (version: string | null, publishedAt: string | null) => [version ?? "—", ageLabel(publishedAt, now)].filter(Boolean).join(" · ");
  const rows: Array<[string, string]> = [
    ["Ecosistema", dependency.ecosystem],
    [dependency.vendored ? "Copia en" : "Manifiesto", manifestLabel(dependency.manifest, root)],
    ["Copias", dependency.vendored ? filesLabel(dependency.vendored.files) : ""],
    ["Constraint", dependency.constraint],
    ["Instalada", dependency.installed ?? "—"],
    ["Actual", withAge(dependency.current, dependency.currentPublishedAt)],
    ["Recomendada", dependency.recommended ?? "—"],
    ["Ultima", withAge(dependency.latest, dependency.latestPublishedAt)],
    ["Soporte", dependency.support ? `${dependency.support.product} ${dependency.support.cycle} · ${supportLabel(dependency.support)}` : ""],
    ["Uso", usageLabel(dependency)],
    ["Actualizar junto con", mates.join(", ")],
  ];

  return (
    <dl className="deps-drawer__facts">
      {rows.filter(([, value]) => value !== "").map(([label, value]) => (
        <div key={label} className="deps-drawer__fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
