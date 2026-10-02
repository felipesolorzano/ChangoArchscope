import { X } from "lucide-react";

import type { DependencyEntry, DependencyReport } from "../../domain/value-objects/DependencyReport";
import { DependencyVulnerabilities } from "./DependencyVulnerabilities";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";
import { ageLabel, dependencyKey, manifestLabel, statusColor, statusLabel, supportLabel, upgradeHint } from "../utils/dependencyView";

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
      <DependencyFacts dependency={dependency} root={report.root} now={now} />
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

function DependencyFacts({ dependency, root, now }: { dependency: DependencyEntry; root: string; now: Date }) {
  const withAge = (version: string | null, publishedAt: string | null) => [version ?? "—", ageLabel(publishedAt, now)].filter(Boolean).join(" · ");
  const rows: Array<[string, string]> = [
    ["Ecosistema", dependency.ecosystem],
    ["Manifiesto", manifestLabel(dependency.manifest, root)],
    ["Constraint", dependency.constraint],
    ["Instalada", dependency.installed ?? "—"],
    ["Actual", withAge(dependency.current, dependency.currentPublishedAt)],
    ["Recomendada", dependency.recommended ?? "—"],
    ["Ultima", withAge(dependency.latest, dependency.latestPublishedAt)],
    ...(dependency.support ? [["Soporte", `${dependency.support.product} ${dependency.support.cycle} · ${supportLabel(dependency.support)}`] as [string, string]] : []),
  ];

  return (
    <dl className="deps-drawer__facts">
      {rows.map(([label, value]) => (
        <div key={label} className="deps-drawer__fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
