import type { ArchitectureGraph, ArchitectureHealth, IncludeStats } from "../../domain/value-objects/ArchitectureGraph";
import { useArchitectureFocusStore } from "../store/architectureFocusStore";
import { cycleLabel, nodeIdForPath } from "../utils/architectureHealthView";
import { Stat } from "./Stat";

const MAX_CYCLES = 8;
const MAX_HUBS = 5;

type Focus = (path: string) => void;

// XRay X1: ciclos de imports y archivos de los que depende medio proyecto; click enfoca el archivo.
export function ArchitectureHealthPanel({ graph }: { graph: ArchitectureGraph }) {
  const setFocusedNodeId = useArchitectureFocusStore((state) => state.setFocusedNodeId);
  const { health } = graph;

  if (!health) {
    return null;
  }

  const focus: Focus = (path) => {
    const nodeId = nodeIdForPath(graph.nodes, path);
    if (nodeId !== null) {
      setFocusedNodeId(nodeId);
    }
  };

  return (
    <section className="architecture-health">
      <h2 className="architecture-health__title">Salud</h2>
      <div className="architecture-stats">
        <Stat label="Ciclos" value={health.summary.cycles} />
        <Stat label="En ciclos" value={health.summary.filesInCycles} />
        <Stat label="Imports entre módulos" value={health.summary.crossModuleImports} />
        <Stat label="Pares de módulos" value={health.summary.modulePairs} />
      </div>
      {graph.summary.includes && <IncludeSummary includes={graph.summary.includes} />}
      <CycleList cycles={health.cycles} onFocus={focus} />
      <h3 className="architecture-health__subtitle">Más importados</h3>
      <div className="architecture-health__list">
        {health.mostImported.slice(0, MAX_HUBS).map((hub) => (
          <button key={hub.path} type="button" className="architecture-health__hub" onClick={() => focus(hub.path)}>
            {`${hub.path} · ${hub.count}`}
          </button>
        ))}
      </div>
    </section>
  );
}

const MAX_CONSTANTS = 5;

// PHP legacy: cuantos include/require se resolvieron y que constantes faltan declarar.
function IncludeSummary({ includes }: { includes: IncludeStats }) {
  const missing = includes.unresolvedConstants.slice(0, MAX_CONSTANTS);

  return (
    <div className="architecture-health__includes">
      <span>{`Includes: ${includes.resolved} de ${includes.total} resueltos · ${includes.external} externos`}</span>
      {missing.length > 0 && (
        <>
          <span className="architecture-health__missing">{`Sin valor: ${missing.map((constant) => `${constant.name} (${constant.count})`).join(", ")}`}</span>
          <span className="architecture-health__hint">Declaralas en laravel.includeConstants</span>
        </>
      )}
    </div>
  );
}

function CycleList({ cycles, onFocus }: { cycles: ArchitectureHealth["cycles"]; onFocus: Focus }) {
  if (cycles.length === 0) {
    return <p className="architecture-health__ok">Sin ciclos de imports ✓</p>;
  }

  const hidden = cycles.length - MAX_CYCLES;
  return (
    <div className="architecture-health__list">
      {cycles.slice(0, MAX_CYCLES).map((cycle) => (
        <button
          key={cycle.files.join("|")}
          type="button"
          className={`architecture-health__cycle${cycle.crossModule ? " architecture-health__cycle--cross" : ""}`}
          title={cycle.path.join(" → ")}
          onClick={() => onFocus(cycle.files[0])}
        >
          {cycleLabel(cycle)}
        </button>
      ))}
      {hidden > 0 && <span className="architecture-health__more">{`+${hidden} más`}</span>}
    </div>
  );
}
