import { findImportCycles } from "./importCycles.js";
const RANK_LIMIT = 10;
// KPIs del grafo: ciclos, acoplamiento entre modulos y archivos de los que depende medio proyecto.
export function architectureHealth(nodes, edges) {
    const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.id, node]));
    const modules = new Map(nodes.map((node) => [node.id, node.module]));
    const imports = edges.filter((edge) => edge.type === "import");
    const pairs = new Set(imports.filter((edge) => files.has(edge.source) && files.has(edge.target)).map((edge) => `${edge.source}|${edge.target}`));
    const crossModule = imports.filter((edge) => edge.crossModule);
    const cycles = findImportCycles(nodes, edges);
    return {
        summary: {
            files: files.size,
            imports: pairs.size,
            crossModuleImports: crossModule.length,
            modulePairs: new Set(crossModule.map((edge) => `${modules.get(edge.source)}|${modules.get(edge.target)}`)).size,
            cycles: cycles.length,
            filesInCycles: cycles.reduce((total, cycle) => total + cycle.files.length, 0),
            largestCycle: Math.max(0, ...cycles.map((cycle) => cycle.files.length)),
        },
        cycles,
        mostImported: rank([...pairs].map((pair) => pair.split("|")[1]), files),
        mostImporting: rank([...pairs].map((pair) => pair.split("|")[0]), files),
    };
}
function rank(ids, files) {
    const counts = new Map();
    for (const id of ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts]
        .map(([id, count]) => ({ path: files.get(id).path, module: files.get(id).module, count }))
        .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
        .slice(0, RANK_LIMIT);
}
