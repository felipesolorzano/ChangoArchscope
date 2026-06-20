#!/usr/bin/env node

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildArchitectureGraph } from "../build/server/app/modules/architecture/application/buildArchitectureGraph.js";
import { checkArchitecture } from "../build/server/app/modules/architecture/application/checkArchitecture.js";
import { NodeFsSourceTreeReader } from "../build/server/app/modules/shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { CONFIG_FILE, loadConfig } from "../build/server/app/modules/architecture/infrastructure/config/config.js";
import { listenChangoArchscopeServer } from "../build/server/bootstrap/server.js";
import { auditProject } from "../build/server/app/modules/audit/application/use-cases/AuditProject.js";
import { exceedsSeverityThreshold } from "../build/server/app/modules/audit/domain/services/auditSeverityUtils.js";
import { PhpAstParser } from "../build/server/app/modules/audit/infrastructure/parser/PhpAstParser.js";

const SEVERITY_THRESHOLDS = ["low", "medium", "high", "critical"];

const args = process.argv.slice(2);
const command = args[0] ?? "serve";
const flags = parseFlags(args.slice(1));
const reader = new NodeFsSourceTreeReader();

try {
  if (command === "init") {
    initConfig();
  } else if (command === "serve") {
    const config = await loadRuntimeConfig(flags);
    const port = flags.port ? Number(flags.port) : config.server.port;
    const host = flags.host ?? config.server.host;
    const started = await listenChangoArchscopeServer({
      ...config,
      server: { ...config.server, port, host },
    });

    console.log(`Architecture Toolkit running at http://${started.host}:${started.port}`);
  } else if (command === "graph") {
    const config = await loadRuntimeConfig(flags);
    console.log(JSON.stringify(buildArchitectureGraph(config, reader, {
      target: flags.target ?? "laravel",
      module: flags.module ?? null,
    }), null, 2));
  } else if (command === "check") {
    const config = await loadRuntimeConfig(flags);
    const result = checkArchitecture(config, reader, {
      target: flags.target ?? "laravel",
      module: flags.module ?? null,
      failOnCoupling: flags["fail-on-coupling"] !== "false",
    });

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } else if (command === "audit") {
    const severityThreshold = flags["severity-threshold"] ?? "high";

    if (!SEVERITY_THRESHOLDS.includes(severityThreshold)) {
      throw new Error(`Invalid --severity-threshold "${severityThreshold}". Use one of: ${SEVERITY_THRESHOLDS.join(", ")}.`);
    }

    const target = flags.target ?? "laravel";
    const config = await loadRuntimeConfig(flags);
    const checkResult = checkArchitecture(config, reader, { target, module: flags.module ?? null });
    const snapshot = auditProject({
      checkResult,
      reader,
      parser: new PhpAstParser(),
      phpRoot: target === "laravel" ? config.laravel.modulesPath : null,
      phpExtensions: config.laravel.phpExtensions,
      ignoredPaths: config.laravel.ignoredPaths,
    });

    console.log(JSON.stringify(snapshot, null, 2));
    process.exitCode = exceedsSeverityThreshold(snapshot, severityThreshold) ? 1 : 0;
  } else {
    printHelp();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function loadRuntimeConfig(flags) {
  const config = await loadConfig(process.cwd(), flags.config ?? null);

  if (flags["laravel-modules"]) {
    config.laravel.modulesPath = path.resolve(process.cwd(), flags["laravel-modules"]);
  }

  if (flags["react-modules"]) {
    config.react.modulesPath = path.resolve(process.cwd(), flags["react-modules"]);
  }

  return config;
}

function initConfig() {
  const target = path.resolve(process.cwd(), CONFIG_FILE);

  if (existsSync(target)) {
    console.log(`${CONFIG_FILE} already exists.`);
    return;
  }

  writeFileSync(target, `export default {
  laravel: {
    modulesPath: "app/modules",
    namespaceRoot: "App\\\\Modules",
  },
  react: {
    modulesPath: "resources/js/react/modules",
    alias: "@modules",
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};
`);

  console.log(`Created ${CONFIG_FILE}`);
}

function parseFlags(values) {
  const flags = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = value.slice(2).split("=");
    const next = values[index + 1];

    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      flags[rawKey] = next;
      index += 1;
    } else {
      flags[rawKey] = "true";
    }
  }

  return flags;
}

function printHelp() {
  console.log(`Usage:
  chango-archscope init
  chango-archscope serve [--port 4590] [--host 127.0.0.1]
  chango-archscope graph --target laravel|react [--module Users]
  chango-archscope check --target laravel|react [--module Users]
  chango-archscope audit --target laravel|react [--module Users] [--severity-threshold high]

Options:
  --config <file>
  --laravel-modules <path>
  --react-modules <path>

Note: run "npm run build:node" first so build/server exists.
`);
}
