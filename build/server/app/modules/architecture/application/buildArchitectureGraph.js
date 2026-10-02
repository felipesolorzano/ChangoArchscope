import { architectureHealth } from "../domain/services/architectureHealth.js";
import { buildLaravelGraph } from "./analyzers/laravelAnalyzer.js";
import { buildReactGraph } from "./analyzers/reactAnalyzer.js";
export function buildArchitectureGraph(config, reader, { target, module = null } = {}) {
    // Sin target (o cualquiera que no sea react) es laravel.
    const graph = target === "react" ? buildReactGraph(config, reader, module) : buildLaravelGraph(config, reader, module);
    return { ...graph, health: architectureHealth(graph.nodes, graph.edges) };
}
