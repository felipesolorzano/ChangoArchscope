import type { SourceTreeReader } from "../domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig } from "../domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureGraph } from "../domain/value-objects/ArchitectureGraph.js";
import type { AnalyzeOptions } from "../domain/value-objects/ArchitectureTarget.js";
import { buildLaravelGraph } from "./analyzers/laravelAnalyzer.js";
import { buildReactGraph } from "./analyzers/reactAnalyzer.js";

export function buildArchitectureGraph(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  { target = "laravel", module = null }: AnalyzeOptions = {},
): ArchitectureGraph {
  return target === "react"
    ? buildReactGraph(config, reader, module)
    : buildLaravelGraph(config, reader, module);
}
