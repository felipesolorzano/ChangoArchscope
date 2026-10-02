import type { SourceTreeReader } from "../../shared/domain/repositories/SourceTreeReader.js";
import { architectureHealth } from "../domain/services/architectureHealth.js";
import type { ArchitectureConfig } from "../domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureGraph } from "../domain/value-objects/ArchitectureGraph.js";
import type { AnalyzeOptions } from "../domain/value-objects/ArchitectureTarget.js";
import { buildLaravelGraph } from "./analyzers/laravelAnalyzer.js";
import { buildReactGraph } from "./analyzers/reactAnalyzer.js";

export function buildArchitectureGraph(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  { target, module = null }: AnalyzeOptions = {},
): ArchitectureGraph {
  // Sin target (o cualquiera que no sea react) es laravel.
  const graph = target === "react" ? buildReactGraph(config, reader, module) : buildLaravelGraph(config, reader, module);

  return { ...graph, health: architectureHealth(graph.nodes, graph.edges) };
}
