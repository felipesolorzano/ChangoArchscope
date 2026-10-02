import type { SecurityAssessment } from "../../domain/value-objects/DependencyReport";
import { severityColor, severityLabel } from "../utils/dependencyView";

// Vulnerabilidades de la version actual (OSV), de la mas grave a la menos, con la version que corrige.
export function DependencyVulnerabilities({ security, advisoryError }: { security: SecurityAssessment; advisoryError: string | null }) {
  return (
    <>
      {security.vulnerabilities.length > 0 && (
        <section className="deps-vulns">
          <h3 className="deps-vulns__title">Vulnerabilidades</h3>
          {security.vulnerabilities.map((vulnerability) => (
            <a key={vulnerability.id} className="deps-vuln" href={`https://osv.dev/vulnerability/${vulnerability.id}`} target="_blank" rel="noreferrer">
              <span className="deps-vuln__head">
                <strong>{vulnerability.cve ?? vulnerability.id}</strong>
                <span className="deps-vuln__severity" style={{ color: severityColor(vulnerability.severity) }}>
                  {severityLabel(vulnerability.severity)}
                </span>
              </span>
              <span className="deps-vuln__summary">{vulnerability.summary}</span>
              <span className="deps-vuln__fix">{vulnerability.fixedIn ? `corregida en ${vulnerability.fixedIn}` : "sin version corregida"}</span>
            </a>
          ))}
        </section>
      )}
      {advisoryError && <p className="deps-drawer__error">{`OSV: ${advisoryError}`}</p>}
    </>
  );
}
