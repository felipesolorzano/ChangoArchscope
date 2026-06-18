export function issue(input) {
    const { module, layer, file, line, importName, message, suggestion = "", targetModule, assessment = "", recommendation = "", action = "", } = input;
    return {
        module,
        layer,
        file,
        line,
        import: importName,
        message,
        suggestion,
        ...(targetModule ? { target_module: targetModule } : {}),
        ...(assessment ? { assessment } : {}),
        ...(recommendation ? { recommendation } : {}),
        ...(action ? { action } : {}),
    };
}
export function report(input) {
    const { module, modulePath, scannedFiles, violations, couplings, failOnCoupling = false } = input;
    return {
        module,
        module_path: modulePath,
        passed: violations.length === 0 && (!failOnCoupling || couplings.length === 0),
        files_scanned: scannedFiles.length,
        violations_count: violations.length,
        couplings_count: couplings.length,
        violations,
        couplings,
    };
}
export function checkResponse(input) {
    const { target, module, reports, failOnCoupling, checkedAt } = input;
    return {
        checked_at: checkedAt,
        target,
        module,
        fail_on_coupling: failOnCoupling,
        passed: reports.every((item) => item.passed),
        summary: {
            modules: reports.length,
            files_scanned: reports.reduce((total, item) => total + item.files_scanned, 0),
            violations_count: reports.reduce((total, item) => total + item.violations_count, 0),
            couplings_count: reports.reduce((total, item) => total + item.couplings_count, 0),
        },
        reports,
    };
}
