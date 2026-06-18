import { buildLaravelGraph } from "./analyzers/laravelAnalyzer.js";
import { buildReactGraph } from "./analyzers/reactAnalyzer.js";
export function buildArchitectureGraph(config, reader, { target = "laravel", module = null } = {}) {
    return target === "react"
        ? buildReactGraph(config, reader, module)
        : buildLaravelGraph(config, reader, module);
}
