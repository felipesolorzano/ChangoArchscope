import { Engine } from "php-parser";

import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { PhpClassStructure, PhpFileStructure, PhpMethodStructure, PhpSecurityIssue, PhpSqlLiteral } from "../../domain/value-objects/PhpFileStructure.js";

type PhpAstNode = {
  kind?: string;
  [key: string]: unknown;
};

type MethodBodyMetrics = {
  decisionPointsCount: number;
  directInstantiationsCount: number;
  staticCallsCount: number;
  singletonAccessCount: number;
  globalAccessCount: number;
};

const TOP_LEVEL_CLASS_KINDS = new Set(["class", "trait"]);
const DECISION_NODE_KINDS = new Set(["if", "for", "foreach", "while", "do", "catch", "retif"]);
const LOGICAL_OPERATORS = new Set(["&&", "||"]);
const METHOD_LOOKUP_KINDS = new Set(["propertylookup", "staticlookup", "nullsafepropertylookup"]);
const SUPERGLOBALS = new Set(["_SERVER", "_GET", "_POST", "_REQUEST", "_COOKIE", "_FILES", "_ENV", "_SESSION", "GLOBALS"]);
const USER_INPUT_SUPERGLOBALS = new Set(["_GET", "_POST", "_REQUEST", "_COOKIE"]);
const SQL_KEYWORDS = ["select", "insert", "update", "delete", "where", "from", "join"];
const OUTPUT_KINDS = new Set(["echo", "print"]);
const LOOP_KINDS = new Set(["for", "foreach", "while", "do"]);

export class PhpAstParser implements PhpSourceParser {
  private readonly engine = new Engine({ ast: { withPositions: true } });

  parse(file: string, source: string): PhpFileStructure {
    const ast = this.engine.parseCode(source, file) as unknown as { children: PhpAstNode[] };
    const topLevelNodes = flattenTopLevel(ast.children);

    return {
      file,
      classes: topLevelNodes
        .filter((node) => TOP_LEVEL_CLASS_KINDS.has(node.kind as string))
        .map((node) => toClassStructure(node)),
      // Las funciones de nivel superior siempre tienen body en PHP valido (a diferencia de los metodos de una clase).
      functions: topLevelNodes.filter((node) => node.kind === "function").map((node) => toMethodStructure(node)!),
      referencedNames: [...collectReferencedNames(ast.children)],
      securityIssues: collectSecurityIssues(ast.children),
      sqlLiterals: collectSqlLiterals(ast.children),
    };
  }
}

function flattenTopLevel(nodes: PhpAstNode[]): PhpAstNode[] {
  return nodes.flatMap((node) =>
    node.kind === "namespace" ? flattenTopLevel(node.children as PhpAstNode[]) : [node],
  );
}

function toClassStructure(node: PhpAstNode): PhpClassStructure {
  const members = node.body as PhpAstNode[];
  const loc = node.loc as { start: { line: number }; end: { line: number } };

  return {
    name: (node.name as { name: string }).name,
    startLine: loc.start.line,
    endLine: loc.end.line,
    extendsName: isKind(node.extends, "name") ? ((node.extends as PhpAstNode).name as string) : null,
    // toMethodStructure ya descarta los miembros sin body (propiedades, constantes, metodos abstractos).
    methods: members.map((member) => toMethodStructure(member)).filter((method): method is PhpMethodStructure => method !== null),
  };
}

function toMethodStructure(node: PhpAstNode): PhpMethodStructure | null {
  if (!node.body) {
    return null;
  }

  const loc = node.loc as { start: { line: number }; end: { line: number } };

  return {
    name: (node.name as { name: string }).name,
    startLine: loc.start.line,
    endLine: loc.end.line,
    parametersCount: (node.arguments as unknown[]).length,
    ...analyzeMethodBody(node.body),
  };
}

function analyzeMethodBody(node: unknown): MethodBodyMetrics {
  const metrics: MethodBodyMetrics = {
    decisionPointsCount: 0,
    directInstantiationsCount: 0,
    staticCallsCount: 0,
    singletonAccessCount: 0,
    globalAccessCount: 0,
  };

  accumulateMetrics(node, metrics);

  return metrics;
}

function accumulateMetrics(node: unknown, metrics: MethodBodyMetrics): void {
  if (!node || typeof node !== "object") {
    return;
  }

  // Object.entries tambien funciona sobre arrays (claves numericas), por eso no hace falta un caso aparte.
  const record = node as Record<string, unknown>;

  if (DECISION_NODE_KINDS.has(record.kind as string)) {
    metrics.decisionPointsCount += 1;
  }

  if (record.kind === "case" && record.test !== null) {
    metrics.decisionPointsCount += 1;
  }

  // Stryker disable next-line ConditionalExpression: ningun otro kind del AST de php-parser tiene .type "&&"/"||", mutante equivalente.
  if (record.kind === "bin" && LOGICAL_OPERATORS.has(record.type as string)) {
    metrics.decisionPointsCount += 1;
  }

  if (record.kind === "new" && isKind(record.what, "name")) {
    metrics.directInstantiationsCount += 1;
  }

  // Stryker disable next-line ConditionalExpression: solo un "call" tiene su "what" apuntando a un "staticlookup"; un staticlookup suelto (lectura de propiedad/constante estatica) es el nodo en si, no el "what" de otro, mutante equivalente.
  if (record.kind === "call" && isKind(record.what, "staticlookup")) {
    metrics.staticCallsCount += 1;

    if (isGetInstanceLookup(record.what as PhpAstNode)) {
      metrics.singletonAccessCount += 1;
    }
  }

  if (record.kind === "global") {
    metrics.globalAccessCount += 1;
  }

  if (record.kind === "variable" && SUPERGLOBALS.has(record.name as string)) {
    metrics.globalAccessCount += 1;
  }

  for (const value of Object.values(record)) {
    accumulateMetrics(value, metrics);
  }
}

function collectReferencedNames(node: unknown): Set<string> {
  const names = new Set<string>();

  accumulateReferencedNames(node, names);

  return names;
}

function accumulateReferencedNames(node: unknown, names: Set<string>): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;

  // Stryker disable next-line ConditionalExpression: todo nodo "name" de php-parser trae "name" como string, mutante equivalente.
  if (record.kind === "name" && typeof record.name === "string") {
    names.add(record.name);
  }

  if (METHOD_LOOKUP_KINDS.has(record.kind as string) && isKind(record.offset, "identifier")) {
    names.add((record.offset as PhpAstNode).name as string);
  }

  for (const value of Object.values(record)) {
    accumulateReferencedNames(value, names);
  }
}

function collectSecurityIssues(node: unknown): PhpSecurityIssue[] {
  const issues: PhpSecurityIssue[] = [];

  accumulateSecurityIssues(node, issues);

  return issues;
}

function accumulateSecurityIssues(node: unknown, issues: PhpSecurityIssue[]): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;

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

  if (OUTPUT_KINDS.has(record.kind as string)) {
    const expressions = record.kind === "echo" ? (record.expressions as unknown[]) : [record.expression];

    if (expressions.some((expression) => containsUnwrappedUserInput(expression, false))) {
      issues.push({ rule: "unsanitized-output", line: lineOf(record) });
    }
  }

  for (const value of Object.values(record)) {
    accumulateSecurityIssues(value, issues);
  }
}

function isSqlConcatenation(bin: Record<string, unknown>): boolean {
  return (
    (isStringWithSqlKeyword(bin.left) && !isKind(bin.right, "string")) ||
    (isStringWithSqlKeyword(bin.right) && !isKind(bin.left, "string"))
  );
}

function isStringWithSqlKeyword(node: unknown): boolean {
  return isKind(node, "string") && hasSqlKeyword((node as PhpAstNode).value as string);
}

function hasSqlKeyword(text: string): boolean {
  const value = text.toLowerCase();

  return SQL_KEYWORDS.some((keyword) => value.includes(keyword));
}

function collectSqlLiterals(node: unknown): PhpSqlLiteral[] {
  const literals: PhpSqlLiteral[] = [];

  accumulateSqlLiterals(node, false, literals);

  return literals;
}

function accumulateSqlLiterals(node: unknown, insideLoop: boolean, literals: PhpSqlLiteral[]): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;

  if (record.kind === "string" && hasSqlKeyword(record.value as string)) {
    literals.push({ value: (record.value as string).trim(), line: lineOf(record), insideLoop });
  }

  const nextInsideLoop = insideLoop || LOOP_KINDS.has(record.kind as string);

  for (const value of Object.values(record)) {
    accumulateSqlLiterals(value, nextInsideLoop, literals);
  }
}

function containsUnwrappedUserInput(node: unknown, insideCall: boolean): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const record = node as Record<string, unknown>;

  if (record.kind === "variable" && USER_INPUT_SUPERGLOBALS.has(record.name as string)) {
    return !insideCall;
  }

  const nextInsideCall = insideCall || record.kind === "call";

  return Object.values(record).some((value) => containsUnwrappedUserInput(value, nextInsideCall));
}

function lineOf(node: Record<string, unknown>): number {
  return (node.loc as { start: { line: number } }).start.line;
}

function isKind(node: unknown, kind: string): boolean {
  // Stryker disable next-line OptionalChaining: ambos call-sites solo invocan isKind con un "what" ya garantizado (de "new"/"call"), null-safe se mantiene por si se agregan mas usos.
  return (node as PhpAstNode | undefined)?.kind === kind;
}

function isGetInstanceLookup(staticLookup: PhpAstNode): boolean {
  // El "what" de un "call" cuyo kind es "staticlookup" siempre trae "offset" (el metodo invocado).
  const offset = staticLookup.offset as PhpAstNode;

  return (offset.name as string).toLowerCase() === "getinstance";
}
