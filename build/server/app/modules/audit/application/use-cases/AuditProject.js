import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";
import { phpCompatibilityAnalyzer } from "../analyzers/phpCompatibilityAnalyzer.js";
import { phpComplexityAnalyzer } from "../analyzers/phpComplexityAnalyzer.js";
import { phpCouplingAnalyzer } from "../analyzers/phpCouplingAnalyzer.js";
import { phpDatabaseAnalyzer } from "../analyzers/phpDatabaseAnalyzer.js";
import { phpDeadCodeAnalyzer } from "../analyzers/phpDeadCodeAnalyzer.js";
import { phpSecurityAnalyzer } from "../analyzers/phpSecurityAnalyzer.js";
import { phpTestingAnalyzer } from "../analyzers/phpTestingAnalyzer.js";
import { architectureFindings } from "./RunAudit.js";
import { scanPhpFiles } from "./ScanPhpFiles.js";
export function auditProject(input) {
    const { checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths, compatibilityScan, scanFiles } = input;
    const { files, skipped } = phpRoot === null
        ? { files: [], skipped: [] }
        : (scanFiles ?? ((root, exts, ignored) => scanPhpFiles(reader, parser, root, exts, ignored)))(phpRoot, phpExtensions, ignoredPaths);
    const nativeFindings = [
        ...phpComplexityAnalyzer(files),
        ...phpCouplingAnalyzer(files),
        ...phpDeadCodeAnalyzer(files),
        ...phpSecurityAnalyzer(files),
        ...phpDatabaseAnalyzer(files),
        ...phpTestingAnalyzer(files),
    ];
    const compatibilityFindings = compatibilityScan === undefined ? [] : phpCompatibilityAnalyzer(compatibilityScan);
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
function compatibilityStatus(scan) {
    if (scan === undefined)
        return { status: "skipped" };
    if (scan.status === "unavailable")
        return { status: "unavailable", reason: scan.reason };
    return { status: "ok", targetPhp: scan.targetPhp };
}
