import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";
// Agrupa los findings (ya filtrados a un archivo) por regla, acumulando conteo, mezcla de
// severidad y risk (suma de pesos). Ordenado por risk descendente.
export function aggregateFileRules(findings) {
    const groups = new Map();
    for (const finding of findings) {
        const group = groups.get(finding.rule) ?? {
            rule: finding.rule,
            category: finding.category,
            findingsCount: 0,
            bySeverity: {},
            risk: 0,
            findings: [],
        };
        group.findingsCount += 1;
        group.bySeverity[finding.severity] = (group.bySeverity[finding.severity] ?? 0) + 1;
        group.risk += SEVERITY_WEIGHTS[finding.severity];
        group.findings.push({ line: finding.line, severity: finding.severity, message: finding.message });
        groups.set(finding.rule, group);
    }
    return [...groups.values()].sort((a, b) => b.risk - a.risk);
}
