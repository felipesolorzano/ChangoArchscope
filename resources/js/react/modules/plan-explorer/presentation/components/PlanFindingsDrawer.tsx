import { X } from "lucide-react";

import type { PlanGraph, PlanTaskFindings } from "../../domain/value-objects/PlanGraph";

interface PlanFindingsDrawerProps {
  graph: PlanGraph | null;
  focusedTaskKey: string | null;
  findings: PlanTaskFindings | null;
  loading: boolean;
  onClose: () => void;
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function PlanFindingsDrawer({ graph, focusedTaskKey, findings, loading, onClose }: PlanFindingsDrawerProps) {
  if (focusedTaskKey === null) {
    return null;
  }

  const task = graph?.nodes.find((node) => node.id === focusedTaskKey) ?? null;

  return (
    <aside className="plan-drawer">
      <header className="plan-drawer__head">
        <div>
          <span className="plan-drawer__eyebrow">Hallazgos de la tarea</span>
          <h2 className="plan-drawer__title">{task?.title ?? focusedTaskKey}</h2>
        </div>
        <button type="button" className="plan-drawer__close" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>

      {loading && <p className="plan-drawer__hint">Cargando hallazgos...</p>}

      {!loading && findings && findings.items.length === 0 && (
        <p className="plan-drawer__hint">Esta tarea no tiene hallazgos concretos asociados.</p>
      )}

      {!loading && findings && findings.items.length > 0 && (
        <>
          <p className="plan-drawer__count">
            {findings.total > findings.items.length
              ? `Mostrando ${findings.items.length} de ${findings.total.toLocaleString("en-US")}`
              : `${findings.total.toLocaleString("en-US")} hallazgos`}
          </p>
          <ul className="plan-drawer__list">
            {findings.items.map((item, index) => (
              <li key={`${item.file}:${item.line}:${index}`} className="plan-drawer__item">
                <span className={`plan-drawer__sev plan-drawer__sev--${item.severity}`}>{item.severity}</span>
                <span className="plan-drawer__file" title={item.file}>
                  {fileName(item.file)}
                  {item.line > 0 && <span className="plan-drawer__line">:{item.line}</span>}
                </span>
                <span className="plan-drawer__msg">{item.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
