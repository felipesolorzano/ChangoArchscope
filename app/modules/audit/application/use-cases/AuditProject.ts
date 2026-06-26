import type { ArchitectureCheckResult } from "../../../architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpCompatibilityScanResult } from "../../domain/repositories/PhpCompatibilityScanner.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { AuditFinding, AuditScannerStatus, AuditSnapshot } from "../../domain/value-objects/AuditSnapshot.js";
import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";
import { phpCompatibilityAnalyzer } from "../analyzers/phpCompatibilityAnalyzer.js";
import { phpComplexityAnalyzer } from "../analyzers/phpComplexityAnalyzer.js";
import { phpCouplingAnalyzer } from "../analyzers/phpCouplingAnalyzer.js";
import { phpDatabaseAnalyzer } from "../analyzers/phpDatabaseAnalyzer.js";
import { phpDeadCodeAnalyzer } from "../analyzers/phpDeadCodeAnalyzer.js";
import { phpSecurityAnalyzer } from "../analyzers/phpSecurityAnalyzer.js";
import { phpTestingAnalyzer } from "../analyzers/phpTestingAnalyzer.js";
import { architectureFindings } from "./RunAudit.js";
import { scanPhpFiles, type PhpScanResult } from "./ScanPhpFiles.js";

/** Escaneo+parseo de archivos PHP. Inyectable para usar una version incremental con cache. */
export type ScanPhpFilesFn = (phpRoot: string, extensions: string[], ignoredPaths: string[]) => PhpScanResult;

export type AuditProjectInput = {
  checkResult: ArchitectureCheckResult;
  reader: SourceTreeReader;
  parser: PhpSourceParser;
  phpRoot: string | null;
  phpExtensions: string[];
  ignoredPaths: string[];
  /** Resultado ya resuelto del scan de compatibilidad. Ausente = no se pidio. */
  compatibilityScan?: PhpCompatibilityScanResult;
  /** Scan de archivos a usar. Ausente = `scanPhpFiles` puro (re-parsea todo cada vez). */
  scanFiles?: ScanPhpFilesFn;
};

export function auditProject(input: AuditProjectInput): AuditSnapshot {
  const { checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths, compatibilityScan, scanFiles } = input;

  const { files, skipped }: PhpScanResult =
    phpRoot === null
      ? { files: [], skipped: [] }
      : (scanFiles ?? ((root, exts, ignored) => scanPhpFiles(reader, parser, root, exts, ignored)))(
          phpRoot,
          phpExtensions,
          ignoredPaths,
        );

  const nativeFindings: AuditFinding[] = [
    ...phpComplexityAnalyzer(files),
    ...phpCouplingAnalyzer(files),
    ...phpDeadCodeAnalyzer(files),
    ...phpSecurityAnalyzer(files),
    ...phpDatabaseAnalyzer(files),
    ...phpTestingAnalyzer(files),
  ];

  const compatibilityFindings =
    compatibilityScan === undefined ? [] : phpCompatibilityAnalyzer(compatibilityScan);

  return buildAuditSnapshot([...architectureFindings(checkResult), ...nativeFindings, ...compatibilityFindings], {
    target: checkResult.target,
    module: checkResult.module,
    filesScanned: checkResult.summary.files_scanned,
    modules: checkResult.summary.modules,
    phpRoot: phpRoot ?? undefined,
    skippedFiles: skipped,
    phpCompatibilityStatus: compatibilityStatus(compatibilityScan),
  });
}

function compatibilityStatus(scan: PhpCompatibilityScanResult | undefined): AuditScannerStatus {
  if (scan === undefined) return { status: "skipped" };
  if (scan.status === "unavailable") return { status: "unavailable", reason: scan.reason };
  return { status: "ok", targetPhp: scan.targetPhp };
}
