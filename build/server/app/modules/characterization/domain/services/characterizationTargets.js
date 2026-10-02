import path from "node:path";
import { pascalCase } from "./pascalCase.js";
const LIMIT = 20;
const UNTESTED_RULE = { react: "untested-component", laravel: "untested-complex-method" };
const EXCLUDED_RULES = new Set(["manual-copy-file", "possibly-unused-file"]);
const ENDPOINT_RULES = new Set(["http-in-component", "duplicate-endpoint", "hardcoded-api-url"]);
const PAGE_FOLDERS = new Set(["pages", "page", "routes", "views", "screens"]);
// Que proteger primero: archivos sin tests, por riesgo × peso de uso, sin copias ni codigo muerto.
export function characterizationTargets(input) {
    const byFile = groupBy(input.findings, (finding) => finding.file);
    const excluded = new Set(input.findings.filter((finding) => EXCLUDED_RULES.has(finding.rule)).map((finding) => finding.file));
    return [...byFile]
        .filter(([file, findings]) => !excluded.has(file) && findings.some((finding) => finding.rule === UNTESTED_RULE[input.stack]))
        .map(([file, findings]) => toTarget(file, findings, input))
        .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
        .slice(0, LIMIT);
}
function toTarget(absolute, findings, input) {
    const file = path.relative(input.sourceRoot, absolute).split(path.sep).join("/");
    const risk = input.riskByFile[absolute] ?? 0;
    const importers = input.importersByFile[absolute] ?? 0;
    return {
        file,
        kind: kindOf(file, input.stack),
        score: Math.round(risk * Math.log2(2 + importers)),
        risk,
        importers,
        untested: unique(findings.filter((finding) => finding.rule === UNTESTED_RULE[input.stack]).map((finding) => untestedUnit(finding, file, input.stack)), (unit) => unit.name),
        endpoints: unique(findings.filter((finding) => ENDPOINT_RULES.has(finding.rule)).map((finding) => finding.details.endpoint).filter((endpoint) => typeof endpoint === "string"), (endpoint) => endpoint),
    };
}
function kindOf(file, stack) {
    if (stack === "laravel") {
        return "php";
    }
    return file.split("/").slice(0, -1).some((folder) => PAGE_FOLDERS.has(folder)) ? "page" : "component";
}
function untestedUnit(finding, file, stack) {
    if (stack === "laravel") {
        return { name: `${finding.class}::${finding.details.method}`, complexity: null };
    }
    const original = finding.details.name;
    const isDefault = original === "default";
    // Un snapshot viejo no trae exportedAs: se asume exportado con su nombre.
    const exportedAs = "exportedAs" in finding.details ? finding.details.exportedAs : isDefault ? "default" : original;
    return { name: isDefault ? pascalCase(path.posix.parse(file).name) : original, complexity: finding.details.cyclomaticComplexity, exportedAs };
}
function groupBy(items, keyOf) {
    const groups = new Map();
    for (const item of items) {
        const group = groups.get(keyOf(item));
        if (group) {
            group.push(item);
        }
        else {
            groups.set(keyOf(item), [item]);
        }
    }
    return groups;
}
function unique(items, keyOf) {
    const seen = new Set();
    return items.filter((item) => !seen.has(keyOf(item)) && seen.add(keyOf(item)));
}
