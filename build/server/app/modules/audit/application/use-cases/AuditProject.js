import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";
import { jsTestImporters } from "../../domain/services/jsTestImporters.js";
import { phpTestReferrers } from "../../domain/services/phpTestReferrers.js";
import { phpCompatibilityAnalyzer } from "../analyzers/phpCompatibilityAnalyzer.js";
import { phpComplexityAnalyzer } from "../analyzers/phpComplexityAnalyzer.js";
import { phpCouplingAnalyzer } from "../analyzers/phpCouplingAnalyzer.js";
import { phpDatabaseAnalyzer } from "../analyzers/phpDatabaseAnalyzer.js";
import { phpDeadCodeAnalyzer } from "../analyzers/phpDeadCodeAnalyzer.js";
import { phpLegacyApiAnalyzer } from "../analyzers/phpLegacyApiAnalyzer.js";
import { phpSecurityAnalyzer } from "../analyzers/phpSecurityAnalyzer.js";
import { phpTestingAnalyzer } from "../analyzers/phpTestingAnalyzer.js";
import { jsApiAnalyzer } from "../analyzers/jsApiAnalyzer.js";
import { jsComplexityAnalyzer } from "../analyzers/jsComplexityAnalyzer.js";
import { jsCouplingAnalyzer } from "../analyzers/jsCouplingAnalyzer.js";
import { jsDeadCodeAnalyzer } from "../analyzers/jsDeadCodeAnalyzer.js";
import { jsLegacyApiAnalyzer } from "../analyzers/jsLegacyApiAnalyzer.js";
import { jsSecurityAnalyzer } from "../analyzers/jsSecurityAnalyzer.js";
import { jsTestingAnalyzer } from "../analyzers/jsTestingAnalyzer.js";
import { scanJsFiles } from "./ScanJsFiles.js";
import { architectureFindings } from "./RunAudit.js";
import { scanPhpFiles } from "./ScanPhpFiles.js";
export function auditProject(input) {
    const { checkResult, reader, parser, phpRoot, phpExtensions, ignoredPaths, compatibilityScan, scanFiles, js } = input;
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
        ...phpLegacyApiAnalyzer(files),
    ];
    const scanJs = (root, ignored) => (js.scanFiles ?? ((scanRoot, exts, ignoredPaths) => scanJsFiles(reader, js.parser, scanRoot, exts, ignoredPaths)))(root, js.extensions, ignored);
    const jsScan = js === undefined ? { files: [], skipped: [] } : scanJs(js.root, js.ignoredPaths);
    // Los tests de fuera de la raiz se escanean completos (sin ignoredPaths) y solo cuentan como evidencia.
    const testFiles = (js?.testRoots ?? []).flatMap((testRoot) => scanJs(testRoot, []).files);
    const jsFindings = [
        ...jsComplexityAnalyzer(jsScan.files),
        ...jsCouplingAnalyzer(jsScan.files),
        ...jsDeadCodeAnalyzer(jsScan.files, testFiles),
        ...jsSecurityAnalyzer(jsScan.files),
        ...jsApiAnalyzer(jsScan.files),
        ...jsTestingAnalyzer([...jsScan.files, ...testFiles]).filter((finding) => !testFiles.some((file) => file.file === finding.file)),
        ...jsLegacyApiAnalyzer(jsScan.files),
    ];
    const compatibilityFindings = compatibilityScan === undefined ? [] : phpCompatibilityAnalyzer(compatibilityScan);
    return buildAuditSnapshot([...architectureFindings(checkResult), ...nativeFindings, ...jsFindings, ...compatibilityFindings], {
        target: checkResult.target,
        module: checkResult.module,
        filesScanned: checkResult.summary.files_scanned,
        modules: checkResult.summary.modules,
        // Raiz desde la que riskBreakdown deriva el modulo de los findings nativos.
        sourceRoot: phpRoot ?? js?.root,
        skippedFiles: [...skipped, ...jsScan.skipped],
        scannedFiles: [...files, ...jsScan.files].map((file) => file.file).sort(),
        testedBy: { ...phpTestReferrers(files), ...jsTestImporters([...jsScan.files, ...testFiles]) },
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
