import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import { loadArchitectureGraph } from "../../application/use-cases/loadArchitectureGraph";
import type { ArchitectureGraph } from "../../domain/value-objects/ArchitectureGraph";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";
import { filterArchitectureGraph } from "../utils/filterArchitectureGraph";
import { selectedNodeFor } from "../utils/selectedNodeFor";
import { useArchitectureFocusStore } from "../store/architectureFocusStore";

// Carga del grafo (opcionalmente de un modulo) con su estado de carga/error.
function useArchitectureGraphData(dependencies: ArchitectureProviders, target: ArchitectureTarget, onReload: () => void) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (module: string) => {
      setLoading(true);
      setError(null);
      onReload();

      try {
        setGraph(await loadArchitectureGraph(dependencies.graphProvider, module || undefined, target));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el grafo");
      } finally {
        setLoading(false);
      }
    },
    [dependencies.graphProvider, target, onReload],
  );

  return { graph, loading, error, load };
}

// Filtros del explorador (modulo, capa, busqueda) y nodo enfocado. Cambiar capa o busqueda quita el foco.
function useGraphFilters() {
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedLayer, setSelectedLayer] = useState("");
  const [query, setQuery] = useState("");
  const focusedNodeId = useArchitectureFocusStore((state) => state.focusedNodeId);
  const setFocusedNodeId = useArchitectureFocusStore((state) => state.setFocusedNodeId);
  const clearFocus = useCallback(() => setFocusedNodeId(null), []);

  return {
    selectedModule,
    setSelectedModule,
    selectedLayer,
    query,
    focusedNodeId,
    setFocusedNodeId,
    clearFocus,
    changeLayer: (layer: string) => {
      setSelectedLayer(layer);
      clearFocus();
    },
    changeQuery: (nextQuery: string) => {
      setQuery(nextQuery);
      clearFocus();
    },
  };
}

export function useArchitectureGraphController(dependencies: ArchitectureProviders, target: ArchitectureTarget) {
  const filters = useGraphFilters();
  const { selectedModule, selectedLayer, query, focusedNodeId } = filters;
  const { graph, loading, error, load } = useArchitectureGraphData(dependencies, target, filters.clearFocus);

  const refresh = useCallback((module = selectedModule) => load(module), [load, selectedModule]);

  useEffect(() => {
    void load("");
  }, [load]);

  const modules = useMemo(() => (graph ? Array.from(new Set(graph.nodes.map((node) => node.module))).sort() : []), [graph]);
  const filteredGraph = useMemo(
    () => filterArchitectureGraph(graph, { focusedNodeId, selectedModule, selectedLayer, query }),
    [focusedNodeId, graph, query, selectedLayer, selectedModule],
  );
  const focusedNode = useMemo(() => graph?.nodes.find((node) => node.id === focusedNodeId) ?? null, [focusedNodeId, graph]);
  const selectedNode = useMemo(() => selectedNodeFor(filteredGraph.nodes, focusedNode, query), [filteredGraph.nodes, focusedNode, query]);

  return {
    target,
    graph,
    selectedModule,
    selectedLayer,
    query,
    focusedNodeId,
    loading,
    error,
    modules,
    filteredGraph,
    focusedNode,
    selectedNode,
    refresh,
    setFocusedNodeId: filters.setFocusedNodeId,
    changeModule: (module: string) => {
      filters.setSelectedModule(module);
      void load(module);
    },
    changeLayer: filters.changeLayer,
    changeQuery: filters.changeQuery,
  };
}
