import { AlertCircle, RefreshCcw, X } from "lucide-react";
import type { ArchitectureCheck, ArchitectureCheckIssue } from "../../domain/value-objects/ArchitectureCheck";
import { Stat } from "./Stat";

interface ArchitectureCheckModalProps {
  result: ArchitectureCheck | null;
  loading: boolean;
  error: string | null;
  selectedModule: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function ArchitectureCheckModal({
  result,
  loading,
  error,
  selectedModule,
  onClose,
  onRefresh,
}: ArchitectureCheckModalProps) {
  return (
    <div className="architecture-modal-backdrop" role="presentation">
      <section className="architecture-modal" role="dialog" aria-modal="true" aria-labelledby="architecture-check-title">
        <header className="architecture-modal__header">
          <div>
            <span>{selectedModule || "Todos los módulos"}</span>
            <h2 id="architecture-check-title">Architecture check</h2>
          </div>
          <div className="architecture-modal__actions">
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="Actualizar check">
              <RefreshCcw size={16} />
            </button>
            <button type="button" onClick={onClose} aria-label="Cerrar modal">
              <X size={18} />
            </button>
          </div>
        </header>

        {loading && <div className="architecture-check-state">Ejecutando check...</div>}

        {error && (
          <div className="architecture-check-state architecture-check-state--error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {!loading && !error && result && (
          <div className="architecture-check">
            <div className={`architecture-check-status${result.passed ? " architecture-check-status--pass" : ""}`}>
              <strong>{result.passed ? "PASS" : "REVISAR"}</strong>
              <span>{new Date(result.checked_at).toLocaleString()}</span>
            </div>

            <div className="architecture-check-summary">
              <Stat label="Módulos" value={result.summary.modules} />
              <Stat label="Archivos" value={result.summary.files_scanned} />
              <Stat label="Violaciones" value={result.summary.violations_count} />
              <Stat label="Acoplamientos" value={result.summary.couplings_count} />
            </div>

            <div className="architecture-check-reports">
              {result.reports.map((report) => (
                <article
                  className={`architecture-check-report${report.passed ? " architecture-check-report--pass" : " architecture-check-report--review"}`}
                  key={report.module}
                >
                  <header>
                    <div>
                      <strong>{report.module}</strong>
                      <span>{report.files_scanned} archivos revisados</span>
                    </div>
                    <b className={report.passed ? "is-pass" : ""}>{report.passed ? "PASS" : "REVISAR"}</b>
                  </header>

                  <IssueList title="Violaciones" issues={report.violations} />
                  <IssueList title="Acoplamientos" issues={report.couplings} />
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function IssueList({ title, issues }: { title: string; issues: ArchitectureCheckIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="architecture-check-empty">
        <span>{title}</span>
        <strong>Sin hallazgos</strong>
      </div>
    );
  }

  return (
    <div className="architecture-check-issues">
      <span>{title}</span>
      {issues.map((issue) => (
        <div className="architecture-check-issue" key={`${issue.file}:${issue.line}:${issue.import}`}>
          <strong>
            {issue.layer}
            {issue.target_module ? ` -> ${issue.target_module}` : ""}
          </strong>
          <code>{issue.file}:{issue.line}</code>
          <p>{issue.message}</p>
          <small>{issue.import}</small>
          {issue.recommendation && <em>{issue.recommendation}</em>}
        </div>
      ))}
    </div>
  );
}
