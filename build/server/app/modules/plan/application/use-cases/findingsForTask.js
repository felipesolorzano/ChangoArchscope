import { findDuplicateMigrationPairs } from "../../domain/services/findDuplicateMigrationPairs.js";
import { DUPLICATE_FILES_TASK, SKIPPED_FILES_TASK, TASK_RULES, matchesSelectors } from "../../domain/services/planTaskRules.js";
const ITEMS_LIMIT = 100;
export function findingsForTask(snapshot, taskKey, dependencies) {
    const items = dependencies?.items[taskKey] ?? collectItems(snapshot, taskKey);
    return { taskKey, total: items.length, items: items.slice(0, ITEMS_LIMIT) };
}
function collectItems(snapshot, taskKey) {
    const selectors = TASK_RULES[taskKey];
    if (selectors !== undefined) {
        return snapshot.findings
            .filter((finding) => matchesSelectors(selectors, finding.rule, finding.severity))
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
    return findDuplicateMigrationPairs(fileKeys).map(({ file, original }) => ({
        file,
        line: 0,
        rule: "duplicate-file",
        severity: "medium",
        message: `Duplicado de ${original}`,
    }));
}
