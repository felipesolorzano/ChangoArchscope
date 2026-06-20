import type { ArchitectureCheckResult } from "../../../architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { AuditFinding, AuditSnapshot } from "../../domain/value-objects/AuditSnapshot.js";
import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";
import { phpComplexityAnalyzer } from "../analyzers/phpComplexityAnalyzer.js";
import { phpCouplingAnalyzer } from "../analyzers/phpCouplingAnalyzer.js";
import { phpDatabaseAnalyzer } from "../analyzers/phpDatabaseAnalyzer.js";
import { phpDeadCodeAnalyzer } from "../analyzers/phpDeadCodeAnalyzer.js";
import { phpSecurityAnalyzer } from "../analyzers/phpSecurityAnalyzer.js";
import { phpTestingAnalyzer } from "../analyzers/phpTestingAnalyzer.js";
import { architectureFindings } from "./RunAudit.js";
import { scanPhpFiles, type PhpScanResult } from "./ScanPhpFiles.js";

export type AuditProjectInput = {
  checkResult: ArchitectureCheckResult;
  reader: SourceTreeReader;
  parser: PhpSourceParser;
  phpRoot: string | null;
  phpExtensions: string[];
  ignoredPaths: string[];
};

export function auditProject(input: AuditProjectInput): AuditSnapshot {
  const { checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths } = input;

  const { files, skipped }: PhpScanResult =
    phpRoot === null
      ? { files: [], skipped: [] }
      : scanPhpFiles(reader, parser, phpRoot, phpExtensions, ignoredPaths);

  const nativeFindings: AuditFinding[] = [
    ...phpComplexityAnalyzer(files),
    ...phpCouplingAnalyzer(files),
    ...phpDeadCodeAnalyzer(files),
    ...phpSecurityAnalyzer(files),
    ...phpDatabaseAnalyzer(files),
    ...phpTestingAnalyzer(files),
  ];

  return buildAuditSnapshot([...architectureFindings(checkResult), ...nativeFindings], {
    target: checkResult.target,
    module: checkResult.module,
    filesScanned: checkResult.summary.files_scanned,
    modules: checkResult.summary.modules,
    phpRoot: phpRoot ?? undefined,
    skippedFiles: skipped,
  });
}
