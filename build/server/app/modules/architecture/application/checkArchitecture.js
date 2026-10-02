import path from "node:path";
import { findImportCycles } from "../domain/services/importCycles.js";
import { buildLaravelGraph, checkLaravelArchitecture } from "./analyzers/laravelAnalyzer.js";
import { buildReactGraph, checkReactArchitecture } from "./analyzers/reactAnalyzer.js";
export function checkArchitecture(config, reader, { target = "laravel", module = null, failOnCoupling = true } = {}) {
    const result = target === "react"
        ? checkReactArchitecture(config, reader, module, failOnCoupling)
        : checkLaravelArchitecture(config, reader, module, failOnCoupling);
    const graph = target === "react" ? buildReactGraph(config, reader, module) : buildLaravelGraph(config, reader, module);
    const root = config[target].modulesPath;
    // Ciclos de imports del mismo target/modulo, anclados en la ruta absoluta de su primer archivo.
    return { ...result, cycles: findImportCycles(graph.nodes, graph.edges).map((cycle) => ({ ...cycle, file: path.join(root, cycle.files[0]) })) };
}
