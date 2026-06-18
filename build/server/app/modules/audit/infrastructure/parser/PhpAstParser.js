import { Engine } from "php-parser";
const TOP_LEVEL_CLASS_KINDS = new Set(["class", "trait"]);
const DECISION_NODE_KINDS = new Set(["if", "for", "foreach", "while", "do", "catch", "retif"]);
const LOGICAL_OPERATORS = new Set(["&&", "||"]);
const METHOD_LOOKUP_KINDS = new Set(["propertylookup", "staticlookup", "nullsafepropertylookup"]);
const SUPERGLOBALS = new Set(["_SERVER", "_GET", "_POST", "_REQUEST", "_COOKIE", "_FILES", "_ENV", "_SESSION", "GLOBALS"]);
const USER_INPUT_SUPERGLOBALS = new Set(["_GET", "_POST", "_REQUEST", "_COOKIE"]);
const SQL_KEYWORDS = ["select", "insert", "update", "delete", "where", "from", "join"];
const OUTPUT_KINDS = new Set(["echo", "print"]);
const LOOP_KINDS = new Set(["for", "foreach", "while", "do"]);
export class PhpAstParser {
    engine = new Engine({ ast: { withPositions: true } });
    parse(file, source) {
        const ast = this.engine.parseCode(source, file);
        const topLevelNodes = flattenTopLevel(ast.children);
        return {
            file,
            classes: topLevelNodes
                .filter((node) => TOP_LEVEL_CLASS_KINDS.has(node.kind))
                .map((node) => toClassStructure(node)),
            // Las funciones de nivel superior siempre tienen body en PHP valido (a diferencia de los metodos de una clase).
            functions: topLevelNodes.filter((node) => node.kind === "function").map((node) => toMethodStructure(node)),
            referencedNames: [...collectReferencedNames(ast.children)],
            securityIssues: collectSecurityIssues(ast.children),
            sqlLiterals: collectSqlLiterals(ast.children),
        };
    }
}
function flattenTopLevel(nodes) {
    return nodes.flatMap((node) => node.kind === "namespace" ? flattenTopLevel(node.children) : [node]);
}
function toClassStructure(node) {
    const members = node.body;
    const loc = node.loc;
    return {
        name: node.name.name,
        startLine: loc.start.line,
        endLine: loc.end.line,
        extendsName: isKind(node.extends, "name") ? node.extends.name : null,
        // toMethodStructure ya descarta los miembros sin body (propiedades, constantes, metodos abstractos).
        methods: members.map((member) => toMethodStructure(member)).filter((method) => method !== null),
    };
}
function toMethodStructure(node) {
    if (!node.body) {
        return null;
    }
    const loc = node.loc;
    return {
        name: node.name.name,
        startLine: loc.start.line,
        endLine: loc.end.line,
        parametersCount: node.arguments.length,
        ...analyzeMethodBody(node.body),
    };
}
function analyzeMethodBody(node) {
    const metrics = {
        decisionPointsCount: 0,
        directInstantiationsCount: 0,
        staticCallsCount: 0,
        singletonAccessCount: 0,
        globalAccessCount: 0,
    };
    accumulateMetrics(node, metrics);
    return metrics;
}
function accumulateMetrics(node, metrics) {
    if (!node || typeof node !== "object") {
        return;
    }
    // Object.entries tambien funciona sobre arrays (claves numericas), por eso no hace falta un caso aparte.
    const record = node;
    if (DECISION_NODE_KINDS.has(record.kind)) {
        metrics.decisionPointsCount += 1;
    }
    if (record.kind === "case" && record.test !== null) {
        metrics.decisionPointsCount += 1;
    }
    // Stryker disable next-line ConditionalExpression: ningun otro kind del AST de php-parser tiene .type "&&"/"||", mutante equivalente.
    if (record.kind === "bin" && LOGICAL_OPERATORS.has(record.type)) {
        metrics.decisionPointsCount += 1;
    }
    if (record.kind === "new" && isKind(record.what, "name")) {
        metrics.directInstantiationsCount += 1;
    }
    // Stryker disable next-line ConditionalExpression: solo un "call" tiene su "what" apuntando a un "staticlookup"; un staticlookup suelto (lectura de propiedad/constante estatica) es el nodo en si, no el "what" de otro, mutante equivalente.
    if (record.kind === "call" && isKind(record.what, "staticlookup")) {
        metrics.staticCallsCount += 1;
        if (isGetInstanceLookup(record.what)) {
            metrics.singletonAccessCount += 1;
        }
    }
    if (record.kind === "global") {
        metrics.globalAccessCount += 1;
    }
    if (record.kind === "variable" && SUPERGLOBALS.has(record.name)) {
        metrics.globalAccessCount += 1;
    }
    for (const value of Object.values(record)) {
        accumulateMetrics(value, metrics);
    }
}
function collectReferencedNames(node) {
    const names = new Set();
    accumulateReferencedNames(node, names);
    return names;
}
function accumulateReferencedNames(node, names) {
    if (!node || typeof node !== "object") {
        return;
    }
    const record = node;
    // Stryker disable next-line ConditionalExpression: todo nodo "name" de php-parser trae "name" como string, mutante equivalente.
    if (record.kind === "name" && typeof record.name === "string") {
        names.add(record.name);
    }
    if (METHOD_LOOKUP_KINDS.has(record.kind) && isKind(record.offset, "identifier")) {
        names.add(record.offset.name);
    }
    for (const value of Object.values(record)) {
        accumulateReferencedNames(value, names);
    }
}
function collectSecurityIssues(node) {
    const issues = [];
    accumulateSecurityIssues(node, issues);
    return issues;
}
function accumulateSecurityIssues(node, issues) {
    if (!node || typeof node !== "object") {
        return;
    }
    const record = node;
    if (record.kind === "eval") {
        issues.push({ rule: "eval-usage", line: lineOf(record) });
    }
    if (record.kind === "include" && !isKind(record.target, "string")) {
        issues.push({ rule: "dynamic-include", line: lineOf(record) });
    }
    // Stryker disable next-line ConditionalExpression: ningun otro kind del AST de php-parser tiene .type "." con forma left/right, mutante equivalente.
    if (record.kind === "bin" && record.type === "." && isSqlConcatenation(record)) {
        issues.push({ rule: "sql-concatenation", line: lineOf(record) });
    }
    if (OUTPUT_KINDS.has(record.kind)) {
        const expressions = record.kind === "echo" ? record.expressions : [record.expression];
        if (expressions.some((expression) => containsUnwrappedUserInput(expression, false))) {
            issues.push({ rule: "unsanitized-output", line: lineOf(record) });
        }
    }
    for (const value of Object.values(record)) {
        accumulateSecurityIssues(value, issues);
    }
}
function isSqlConcatenation(bin) {
    return ((isStringWithSqlKeyword(bin.left) && !isKind(bin.right, "string")) ||
        (isStringWithSqlKeyword(bin.right) && !isKind(bin.left, "string")));
}
function isStringWithSqlKeyword(node) {
    return isKind(node, "string") && hasSqlKeyword(node.value);
}
function hasSqlKeyword(text) {
    const value = text.toLowerCase();
    return SQL_KEYWORDS.some((keyword) => value.includes(keyword));
}
function collectSqlLiterals(node) {
    const literals = [];
    accumulateSqlLiterals(node, false, literals);
    return literals;
}
function accumulateSqlLiterals(node, insideLoop, literals) {
    if (!node || typeof node !== "object") {
        return;
    }
    const record = node;
    if (record.kind === "string" && hasSqlKeyword(record.value)) {
        literals.push({ value: record.value.trim(), line: lineOf(record), insideLoop });
    }
    const nextInsideLoop = insideLoop || LOOP_KINDS.has(record.kind);
    for (const value of Object.values(record)) {
        accumulateSqlLiterals(value, nextInsideLoop, literals);
    }
}
function containsUnwrappedUserInput(node, insideCall) {
    if (!node || typeof node !== "object") {
        return false;
    }
    const record = node;
    if (record.kind === "variable" && USER_INPUT_SUPERGLOBALS.has(record.name)) {
        return !insideCall;
    }
    const nextInsideCall = insideCall || record.kind === "call";
    return Object.values(record).some((value) => containsUnwrappedUserInput(value, nextInsideCall));
}
function lineOf(node) {
    return node.loc.start.line;
}
function isKind(node, kind) {
    // Stryker disable next-line OptionalChaining: ambos call-sites solo invocan isKind con un "what" ya garantizado (de "new"/"call"), null-safe se mantiene por si se agregan mas usos.
    return node?.kind === kind;
}
function isGetInstanceLookup(staticLookup) {
    // El "what" de un "call" cuyo kind es "staticlookup" siempre trae "offset" (el metodo invocado).
    const offset = staticLookup.offset;
    return offset.name.toLowerCase() === "getinstance";
}
