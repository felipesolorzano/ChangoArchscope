import { DUPLICATE_FILES_TASK, SKIPPED_FILES_TASK, TASK_RULES } from "../../domain/services/planTaskRules.js";
const ITEMS_LIMIT = 100;
export function findingsForTask(snapshot, taskKey) {
    const items = collectItems(snapshot, taskKey);
    return { taskKey, total: items.length, items: items.slice(0, ITEMS_LIMIT) };
}
function collectItems(snapshot, taskKey) {
    const rules = TASK_RULES[taskKey];
    if (rules !== undefined) {
        return snapshot.findings
            .filter((finding) => rules.includes(finding.rule))
            .map((finding) => ({
            file: finding.file,
            line: finding.line,
            rule: finding.rule,
            severity: finding.severity,
            message: finding.message,
        }));
    }
    if (taskKey === SKIPPED_FILES_TASK) {
        return snapshot.skippedFiles.map((skipped) => ({
            file: skipped.file,
            line: 0,
            rule: "parse-error",
            severity: "info",
            message: skipped.error,
        }));
    }
    if (taskKey === DUPLICATE_FILES_TASK) {
        return duplicateFileItems(snapshot.riskBreakdown.byFile.map((entry) => entry.key));
    }
    return [];
}
function duplicateFileItems(fileKeys) {
    const basenameToKey = new Map();
    for (const key of fileKeys) {
        const name = key.split("/").pop() ?? key;
        if (!basenameToKey.has(name)) {
            basenameToKey.set(name, key);
        }
    }
    const items = [];
    for (const key of fileKeys) {
        const name = key.split("/").pop() ?? key;
        const dot = name.indexOf(".");
        const stem = dot === -1 ? name : name.slice(0, dot);
        const extension = dot === -1 ? "" : name.slice(dot);
        if (!stem.endsWith("_new")) {
            continue;
        }
        const originalName = stem.slice(0, -"_new".length) + extension;
        if (basenameToKey.has(originalName)) {
            items.push({ file: key, line: 0, rule: "duplicate-file", severity: "medium", message: `Duplicado de ${originalName}` });
        }
    }
    return items;
}
