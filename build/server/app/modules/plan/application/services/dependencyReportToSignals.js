// Adaptador entre bounded contexts: el reporte de `dependencies` → tareas del plan (metrica + items).
const KIND_LABELS = { php: "PHP", node: "Node", npm: "npm" };
export function dependencyReportToSignals(report) {
    const deps = report.dependencies;
    const items = {
        "fix-vulnerable-packages": deps.filter((dep) => dep.security.vulnerabilities.length > 0).map(vulnerableItem),
        "update-unsupported-runtime": report.runtimes.filter((runtime) => runtime.support?.isEol === true).map(runtimeItem),
        "replace-abandoned-packages": deps.filter((dep) => dep.status === "abandoned" || dep.status === "deprecated").map(abandonedItem),
        "remove-unused-packages": deps.filter((dep) => dep.usage?.unused === true).map((dep) => item(dep, "dependency-unused", "low", `${dep.name}: sin referencias en el codigo`)),
        "apply-safe-updates": deps.filter((dep) => dep.status === "patch" || dep.status === "minor").map((dep) => item(dep, `dependency-${dep.status}`, "low", jump(dep))),
        "upgrade-major-versions": deps.filter((dep) => dep.status === "major").map((dep) => item(dep, "dependency-major", "medium", `${jump(dep)}${dep.group ? ` (grupo ${dep.group})` : ""}`)),
    };
    const majorSteps = majorStepsOf(deps.filter((dep) => dep.status === "major"));
    for (const [key, list] of majorSteps) {
        items[key] = list.map((dep) => item(dep, "dependency-major", "medium", `${jump(dep)}${dep.group ? ` (grupo ${dep.group})` : ""}`));
    }
    return { counts: Object.fromEntries(Object.entries(items).map(([key, list]) => [key, list.length])), items, majorSteps: majorSteps.map(([key]) => key) };
}
// XRay X6: un major a la vez. Primero herramientas, despues el framework y lo que lo acompaña, despues
// el resto de los grupos (alfabetico) y al final los sueltos.
const STEP_ORDER = ["eslint", "jest", "vite", "webpack", "gulp", "react", "@testing-library", "react-router", "laravel"];
const LOOSE = "otros";
function majorStepsOf(majors) {
    const byGroup = new Map();
    for (const dep of majors) {
        const group = dep.group ?? LOOSE;
        byGroup.set(group, [...(byGroup.get(group) ?? []), dep]);
    }
    const rank = (group) => (group === LOOSE ? STEP_ORDER.length + 1 : STEP_ORDER.includes(group) ? STEP_ORDER.indexOf(group) : STEP_ORDER.length);
    return [...byGroup]
        .sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
        .map(([group, list]) => [`upgrade-major:${group}`, list]);
}
function item(dep, rule, severity, message) {
    return { file: dep.manifest, line: 0, rule, severity, message };
}
function jump(dep) {
    return `${dep.name} ${dep.current} → ${dep.recommended}`;
}
function vulnerableItem(dep) {
    const { vulnerabilities, maxSeverity } = dep.security;
    const first = vulnerabilities[0];
    const severity = maxSeverity === "moderate" ? "medium" : maxSeverity;
    return item(dep, "dependency-vulnerable", severity, `${dep.name} ${dep.current} → ${dep.recommended ?? "-"}: ${vulnerabilities.length} vulns (${first.cve ?? first.id})`);
}
function abandonedItem(dep) {
    return item(dep, `dependency-${dep.status}`, "high", `${dep.name} ${dep.current}: ${dep.replacement ?? dep.deprecation ?? "abandonado"}`);
}
function runtimeItem(runtime) {
    // Solo llegan runtimes con soporte vencido (support presente).
    const eol = runtime.support.eol;
    const since = typeof eol === "string" ? ` desde ${eol}` : "";
    return { file: "", line: 0, rule: "runtime-eol", severity: "high", message: `${KIND_LABELS[runtime.kind]} ${runtime.selected}: sin soporte${since}` };
}
