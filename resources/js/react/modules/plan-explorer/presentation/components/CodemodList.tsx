import type { CodemodCandidate, CodemodFile, CodemodPlan } from "../../domain/value-objects/Codemod";
import { copyText } from "../../infrastructure/browser/copyText";
import { codemodSummary, codemodToolLabel, codemodWarning } from "../constants/codemodView";

// XRay X5: patrones legacy con su herramienta; primero los automaticos.
export function CodemodList({ plan }: { plan: CodemodPlan }) {
  if (plan.candidates.length === 0) {
    return <p className="plan-drawer__hint">No hay APIs legacy con reemplazo conocido</p>;
  }

  return (
    <ol className="plan-drawer__list">
      {plan.candidates.map((candidate) => (
        <CodemodItem key={candidate.pattern} candidate={candidate} />
      ))}
    </ol>
  );
}

function CodemodItem({ candidate }: { candidate: CodemodCandidate }) {
  const warning = codemodWarning(candidate);

  return (
    <li className="plan-characterization__item">
      <div className="plan-characterization__head">
        <span className="plan-codemods__title">{candidate.title}</span>
        <span className="plan-characterization__kind">{codemodToolLabel(candidate)}</span>
      </div>
      <span className="plan-drawer__msg">{codemodSummary(candidate)}</span>
      {warning !== null && <span className="plan-codemods__warning">{warning}</span>}
      {candidate.note !== "" && <span className="plan-codemods__note">{candidate.note}</span>}
      {candidate.command !== null && (
        <div className="plan-codemods__command">
          <code>{candidate.command}</code>
          <button type="button" className="plan-characterization__download" onClick={() => copyText(candidate.command!)}>
            Copiar
          </button>
        </div>
      )}
      <details className="plan-codemods__files">
        <summary>Archivos</summary>
        {candidate.files.map((file) => (
          <CodemodFileRow key={file.file} file={file} />
        ))}
      </details>
    </li>
  );
}

function CodemodFileRow({ file }: { file: CodemodFile }) {
  const tested = file.testedBy.length > 0;

  return (
    <div className="plan-codemods__file">
      <span className="plan-drawer__file" title={file.file}>
        {file.file}
      </span>
      <span className="plan-codemods__count">{file.occurrences}</span>
      <span className={tested ? "plan-codemods__tested" : "plan-codemods__untested"} title={file.testedBy.join(", ")}>
        {tested ? "con tests" : "sin tests"}
      </span>
    </div>
  );
}
