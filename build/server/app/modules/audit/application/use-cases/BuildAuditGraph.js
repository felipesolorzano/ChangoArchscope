import path from "node:path";
import { MAX_NODE_SIZE, MIN_NODE_SIZE, dominantAccent, foldSeverityMix, gridPositions, overviewPositions, sizeForRisk, toneForSeverity, } from "../../domain/services/auditGraphLayout.js";
import { findDuplicateEdges } from "../../domain/services/auditDuplicates.js";
import { aggregateFileRules } from "../../domain/services/auditFileRules.js";
const APP_FILE_LIMIT = 24;
const FILE_RULE_LIMIT = 24;
const RULE_FINDINGS_LIMIT = 50;
const HEATMAP_LIMIT = 60;
const GRID_COLUMNS = 6;
const HEATMAP_COLUMNS = 8;
export function buildAuditGraph(snapshot, options = {}) {
    const focus = options.focus ?? null;
    const sourceRoot = options.sourceRoot ?? null;
    if (sourceRoot !== null) {
        if (options.view === "heatmap") {
            return buildHeatmapView(snapshot, sourceRoot);
        }
        if (focus !== null && options.view === "app") {
            return buildAppView(snapshot, focus, sourceRoot);
        }
        if (focus !== null && options.view === "file") {
            return buildFileView(snapshot, focus, sourceRoot);
        }
    }
    return buildOverview(snapshot, focus, sourceRoot);
}
// Universo de archivos: los escaneados mas los que tienen hallazgos sin haber pasado por el parser.
function fileUniverse(snapshot) {
    return [...new Set([...snapshot.scannedFiles, ...snapshot.riskBreakdown.byFile.map((file) => file.key)])];
}
function healthOf(snapshot, files) {
    const withFindings = new Set(snapshot.riskBreakdown.byFile.map((file) => file.key));
    return { files: files.length, withFindings: files.filter((file) => withFindings.has(file)).length };
}
function buildOverview(snapshot, focus, sourceRoot) {
    const universe = fileUniverse(snapshot);
    const riskyApps = snapshot.riskBreakdown.byModule;
    const riskyKeys = new Set(riskyApps.map((app) => app.key));
    // Con raiz conocida, tambien las carpetas sanas (sin hallazgos), despues y en orden alfabetico.
    const healthyApps = sourceRoot === null
        ? []
        : [...new Set(universe.map((file) => appOf(file, sourceRoot)))].filter((app) => !riskyKeys.has(app)).sort().map(emptyEntry);
    const apps = [...riskyApps, ...healthyApps];
    const maxRisk = apps.reduce((max, app) => Math.max(max, app.value), 0);
    const positions = overviewPositions(apps.length);
    const rootNode = {
        id: "root",
        type: "root",
        label: snapshot.module ?? "proyecto",
        position: { x: 0, y: 0 },
        size: MAX_NODE_SIZE,
        tone: toneForSeverity(snapshot.summary.by_severity),
        accent: dominantAccent(snapshot.summary.by_category),
        severityMix: foldSeverityMix(snapshot.summary.by_severity),
        metrics: { findings: snapshot.summary.findings_count, risk: snapshot.riskScore.value },
        byCategory: snapshot.summary.by_category,
        badges: topCategoryBadges(snapshot.summary.by_category),
        drill: apps.length > 0,
        health: healthOf(snapshot, universe),
    };
    const appNodes = apps.map((app, index) => ({
        ...entryNode(app, `app:${app.key}`, "app", app.key, positions[index], sizeForRisk(app.value, maxRisk), true),
        ...(sourceRoot === null ? {} : { health: healthOf(snapshot, universe.filter((file) => appOf(file, sourceRoot) === app.key)) }),
    }));
    const edges = apps.map((app) => containsEdge("root", `app:${app.key}`));
    return graph(snapshot, "overview", focus, [rootNode, ...appNodes], edges);
}
function buildHeatmapView(snapshot, sourceRoot) {
    const files = [...snapshot.riskBreakdown.byFile]
        .sort((a, b) => b.findingsCount - a.findingsCount)
        .slice(0, HEATMAP_LIMIT);
    const maxFindings = files.reduce((max, file) => Math.max(max, file.findingsCount), 0);
    const positions = gridPositions(files.length, HEATMAP_COLUMNS);
    const nodes = files.map((file, index) => ({
        ...entryNode(file, `file:${relativePosix(sourceRoot, file.key)}`, "file", path.basename(file.key), positions[index], sizeForRisk(file.findingsCount, maxFindings), true),
        health: { files: 1, withFindings: 1 },
    }));
    return graph(snapshot, "heatmap", null, nodes, []);
}
function buildAppView(snapshot, focus, sourceRoot) {
    const files = snapshot.riskBreakdown.byFile
        .filter((file) => appOf(file.key, sourceRoot) === focus)
        .slice(0, APP_FILE_LIMIT);
    const withFindings = new Set(snapshot.riskBreakdown.byFile.map((file) => file.key));
    const appFiles = fileUniverse(snapshot).filter((file) => appOf(file, sourceRoot) === focus);
    // Los sanos completan la grilla hasta el limite, en orden alfabetico.
    const healthyFiles = appFiles
        .filter((file) => !withFindings.has(file))
        .sort()
        .slice(0, APP_FILE_LIMIT - files.length);
    const maxRisk = files.reduce((max, file) => Math.max(max, file.value), 0);
    const positions = gridPositions(files.length + healthyFiles.length, GRID_COLUMNS);
    const appEntry = snapshot.riskBreakdown.byModule.find((app) => app.key === focus);
    const appNode = {
        ...entryNode(appEntry ?? emptyEntry(focus), `app:${focus}`, "app", focus, { x: 0, y: 0 }, MAX_NODE_SIZE, false),
        health: healthOf(snapshot, appFiles),
    };
    const fileNodes = [
        ...files.map((file, index) => ({
            ...entryNode(file, `file:${relativePosix(sourceRoot, file.key)}`, "file", path.basename(file.key), positions[index], sizeForRisk(file.value, maxRisk), false),
            health: { files: 1, withFindings: 1 },
        })),
        ...healthyFiles.map((file, index) => ({
            ...entryNode(emptyEntry(file), `file:${relativePosix(sourceRoot, file)}`, "file", path.basename(file), positions[files.length + index], MIN_NODE_SIZE, false),
            health: { files: 1, withFindings: 0 },
        })),
    ];
    const containsEdges = fileNodes.map((file) => containsEdge(appNode.id, file.id));
    const duplicateEdges = findDuplicateEdges(fileNodes.map((file) => ({ id: file.id, label: file.label })));
    return graph(snapshot, "app", focus, [appNode, ...fileNodes], [...containsEdges, ...duplicateEdges]);
}
function buildFileView(snapshot, focus, sourceRoot) {
    const fileFindings = snapshot.findings.filter((finding) => relativePosix(sourceRoot, finding.file) === focus);
    const rules = aggregateFileRules(fileFindings).slice(0, FILE_RULE_LIMIT);
    const maxRisk = rules.reduce((max, rule) => Math.max(max, rule.risk), 0);
    const positions = gridPositions(rules.length, GRID_COLUMNS);
    const fileEntry = snapshot.riskBreakdown.byFile.find((file) => relativePosix(sourceRoot, file.key) === focus);
    const fileNode = {
        ...entryNode(fileEntry ?? emptyEntry(focus), `file:${focus}`, "file", path.basename(focus), { x: 0, y: 0 }, MAX_NODE_SIZE, false),
        health: { files: 1, withFindings: fileEntry === undefined ? 0 : 1 },
    };
    const ruleNodes = rules.map((rule, index) => ({
        ...entryNode({ key: rule.rule, value: rule.risk, byCategory: { [rule.category]: rule.risk }, bySeverity: rule.bySeverity, findingsCount: rule.findingsCount }, `rule:${focus}:${rule.rule}`, "rule", rule.rule, positions[index], sizeForRisk(rule.risk, maxRisk), false),
        findings: rule.findings.slice(0, RULE_FINDINGS_LIMIT),
    }));
    const edges = ruleNodes.map((rule) => containsEdge(fileNode.id, rule.id));
    return graph(snapshot, "file", focus, [fileNode, ...ruleNodes], edges);
}
function entryNode(entry, id, type, label, position, size, drill) {
    return {
        id,
        type,
        label,
        position,
        size,
        tone: toneForSeverity(entry.bySeverity),
        accent: dominantAccent(entry.byCategory),
        severityMix: foldSeverityMix(entry.bySeverity),
        metrics: { findings: entry.findingsCount, risk: entry.value },
        byCategory: entry.byCategory,
        badges: topCategoryBadges(entry.byCategory),
        drill,
    };
}
function containsEdge(source, target) {
    return { id: `contains:${source}:${target}`, source, target, kind: "contains" };
}
function graph(snapshot, view, focus, nodes, edges) {
    return {
        generated_at: snapshot.generatedAt,
        view,
        focus,
        summary: {
            nodes: nodes.length,
            edges: edges.length,
            findings: snapshot.summary.findings_count,
            risk: snapshot.riskScore.value,
        },
        nodes,
        edges,
    };
}
function appOf(fileKey, sourceRoot) {
    return relativePosix(sourceRoot, fileKey).split("/")[0];
}
function relativePosix(from, to) {
    return path.relative(from, to).split(path.sep).join("/");
}
function emptyEntry(key) {
    return { key, value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0 };
}
function topCategoryBadges(byCategory) {
    return Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([category]) => category);
}
