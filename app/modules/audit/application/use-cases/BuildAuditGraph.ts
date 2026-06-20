import path from "node:path";

import type { AuditSnapshot, RiskEntry } from "../../domain/value-objects/AuditSnapshot.js";
import type { AuditGraph, AuditGraphEdge, AuditGraphNode, AuditGraphView } from "../../domain/value-objects/AuditGraph.js";
import {
  MAX_NODE_SIZE,
  dominantAccent,
  foldSeverityMix,
  gridPositions,
  overviewPositions,
  sizeForRisk,
  toneForSeverity,
} from "../../domain/services/auditGraphLayout.js";
import { findDuplicateEdges } from "../../domain/services/auditDuplicates.js";
import { aggregateFileRules } from "../../domain/services/auditFileRules.js";

export type BuildAuditGraphOptions = {
  view?: AuditGraphView;
  focus?: string | null;
  phpRoot?: string | null;
};

const APP_FILE_LIMIT = 24;
const FILE_RULE_LIMIT = 24;
const RULE_FINDINGS_LIMIT = 50;
const HEATMAP_LIMIT = 60;
const GRID_COLUMNS = 6;
const HEATMAP_COLUMNS = 8;

export function buildAuditGraph(snapshot: AuditSnapshot, options: BuildAuditGraphOptions = {}): AuditGraph {
  const focus = options.focus ?? null;
  const phpRoot = options.phpRoot ?? null;

  if (phpRoot !== null) {
    if (options.view === "heatmap") {
      return buildHeatmapView(snapshot, phpRoot);
    }

    if (focus !== null && options.view === "app") {
      return buildAppView(snapshot, focus, phpRoot);
    }

    if (focus !== null && options.view === "file") {
      return buildFileView(snapshot, focus, phpRoot);
    }
  }

  return buildOverview(snapshot, focus);
}

function buildOverview(snapshot: AuditSnapshot, focus: string | null): AuditGraph {
  const apps = snapshot.riskBreakdown.byModule;
  const maxRisk = apps.reduce((max, app) => Math.max(max, app.value), 0);
  const positions = overviewPositions(apps.length);

  const rootNode: AuditGraphNode = {
    id: "root",
    type: "root",
    label: snapshot.module ?? "proyecto",
    position: { x: 0, y: 0 },
    size: MAX_NODE_SIZE,
    tone: toneForSeverity(snapshot.summary.by_severity),
    accent: dominantAccent(snapshot.summary.by_category),
    severityMix: foldSeverityMix(snapshot.summary.by_severity),
    metrics: { findings: snapshot.summary.findings_count, risk: snapshot.riskScore.value },
    badges: topCategoryBadges(snapshot.summary.by_category),
    drill: apps.length > 0,
  };

  const appNodes: AuditGraphNode[] = apps.map((app, index) =>
    entryNode(app, `app:${app.key}`, "app", app.key, positions[index], sizeForRisk(app.value, maxRisk), true),
  );

  const edges: AuditGraphEdge[] = apps.map((app) => containsEdge("root", `app:${app.key}`));

  return graph(snapshot, "overview", focus, [rootNode, ...appNodes], edges);
}

function buildHeatmapView(snapshot: AuditSnapshot, phpRoot: string): AuditGraph {
  const files = [...snapshot.riskBreakdown.byFile]
    .sort((a, b) => b.findingsCount - a.findingsCount)
    .slice(0, HEATMAP_LIMIT);
  const maxFindings = files.reduce((max, file) => Math.max(max, file.findingsCount), 0);
  const positions = gridPositions(files.length, HEATMAP_COLUMNS);

  const nodes: AuditGraphNode[] = files.map((file, index) =>
    entryNode(
      file,
      `file:${relativePosix(phpRoot, file.key)}`,
      "file",
      path.basename(file.key),
      positions[index],
      sizeForRisk(file.findingsCount, maxFindings),
      true,
    ),
  );

  return graph(snapshot, "heatmap", null, nodes, []);
}

function buildAppView(snapshot: AuditSnapshot, focus: string, phpRoot: string): AuditGraph {
  const files = snapshot.riskBreakdown.byFile
    .filter((file) => appOf(file.key, phpRoot) === focus)
    .slice(0, APP_FILE_LIMIT);
  const maxRisk = files.reduce((max, file) => Math.max(max, file.value), 0);
  const positions = gridPositions(files.length, GRID_COLUMNS);
  const appEntry = snapshot.riskBreakdown.byModule.find((app) => app.key === focus);

  const appNode: AuditGraphNode = entryNode(
    appEntry ?? emptyEntry(focus),
    `app:${focus}`,
    "app",
    focus,
    { x: 0, y: 0 },
    MAX_NODE_SIZE,
    false,
  );

  const fileNodes: AuditGraphNode[] = files.map((file, index) => {
    const id = `file:${relativePosix(phpRoot, file.key)}`;
    return entryNode(file, id, "file", path.basename(file.key), positions[index], sizeForRisk(file.value, maxRisk), false);
  });

  const containsEdges = fileNodes.map((file) => containsEdge(appNode.id, file.id));
  const duplicateEdges = findDuplicateEdges(fileNodes.map((file) => ({ id: file.id, label: file.label })));

  return graph(snapshot, "app", focus, [appNode, ...fileNodes], [...containsEdges, ...duplicateEdges]);
}

function buildFileView(snapshot: AuditSnapshot, focus: string, phpRoot: string): AuditGraph {
  const fileFindings = snapshot.findings.filter((finding) => relativePosix(phpRoot, finding.file) === focus);
  const rules = aggregateFileRules(fileFindings).slice(0, FILE_RULE_LIMIT);
  const maxRisk = rules.reduce((max, rule) => Math.max(max, rule.risk), 0);
  const positions = gridPositions(rules.length, GRID_COLUMNS);
  const fileEntry = snapshot.riskBreakdown.byFile.find((file) => relativePosix(phpRoot, file.key) === focus);

  const fileNode: AuditGraphNode = entryNode(
    fileEntry ?? emptyEntry(focus),
    `file:${focus}`,
    "file",
    path.basename(focus),
    { x: 0, y: 0 },
    MAX_NODE_SIZE,
    false,
  );

  const ruleNodes: AuditGraphNode[] = rules.map((rule, index) => ({
    ...entryNode(
      { key: rule.rule, value: rule.risk, byCategory: { [rule.category]: rule.risk }, bySeverity: rule.bySeverity, findingsCount: rule.findingsCount },
      `rule:${focus}:${rule.rule}`,
      "rule",
      rule.rule,
      positions[index],
      sizeForRisk(rule.risk, maxRisk),
      false,
    ),
    findings: rule.findings.slice(0, RULE_FINDINGS_LIMIT),
  }));

  const edges = ruleNodes.map((rule) => containsEdge(fileNode.id, rule.id));

  return graph(snapshot, "file", focus, [fileNode, ...ruleNodes], edges);
}

function entryNode(
  entry: RiskEntry,
  id: string,
  type: AuditGraphNode["type"],
  label: string,
  position: AuditGraphNode["position"],
  size: number,
  drill: boolean,
): AuditGraphNode {
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
    badges: topCategoryBadges(entry.byCategory),
    drill,
  };
}

function containsEdge(source: string, target: string): AuditGraphEdge {
  return { id: `contains:${source}:${target}`, source, target, kind: "contains" };
}

function graph(
  snapshot: AuditSnapshot,
  view: AuditGraphView,
  focus: string | null,
  nodes: AuditGraphNode[],
  edges: AuditGraphEdge[],
): AuditGraph {
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

function appOf(fileKey: string, phpRoot: string): string {
  return relativePosix(phpRoot, fileKey).split("/")[0];
}

function relativePosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

function emptyEntry(key: string): RiskEntry {
  return { key, value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0 };
}

function topCategoryBadges(byCategory: Record<string, number>): string[] {
  return Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([category]) => category);
}
