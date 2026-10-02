import type { AuditHealth, AuditHealthTile } from "../../domain/value-objects/AuditGraph";
import { healthLabel } from "../constants/auditHealth";
import { toneFill } from "../constants/auditView";

function tileTitle(tile: AuditHealthTile): string {
  return tile.findings === 0 ? `${tile.path} · sano` : `${tile.path} · ${tile.findings} hallazgos`;
}

// Todos los archivos del proyecto, agrupados por carpeta: verde lo sano, por severidad lo demas.
export function AuditMosaic({ health, onOpenFile }: { health: AuditHealth; onOpenFile: (path: string) => void }) {
  return (
    <section className="audit-mosaic">
      {health.groups.map((group) => (
        <article key={group.key} className="audit-mosaic__group">
          <header className="audit-mosaic__head">
            <strong>{group.label}</strong>
            <span>{healthLabel({ files: group.files, withFindings: group.withFindings })}</span>
          </header>
          <div className="audit-mosaic__tiles">
            {group.tiles.map((tile) => (
              <button
                key={tile.path}
                type="button"
                className="audit-mosaic__tile"
                style={{ background: toneFill(tile.tone) }}
                title={tileTitle(tile)}
                onClick={() => onOpenFile(tile.path)}
              />
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
