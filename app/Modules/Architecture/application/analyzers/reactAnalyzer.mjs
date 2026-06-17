import crypto from "node:crypto";
import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { listDirectories, nowIso, relativePosix, toPosixPath, walkFiles } from "./fsUtils.mjs";
import { resolveSourceImport, tsImports } from "./tsImports.mjs";
import { checkResponse, issue, report } from "./reports.mjs";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];

export function buildReactGraph(config, onlyModule = null) {
  const modulesPath = config.react.modulesPath;
  const modules = reactModules(config, onlyModule);
  const nodes = [];
  const nodeIds = new Set();
  const edges = [];

  for (const [module, modulePath] of modules) {
    const moduleNodeId = `module:react:${module}`;
    addNode(nodes, nodeIds, reactModuleNode(moduleNodeId, module, modulePath));

    for (const file of walkFiles(modulePath, sourceExtensions)) {
      const relative = relativePosix(modulesPath, file);
      const layer = reactLayerFor(config, modulePath, file);
      const fileNodeId = `file:react:${relative}`;

      addNode(nodes, nodeIds, {
        id: fileNodeId,
        type: "file",
        label: path.basename(file),
        module,
        layer,
        path: relative,
        ...reactRoleFor(relative, layer),
      });

      edges.push({
        id: `contains:${moduleNodeId}:${fileNodeId}`,
        source: moduleNodeId,
        target: fileNodeId,
        type: "contains",
        label: "contains",
        crossModule: false,
      });

      tsImports(file).forEach((importItem, importIndex) => {
        const target = targetForReactImport(config, importItem.import, path.dirname(file));

        if (!target) {
          return;
        }

        const targetModuleNodeId = `module:react:${target.module}`;
        const targetNodeId = target.file ? `file:react:${target.file}` : targetModuleNodeId;
        addNode(nodes, nodeIds, reactModuleNode(targetModuleNodeId, target.module, path.join(modulesPath, target.module)));

        if (target.file) {
          const targetAbsoluteFile = path.join(modulesPath, target.file);
          const targetModulePath = path.join(modulesPath, target.module);
          const targetLayer = existsSync(targetAbsoluteFile) ? reactLayerFor(config, targetModulePath, targetAbsoluteFile) : null;

          addNode(nodes, nodeIds, {
            id: targetNodeId,
            type: "file",
            label: path.basename(target.file),
            module: target.module,
            layer: targetLayer,
            path: target.file,
            ...reactRoleFor(target.file, targetLayer),
          });
        }

        edges.push({
          id: `imports:react:${hash(`${fileNodeId}:${targetNodeId}:${importItem.import}:${importItem.line}:${importIndex}`)}`,
          source: fileNodeId,
          target: targetNodeId,
          type: "import",
          label: path.basename(importItem.import),
          import: importItem.import,
          line: importItem.line,
          crossModule: target.module !== module,
        });
      });
    }
  }

  return graphResponse(modules, nodes, edges);
}

export function checkReactArchitecture(config, onlyModule = null, failOnCoupling = true) {
  const reports = reactModules(config, onlyModule).map(([module, modulePath]) => {
    const scannedFiles = walkFiles(modulePath, sourceExtensions);
    const violations = [];
    const couplings = [];

    for (const file of scannedFiles) {
      const layer = reactLayerFor(config, modulePath, file);

      if (!layer) {
        continue;
      }

      for (const importItem of tsImports(file)) {
        const coupling = reactCouplingFor(config, module, layer, file, importItem);

        if (coupling) {
          couplings.push(coupling);
        }

        for (const rule of config.react.forbiddenImports[layer] ?? []) {
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

  return checkResponse({ target: "react", module: onlyModule, reports, failOnCoupling, checkedAt: nowIso() });
}

function reactModules(config, onlyModule) {
  return listDirectories(config.react.modulesPath)
    .map((modulePath) => [path.basename(modulePath), modulePath])
    .filter(([module]) => !onlyModule || onlyModule.toLowerCase() === module.toLowerCase());
}

function reactLayerFor(config, modulePath, file) {
  const firstSegment = relativePosix(modulePath, file).split("/")[0];
  return config.react.layers[firstSegment] ?? null;
}

function targetForReactImport(config, importName, sourceDirectory) {
  const alias = config.react.alias ?? "@modules";
  const aliasPattern = escapeRegExp(alias.replace(/\/$/, ""));
  const aliasMatch = importName.match(new RegExp(`^${aliasPattern}/([^/]+)(?:/(.*))?$`));

  if (aliasMatch) {
    const module = aliasMatch[1];
    const rest = aliasMatch[2] ?? "";
    const resolvedFile = rest ? resolveModuleFile(path.join(config.react.modulesPath, module, rest)) : null;

    return {
      module,
      file: resolvedFile ? relativePosix(config.react.modulesPath, resolvedFile) : null,
    };
  }

  if (!importName.startsWith(".")) {
    return null;
  }

  const absolute = resolveSourceImport(importName, sourceDirectory);

  if (!absolute || !isInside(config.react.modulesPath, absolute)) {
    return null;
  }

  const relative = relativePosix(config.react.modulesPath, absolute);
  const module = relative.split("/")[0];

  return {
    module,
    file: relative,
  };
}

function reactCouplingFor(config, module, layer, file, importItem) {
  const coupling = config.react.coupling;

  if (!coupling.enabled) {
    return null;
  }

  const target = targetForReactImport(config, importItem.import, path.dirname(file));

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

function reactRoleFor(filePath, layer) {
  const normalized = filePath.replaceAll("\\", "/");

  if (normalized.includes("/application/use-cases/")) {
    return { role: "use_case", role_label: "Caso de uso" };
  }

  if (normalized.includes("/application/contracts/") || normalized.includes("/contracts/")) {
    return { role: "connector", role_label: "Conector" };
  }

  if (normalized.includes("/application/dtos/")) {
    return { role: "dto", role_label: "DTO" };
  }

  if (normalized.includes("/domain/value-objects/")) {
    return { role: "value_object", role_label: "Value Object" };
  }

  if (normalized.includes("/infrastructure/api/")) {
    return { role: "adapter", role_label: "Adaptador API" };
  }

  if (normalized.includes("/infrastructure/react-flow/")) {
    return { role: "adapter", role_label: "React Flow" };
  }

  if (normalized.includes("/interfaces/components/")) {
    return { role: "ui_component", role_label: "Componente UI" };
  }

  if (normalized.includes("/interfaces/pages/")) {
    return { role: "page", role_label: "Pagina" };
  }

  if (normalized.includes("/interfaces/hooks/")) {
    return { role: "hook", role_label: "Hook UI" };
  }

  return { role: layer ? layer.toLowerCase() : null, role_label: layer };
}

function reactModuleNode(id, module, modulePath) {
  return {
    id,
    type: "module",
    label: module,
    module,
    layer: null,
    path: modulePath,
    role: "module",
    role_label: "Modulo React",
  };
}

function graphResponse(modules, nodes, edges) {
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

function resolveModuleFile(base) {
  try {
    if (existsSync(base) && statSync(base).isFile()) {
      return base;
    }
  } catch {
    return null;
  }

  for (const extension of sourceExtensions) {
    const candidate = `${base}${extension}`;

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  for (const extension of sourceExtensions) {
    const candidate = path.join(base, `index${extension}`);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isInside(parent, child) {
  const relative = toPosixPath(path.relative(parent, child));
  return relative !== "" && !relative.startsWith("../") && relative !== "..";
}

function addNode(nodes, nodeIds, node) {
  if (nodeIds.has(node.id)) {
    return;
  }

  nodeIds.add(node.id);
  nodes.push(node);
}

function hash(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
