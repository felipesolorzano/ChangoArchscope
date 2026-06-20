import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../../architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { AuditSnapshot } from "../../domain/value-objects/AuditSnapshot.js";
import { auditProject } from "../../application/use-cases/AuditProject.js";

export type AuditTarget = "laravel" | "react";

export type CheckArchitecture = (
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  options: { target: AuditTarget; module: string | null },
) => ArchitectureCheckResult;

export type AuditControllerDeps = {
  getConfig: () => ArchitectureConfig;
  reader: SourceTreeReader;
  parser: PhpSourceParser;
  check: CheckArchitecture;
};

export function targetFromQuery(value: unknown): AuditTarget {
  return value === "react" ? "react" : "laravel";
}

export function moduleFromQuery(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Composition root compartido por los endpoints de audit: configura, corre el check de
// arquitectura y arma el AuditSnapshot completo para un target/module dados.
export function resolveAuditSnapshot(
  deps: AuditControllerDeps,
  target: AuditTarget,
  module: string | null,
): AuditSnapshot {
  const config = deps.getConfig();
  const checkResult = deps.check(config, deps.reader, { target, module });

  return auditProject({
    checkResult,
    reader: deps.reader,
    parser: deps.parser,
    phpRoot: target === "laravel" ? config.laravel.modulesPath : null,
    phpExtensions: config.laravel.phpExtensions,
    ignoredPaths: config.laravel.ignoredPaths,
  });
}
