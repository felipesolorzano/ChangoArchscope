import path from "node:path";
import { CODEMOD_CATALOG } from "./codemodCatalog.js";
const DISCARDED_RULES = new Set(["manual-copy-file", "possibly-unused-file"]);
// Hallazgos de APIs legacy agrupados por patron, con la herramienta y que archivos tienen tests (XRay X5).
export function codemodCandidates({ stack, sourceRoot, findings, testedBy }) {
    const discarded = new Set(findings.filter((finding) => DISCARDED_RULES.has(finding.rule)).map((finding) => finding.file));
    const occurrences = new Map();
    for (const finding of findings.filter((candidate) => !discarded.has(candidate.file))) {
        const pattern = patternOf(finding, stack);
        if (pattern !== null) {
            const byFile = occurrences.get(pattern) ?? new Map();
            byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + (finding.details.count ?? 1));
            occurrences.set(pattern, byFile);
        }
    }
    const relative = (file) => path.relative(sourceRoot, file).split(path.sep).join("/");
    return [...occurrences]
        .map(([pattern, byFile]) => {
        const files = [...byFile]
            .map(([file, count]) => ({ file: relative(file), occurrences: count, testedBy: (testedBy[file] ?? []).map(relative) }))
            .sort((left, right) => right.occurrences - left.occurrences || left.file.localeCompare(right.file));
        const { title, tool, command, note, timing } = CODEMOD_CATALOG[pattern];
        return {
            pattern,
            title,
            tool,
            command: command?.replace("{paths}", files.map((file) => `"${file.file}"`).join(" ")) ?? null,
            note,
            timing,
            files,
            occurrences: files.reduce((sum, file) => sum + file.occurrences, 0),
            protectedFiles: files.filter((file) => file.testedBy.length > 0).length,
        };
    })
        // Primero lo que se migra antes de actualizar (XRay X6), despues los automaticos.
        .sort((left, right) => Number(right.timing === "before-upgrade") - Number(left.timing === "before-upgrade") ||
        Number(right.tool !== null) - Number(left.tool !== null) ||
        right.files.length - left.files.length ||
        left.pattern.localeCompare(right.pattern));
}
function patternOf(finding, stack) {
    if (finding.category !== "legacy_api" && finding.rule !== "jquery-usage") {
        return null;
    }
    const pattern = finding.rule === "jquery-usage" ? "jquery" : finding.details.pattern;
    return CODEMOD_CATALOG[pattern]?.stack === stack ? pattern : null;
}
