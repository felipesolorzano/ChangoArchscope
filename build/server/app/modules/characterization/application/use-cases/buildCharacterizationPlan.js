import path from "node:path";
import { characterizationSkeletons } from "../../domain/services/characterizationSkeletons.js";
import { characterizationTargets } from "../../domain/services/characterizationTargets.js";
// Objetivos de caracterizacion con sus esqueletos: riesgo del audit + cuantos archivos importan a cada uno.
export function buildCharacterizationPlan({ snapshot, graph, sourceRoot, stack }) {
    const targets = characterizationTargets({
        stack,
        sourceRoot,
        findings: snapshot.findings,
        riskByFile: Object.fromEntries(snapshot.riskBreakdown.byFile.map((entry) => [entry.key, entry.value])),
        importersByFile: importersByFile(graph, sourceRoot),
    });
    return { targets: targets.map((target) => ({ ...target, skeletons: characterizationSkeletons(target, stack) })) };
}
/** Por archivo (ruta absoluta), cuantos archivos distintos lo importan. */
export function importersByFile({ nodes, edges }, sourceRoot) {
    const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.id, path.join(sourceRoot, node.path)]));
    const importers = new Map();
    for (const edge of edges) {
        const target = files.get(edge.target);
        if (edge.type === "import" && files.has(edge.source) && target !== undefined) {
            importers.set(target, (importers.get(target) ?? new Set()).add(edge.source));
        }
    }
    return Object.fromEntries([...importers].map(([file, sources]) => [file, sources.size]));
}
