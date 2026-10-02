import type { ArchitectureCheckResult } from "../../../architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpCompatibilityScanResult } from "../../domain/repositories/PhpCompatibilityScanner.js";
import type { JsSourceParser } from "../../domain/repositories/JsSourceParser.js";
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
import { jsApiAnalyzer } from "../analyzers/jsApiAnalyzer.js";
import { jsComplexityAnalyzer } from "../analyzers/jsComplexityAnalyzer.js";
import { jsCouplingAnalyzer } from "../analyzers/jsCouplingAnalyzer.js";
import { jsDeadCodeAnalyzer } from "../analyzers/jsDeadCodeAnalyzer.js";
import { jsSecurityAnalyzer } from "../analyzers/jsSecurityAnalyzer.js";
import { jsTestingAnalyzer } from "../analyzers/jsTestingAnalyzer.js";
import { scanJsFiles, type JsScanResult } from "./ScanJsFiles.js";
import { architectureFindings } from "./RunAudit.js";
import { scanPhpFiles, type PhpScanResult } from "./ScanPhpFiles.js";

/** Escaneo+parseo de archivos PHP. Inyectable para usar una version incremental con cache. */
export type ScanPhpFilesFn = (phpRoot: string, extensions: string[], ignoredPaths: string[]) => PhpScanResult;

/** Escaneo+parseo de archivos JS/TS. Inyectable igual que `ScanPhpFilesFn`. */
export type ScanJsFilesFn = (jsRoot: string, extensions: string[], ignoredPaths: string[]) => JsScanResult;

/** Raiz JS/React a auditar con los analizadores nativos de JS. */
export type AuditJsInput = {
  root: string;
  extensions: string[];
  ignoredPaths: string[];
  parser: JsSourceParser;
  scanFiles?: ScanJsFilesFn;
  /** Carpetas de tests fuera de `root`: solo evidencia para el analizador de testing. */
  testRoots?: string[];
};

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
  /** Ausente = no se audita JS (target laravel). */
  js?: AuditJsInput;
};

export function auditProject(input: AuditProjectInput): AuditSnapshot {
  const { checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths, compatibilityScan, scanFiles, js } = input;

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

  const scanJs = (root: string, ignored: string[]): JsScanResult =>
    (js!.scanFiles ?? ((scanRoot, exts, ignoredPaths) => scanJsFiles(reader, js!.parser, scanRoot, exts, ignoredPaths)))(
      root,
      js!.extensions,
      ignored,
    );
  const jsScan: JsScanResult = js === undefined ? { files: [], skipped: [] } : scanJs(js.root, js.ignoredPaths);
  // Los tests de fuera de la raiz se escanean completos (sin ignoredPaths) y solo cuentan como evidencia.
  const testFiles = (js?.testRoots ?? []).flatMap((testRoot) => scanJs(testRoot, []).files);

  const jsFindings: AuditFinding[] = [
    ...jsComplexityAnalyzer(jsScan.files),
    ...jsCouplingAnalyzer(jsScan.files),
    ...jsDeadCodeAnalyzer(jsScan.files),
    ...jsSecurityAnalyzer(jsScan.files),
    ...jsApiAnalyzer(jsScan.files),
    ...jsTestingAnalyzer([...jsScan.files, ...testFiles]).filter((finding) => !testFiles.some((file) => file.file === finding.file)),
  ];

  const compatibilityFindings =
    compatibilityScan === undefined ? [] : phpCompatibilityAnalyzer(compatibilityScan);

  return buildAuditSnapshot([...architectureFindings(checkResult), ...nativeFindings, ...jsFindings, ...compatibilityFindings], {
    target: checkResult.target,
    module: checkResult.module,
    filesScanned: checkResult.summary.files_scanned,
    modules: checkResult.summary.modules,
    // Raiz desde la que riskBreakdown deriva el modulo de los findings nativos.
    sourceRoot: phpRoot ?? js?.root,
    skippedFiles: [...skipped, ...jsScan.skipped],
    phpCompatibilityStatus: compatibilityStatus(compatibilityScan),
  });
}

function compatibilityStatus(scan: PhpCompatibilityScanResult | undefined): AuditScannerStatus {
  if (scan === undefined) return { status: "skipped" };
  if (scan.status === "unavailable") return { status: "unavailable", reason: scan.reason };
  return { status: "ok", targetPhp: scan.targetPhp };
}
