const SEVERITY_BY_RAW = {
    error: "high",
    warning: "medium",
};
export function phpCompatibilityAnalyzer(scan) {
    if (scan.status === "unavailable")
        return [];
    return scan.issues.map((issue) => buildFinding(issue, scan.targetPhp));
}
function buildFinding(issue, targetPhp) {
    return {
        category: "php_compatibility",
        rule: issue.rule,
        severity: SEVERITY_BY_RAW[issue.severityRaw],
        source: "external",
        module: "",
        class: null,
        file: issue.file,
        line: issue.line,
        message: issue.message,
        details: { rule: issue.rule, targetPhp },
    };
}
