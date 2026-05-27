import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import { loadArchitectureGraph } from "../../application/use-cases/loadArchitectureGraph";
import type { ArchitectureGraph } from "../../domain/value-objects/ArchitectureGraph";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";
import {
  filterArchitectureGraph,
  type FilteredArchitectureGraph,
} from "../utils/filterArchitectureGraph";

export function useArchitectureGraphController(dependencies: ArchitectureProviders) {
  const [target, setTarget] = useState<ArchitectureTarget>("laravel");
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedLayer, setSelectedLayer] = useState("");
  const [query, setQuery] = useState("");
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (module = selectedModule, nextTarget = target) => {
      setLoading(true);
      setError(null);
      setFocusedNodeId(null);

      try {
        setGraph(await loadArchitectureGraph(dependencies.graphProvider, module || undefined, nextTarget));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el grafo");
      } finally {
        setLoading(false);
      }
    },
    [dependencies.graphProvider, selectedModule, target]
  );

  useEffect(() => {
    refresh("", target);
  }, [refresh, target]);

  const modules = useMemo(() => {
    if (!graph) return [];

    return Array.from(new Set(graph.nodes.map((node) => node.module))).sort();
  }, [graph]);

  const filteredGraph: FilteredArchitectureGraph = useMemo(
    () =>
      filterArchitectureGraph(graph, {
        focusedNodeId,
        selectedModule,
        selectedLayer,
        query,
      }),
    [focusedNodeId, graph, query, selectedLayer, selectedModule]
  );

  const focusedNode = useMemo(() => {
    if (!focusedNodeId || !graph) return null;

    return graph.nodes.find((node) => node.id === focusedNodeId) ?? null;
  }, [focusedNodeId, graph]);

  const selectedNode = useMemo(() => {
    if (focusedNode) return focusedNode;
    if (!query.trim()) return null;

    return filteredGraph.nodes.find((node) =>
      node.path.toLowerCase().includes(query.trim().toLowerCase())
    ) ?? null;
  }, [filteredGraph.nodes, focusedNode, query]);

  function changeTarget(nextTarget: ArchitectureTarget) {
    setTarget(nextTarget);
    setSelectedModule("");
    setSelectedLayer("");
    setFocusedNodeId(null);
  }

  function changeModule(module: string) {
    setSelectedModule(module);
    refresh(module, target);
  }

  function changeLayer(layer: string) {
    setSelectedLayer(layer);
    setFocusedNodeId(null);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setFocusedNodeId(null);
  }

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
    setFocusedNodeId,
    changeTarget,
    changeModule,
    changeLayer,
    changeQuery,
  };
}
