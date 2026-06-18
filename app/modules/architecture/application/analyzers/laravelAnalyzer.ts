import crypto from "node:crypto";
import path from "node:path";

import type { SourceTreeReader } from "../../domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig } from "../../domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../domain/value-objects/ArchitectureCheckReport.js";
import type { ArchitectureEdge, ArchitectureGraph, ArchitectureNode } from "../../domain/value-objects/ArchitectureGraph.js";
import { nowIso, relativePosix } from "../../domain/services/architecturePathUtils.js";
import { phpImports, type ImportReference } from "./phpImports.js";
import { checkResponse, issue, report } from "./reports.js";

type LaravelTarget = {
  module: string;
  file: string | null;
};

export function buildLaravelGraph(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  onlyModule: string | null = null,
): ArchitectureGraph {
  const modulesPath = config.laravel.modulesPath;
  const modules = laravelModules(config, reader, onlyModule);
  const nodes: ArchitectureNode[] = [];
  const nodeIds = new Set<string>();
  const edges: ArchitectureEdge[] = [];

  for (const [module, modulePath] of modules) {
    const moduleNodeId = `module:${module}`;
    addNode(nodes, nodeIds, moduleNode(moduleNodeId, module, modulePath));

    for (const file of reader.walkFiles(modulePath, [".php"])) {
      const relative = relativePosix(modulesPath, file);
      const layer = laravelLayerFor(config, modulePath, file);
      const fileNodeId = `file:${relative}`;

      addNode(nodes, nodeIds, {
        id: fileNodeId,
        type: "file",
        label: path.basename(file),
        module,
        layer,
        path: relative,
        ...laravelRoleFor(relative, layer),
      });

      edges.push({
        id: `contains:${moduleNodeId}:${fileNodeId}`,
        source: moduleNodeId,
        target: fileNodeId,
        type: "contains",
        label: "contains",
        crossModule: false,
      });

      phpImports(file, reader).forEach((importItem, importIndex) => {
        const target = targetForLaravelImport(config, reader, importItem.import);

        if (!target) {
          return;
        }

        const targetModuleNodeId = `module:${target.module}`;
        const targetNodeId = target.file ? `file:${target.file}` : targetModuleNodeId;
        addNode(nodes, nodeIds, moduleNode(targetModuleNodeId, target.module, path.join(modulesPath, target.module)));

        if (target.file) {
          const targetAbsoluteFile = path.join(modulesPath, target.file);
          const targetModulePath = path.join(modulesPath, target.module);
          const targetLayer = reader.isFile(targetAbsoluteFile) ? laravelLayerFor(config, targetModulePath, targetAbsoluteFile) : null;

          addNode(nodes, nodeIds, {
            id: targetNodeId,
            type: "file",
            label: path.basename(target.file),
            module: target.module,
            layer: targetLayer,
            path: target.file,
            ...laravelRoleFor(target.file, targetLayer),
          });
        }

        edges.push({
          id: `imports:${hash(`${fileNodeId}:${targetNodeId}:${importItem.import}:${importItem.line}:${importIndex}`)}`,
          source: fileNodeId,
          target: targetNodeId,
          type: "import",
          label: importItem.import.split("\\").pop() ?? importItem.import,
          import: importItem.import,
          line: importItem.line,
          crossModule: target.module !== module,
        });
      });
    }
  }

  return graphResponse(modules, nodes, edges);
}

export function checkLaravelArchitecture(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  onlyModule: string | null = null,
  failOnCoupling = true,
): ArchitectureCheckResult {
  const reports = laravelModules(config, reader, onlyModule).map(([module, modulePath]) => {
    const scannedFiles = reader.walkFiles(modulePath, [".php"]);
    const violations = [];
    const couplings = [];

    for (const file of scannedFiles) {
      const layer = laravelLayerFor(config, modulePath, file);

      if (!layer) {
        continue;
      }

      for (const importItem of phpImports(file, reader)) {
        const coupling = laravelCouplingFor(config, reader, module, layer, file, importItem);

        if (coupling) {
          couplings.push(coupling);
        }

        for (const rule of config.laravel.forbiddenImports[layer] ?? []) {
          if (!new RegExp(rule.pattern).test(importItem.import)) {
            continue;
          }

          violations.push(issue({
            module,
            layer,
            file,
            line: importItem.line,
            importName: importItem.import,
            message: rule.message,
            suggestion: rule.suggestion,
          }));
        }
      }
    }

    return report({ module, modulePath, scannedFiles, violations, couplings, failOnCoupling });
  });

  return checkResponse({ target: "laravel", module: onlyModule, reports, failOnCoupling, checkedAt: nowIso() });
}

function laravelModules(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  onlyModule: string | null,
): Array<[string, string]> {
  return reader
    .listDirectories(config.laravel.modulesPath)
    .map((modulePath): [string, string] => [path.basename(modulePath), modulePath])
    .filter(([module]) => !onlyModule || studly(onlyModule) === module);
}

function laravelLayerFor(config: ArchitectureConfig, modulePath: string, file: string): string | null {
  const firstSegment = relativePosix(modulePath, file).split("/")[0];
  return config.laravel.layers.includes(firstSegment) ? firstSegment : null;
}

function targetForLaravelImport(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  importName: string,
): LaravelTarget | null {
  const namespacePattern = escapeRegExp(config.laravel.namespaceRoot);
  const match = importName.match(new RegExp(`^${namespacePattern}\\\\([^\\\\]+)\\\\(.+)$`));

  if (!match) {
    return null;
  }

  const module = match[1];
  const relativeClass = `${match[2].replaceAll("\\", path.sep)}.php`;
  const absoluteFile = path.join(config.laravel.modulesPath, module, relativeClass);
  const relativeFile = `${module}/${relativeClass.split(path.sep).join("/")}`;

  return {
    module,
    file: reader.isFile(absoluteFile) ? relativeFile : null,
  };
}

function laravelCouplingFor(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  module: string,
  layer: string,
  file: string,
  importItem: ImportReference,
) {
  const coupling = config.laravel.coupling;

  if (!coupling.enabled) {
    return null;
  }

  const target = targetForLaravelImport(config, reader, importItem.import);

  if (!target || target.module === module) {
    return null;
  }

  if ((coupling.ignoredModules ?? []).includes(target.module)) {
    return null;
  }

  const allowed = [
    ...(coupling.allowedDependencies?.[module] ?? []),
    ...(coupling.allowedDependencies?.["*"] ?? []),
  ];

  if (allowed.includes(target.module)) {
    return null;
  }

  return issue({
    module,
    targetModule: target.module,
    layer,
    file,
    line: importItem.line,
    importName: importItem.import,
    message: coupling.message,
    suggestion: coupling.suggestion,
    assessment: coupling.defaultAssessment,
    recommendation: coupling.defaultRecommendation,
    action: coupling.defaultAction,
  });
}

function laravelRoleFor(filePath: string, layer: string | null): { role: string | null; role_label: string | null } {
  const normalized = filePath.replaceAll("\\", "/");
  const label = path.basename(normalized).toLowerCase();

  if (normalized.includes("/Application/Contracts/") || normalized.includes("/Application/Repositories/")) {
    return { role: "connector", role_label: "Conector" };
  }

  if (normalized.includes("/Infrastructure/Providers/")) {
    return { role: "provider", role_label: "Provider" };
  }

  if (normalized.includes("/Infrastructure/Persistence/")) {
    return { role: "persistence_adapter", role_label: "Adaptador persistencia" };
  }

  if (normalized.includes("/Infrastructure/")) {
    return { role: "adapter", role_label: "Adaptador" };
  }

  if (normalized.includes("/Presentation/Http/Controllers/")) {
    return { role: "controller", role_label: "Controlador" };
  }

  if (normalized.includes("/Application/UseCases/")) {
    return { role: "use_case", role_label: "Caso de uso" };
  }

  if (normalized.includes("/Domain/ValueObjects/")) {
    return { role: "value_object", role_label: "Value Object" };
  }

  if (label.endsWith("controller.php")) {
    return { role: "controller", role_label: "Controlador" };
  }

  return { role: layer ? layer.toLowerCase() : null, role_label: layer };
}

function moduleNode(id: string, module: string, modulePath: string): ArchitectureNode {
  return {
    id,
    type: "module",
    label: module,
    module,
    layer: null,
    path: modulePath,
    role: "module",
    role_label: "Modulo",
  };
}

function graphResponse(
  modules: Array<[string, string]>,
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
): ArchitectureGraph {
  return {
    generated_at: nowIso(),
    summary: {
      modules: modules.length,
      nodes: nodes.length,
      edges: edges.length,
      cross_module_edges: edges.filter((edge) => edge.crossModule).length,
    },
    nodes,
    edges,
  };
}

function addNode(nodes: ArchitectureNode[], nodeIds: Set<string>, node: ArchitectureNode): void {
  if (nodeIds.has(node.id)) {
    return;
  }

  nodeIds.add(node.id);
  nodes.push(node);
}

function hash(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function studly(value: string): string {
  return String(value)
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ""))
    .replace(/^(.)/, (_, chr) => chr.toUpperCase());
}
