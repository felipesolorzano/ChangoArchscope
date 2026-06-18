import path from "node:path";
import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";
const TOP_RISKIEST_FILES_LIMIT = 20;
export function buildRiskBreakdown(findings, phpRoot) {
    const byFile = buildEntries(findings, (finding) => finding.file);
    const byClass = buildEntries(findings.filter((finding) => finding.class !== null), (finding) => `${finding.file}#${finding.class}`);
    const byModule = buildEntries(findings.filter((finding) => moduleOf(finding, phpRoot) !== null), (finding) => moduleOf(finding, phpRoot));
    return {
        byFile,
        byClass,
        byModule,
        topRiskiestFiles: byFile.slice(0, TOP_RISKIEST_FILES_LIMIT),
    };
}
function moduleOf(finding, phpRoot) {
    if (finding.module !== "") {
        return finding.module;
    }
    if (phpRoot === undefined) {
        return null;
    }
    const [firstSegment] = path.relative(phpRoot, finding.file).split(path.sep);
    return firstSegment ?? null;
}
function buildEntries(findings, keyFn) {
    const entries = new Map();
    for (const finding of findings) {
        const key = keyFn(finding);
        const weight = SEVERITY_WEIGHTS[finding.severity];
        const entry = entries.get(key) ?? { key, value: 0, byCategory: {}, findingsCount: 0 };
        entry.value += weight;
        entry.byCategory[finding.category] = (entry.byCategory[finding.category] ?? 0) + weight;
        entry.findingsCount += 1;
        entries.set(key, entry);
    }
    return [...entries.values()].sort((a, b) => b.value - a.value);
}
