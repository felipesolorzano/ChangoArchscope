import type { SelectedRuntime } from "../../domain/value-objects/DependencyReport";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";
import { runtimeKindLabel, runtimeOptions } from "../utils/dependencyView";

// Version de PHP / Node / npm con la que se calcula la recomendada (default: la detectada).
export function RuntimeSelector({ runtimes }: { runtimes: SelectedRuntime[] }) {
  const chosen = useDependenciesExplorerStore((state) => state.runtimes);
  const setRuntime = useDependenciesExplorerStore((state) => state.setRuntime);

  return (
    <div className="deps-runtimes">
      <span className="deps-runtimes__title">Calcular con</span>
      {runtimes.map((runtime) => (
        <label key={runtime.kind} className="deps-runtime">
          <span className="deps-runtime__label">{runtimeKindLabel(runtime.kind)}</span>
          <select
            className="deps-runtime__select"
            value={chosen[runtime.kind] ?? runtime.selected ?? ""}
            onChange={(event) => setRuntime(runtime.kind, event.target.value)}
          >
            {runtime.selected === null && chosen[runtime.kind] === undefined && <option value="">desconocido</option>}
            {runtimeOptions(runtime).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
