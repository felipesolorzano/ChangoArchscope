import path from "node:path";

import { parse, type ParserPlugin } from "@babel/parser";

import type { JsSourceParser } from "../../domain/repositories/JsSourceParser.js";
import type {
  JsClassStructure,
  JsExport,
  JsFileStructure,
  JsFunctionKind,
  JsFunctionStructure,
  JsGlobalAccess,
  JsHttpCall,
  JsImport,
  JsLegacyReactApi,
  JsSecurityIssue,
} from "../../domain/value-objects/JsFileStructure.js";

type AstNode = {
  type: string;
  loc: { start: { line: number }; end: { line: number } };
  [key: string]: unknown;
};

type FileFacts = {
  imports: JsImport[];
  securityIssues: JsSecurityIssue[];
  httpCalls: JsHttpCall[];
  globalAccesses: JsGlobalAccess[];
  legacyReactApis: JsLegacyReactApi[];
};

type LegacyApi = JsLegacyReactApi["api"];

// Locales importados de `react-dom`: objetos (default/namespace) y funciones nombradas con su API.
type ReactDomBindings = { objects: Set<string | null>; functions: Map<string | null, LegacyApi> };

const FUNCTION_KINDS: Record<string, JsFunctionKind> = {
  FunctionDeclaration: "function",
  FunctionExpression: "function",
  ArrowFunctionExpression: "arrow",
  ClassMethod: "method",
  ClassPrivateMethod: "method",
};
const DECISION_NODE_TYPES = new Set([
  "IfStatement",
  "ConditionalExpression",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause",
  "LogicalExpression",
]);
const JSX_NODE_TYPES = new Set(["JSXElement", "JSXFragment"]);
// Aceptan `null` (identifierName de algo que no es identificador): `has(null)` es simplemente false.
const JQUERY_NAMES = new Set<string | null>(["$", "jQuery"]);
const JQUERY_HTTP_METHODS = new Set<string | null>(["ajax", "get", "post", "getJSON"]);
const CRUD_METHODS = new Set<string | null>(["all", "single", "edit", "create", "delete"]);
const HTML_SINK_PROPERTIES = new Set<string | null>(["innerHTML", "outerHTML"]);
const REACT_DOM_APIS = new Set<string | null>(["render", "hydrate", "unmountComponentAtNode", "findDOMNode"]);

export class BabelJsParser implements JsSourceParser {
  parse(file: string, source: string): JsFileStructure {
    const program = (parse(source, { sourceType: "unambiguous", plugins: pluginsFor(file) }) as unknown as { program: AstNode })
      .program;
    const body = program.body as AstNode[];
    const facts: FileFacts = { imports: [], securityIssues: [], httpCalls: [], globalAccesses: [], legacyReactApis: [] };
    const reactDom = reactDomBindings(body);

    walk(program, (node, ancestors) => collectFileFacts(node, facts, scopeOf(ancestors), reactDom));

    return {
      file,
      linesCount: source.split("\n").length,
      classes: body.flatMap(topLevelClasses),
      functions: body.flatMap(topLevelFunctions),
      exports: body.flatMap(exportsOf),
      ...facts,
    };
  }
}

function pluginsFor(file: string): ParserPlugin[] {
  const extension = path.extname(file).toLowerCase();

  if (extension === ".ts") return ["typescript"];
  if (extension === ".tsx") return ["typescript", "jsx"];
  return ["jsx", "decorators-legacy"];
}

// ---------- Recorrido generico ----------

function isNode(value: unknown): value is AstNode {
  // Stryker disable next-line ConditionalExpression: equivalente. Los unicos objetos sin `type` del AST
  // de Babel (`loc`, `extra`, `value` de un TemplateElement) no matchean ninguna regla de este parser:
  // recorrerlos o tomarlos como nodo no cambia ningun resultado.
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

// Pre-orden en orden de aparicion. Solo baja por nodos (los `loc`/`extra` no tienen `type`).
// `ancestors` va de la raiz al padre del nodo visitado.
function walk(node: AstNode, visit: (node: AstNode, ancestors: AstNode[]) => void, ancestors: AstNode[] = []): void {
  visit(node, ancestors);

  const path = [...ancestors, node];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.filter(isNode).forEach((child) => walk(child, visit, path));
    } else if (isNode(value)) {
      walk(value, visit, path);
    }
  }
}

// Funcion mas cercana que contiene al nodo; el Program (primer ancestro) si no hay ninguna.
function scopeOf(ancestors: AstNode[]): AstNode {
  return [...ancestors].reverse().find(isFunctionNode) ?? ancestors[0];
}

function countNodes(root: AstNode, predicate: (node: AstNode) => boolean): number {
  let count = 0;
  walk(root, (node) => {
    if (predicate(node)) count += 1;
  });
  return count;
}

function lineOf(node: AstNode): number {
  return node.loc.start.line;
}

function identifierName(node: unknown): string | null {
  return isNode(node) && node.type === "Identifier" ? (node.name as string) : null;
}

// Nombre de una clave NO computada: identificador, privada (`#x`) o literal (string/numero).
function keyName(key: AstNode): string {
  if (key.type === "Identifier") return key.name as string;
  if (key.type === "PrivateName") return `#${(key.id as AstNode).name as string}`;
  return String(key.value);
}

// ---------- Funciones y clases de nivel superior ----------

function unwrapExport(node: AstNode): AstNode | null {
  if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
    return isNode(node.declaration) ? node.declaration : null;
  }
  return node;
}

function topLevelFunctions(statement: AstNode): JsFunctionStructure[] {
  const node = unwrapExport(statement);

  if (node === null) return [];

  if (node.type === "VariableDeclaration") {
    return (node.declarations as AstNode[])
      .filter((declarator) => identifierName(declarator.id) !== null && isFunctionNode(declarator.init))
      .map((declarator) => toFunctionStructure(identifierName(declarator.id)!, declarator.init as AstNode, declarator.init as AstNode));
  }

  if (isFunctionNode(node)) {
    return [toFunctionStructure(identifierName(node.id) ?? "default", node, node)];
  }

  return [];
}

function topLevelClasses(statement: AstNode): JsClassStructure[] {
  const node = unwrapExport(statement);

  return node !== null && node.type === "ClassDeclaration" ? [toClassStructure(node)] : [];
}

function isFunctionNode(node: unknown): node is AstNode {
  return isNode(node) && node.type in FUNCTION_KINDS;
}

// `span` da el rango de lineas (la propiedad de clase entera); `fn` da kind, params y cuerpo.
function toFunctionStructure(name: string, span: AstNode, fn: AstNode): JsFunctionStructure {
  const body = fn.body as AstNode;

  return {
    name,
    kind: FUNCTION_KINDS[fn.type],
    startLine: span.loc.start.line,
    endLine: span.loc.end.line,
    parametersCount: (fn.params as AstNode[]).length,
    decisionPointsCount: countNodes(body, isDecisionPoint),
    containsJsx: countNodes(body, (node) => JSX_NODE_TYPES.has(node.type)) > 0,
  };
}

function isDecisionPoint(node: AstNode): boolean {
  if (node.type === "SwitchCase") return node.test !== null;
  return DECISION_NODE_TYPES.has(node.type);
}

function toClassStructure(node: AstNode): JsClassStructure {
  const members = (node.body as AstNode).body as AstNode[];

  return {
    name: identifierName(node.id) ?? "default",
    startLine: node.loc.start.line,
    endLine: node.loc.end.line,
    extendsName: qualifiedName(node.superClass),
    methods: members.flatMap(classMemberFunction),
    stateKeysCount: stateKeysCount(node),
  };
}

// `Global`, `React.Component`, `a.b.C`; null para cualquier cosa no nombrable (llamadas,
// accesos computados). Un nodo sin `object` (p. ej. una llamada) cae en `qualifiedName(undefined)`.
function qualifiedName(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "Identifier") return node.name as string;
  if (node.computed) return null;

  const objectName = qualifiedName(node.object);

  return objectName === null ? null : `${objectName}.${keyName(node.property as AstNode)}`;
}

function classMemberFunction(member: AstNode): JsFunctionStructure[] {
  const name = member.computed ? "[computed]" : keyName(member.key as AstNode);
  // Metodo de clase: el propio miembro es la funcion. Propiedad de clase: lo es su valor.
  const fn = member.type in FUNCTION_KINDS ? member : member.value;

  return isFunctionNode(fn) ? [toFunctionStructure(name, member, fn)] : [];
}

// Claves del objeto asignado al estado: `this.state = {…}` en cualquier metodo, o la propiedad
// de clase `state = {…}`. El maximo, porque un reset puede reasignar el estado completo.
function stateKeysCount(classNode: AstNode): number {
  let max = 0;

  walk(classNode.body as AstNode, (node) => {
    const stateObject = stateObjectOf(node);
    if (stateObject !== null) {
      max = Math.max(max, (stateObject.properties as AstNode[]).length);
    }
  });

  return max;
}

function stateObjectOf(node: AstNode): AstNode | null {
  const isStateProperty = node.type === "ClassProperty" && keyName(node.key as AstNode) === "state";
  const isThisStateAssignment =
    node.type === "AssignmentExpression" &&
    isNode(node.left) &&
    // Stryker disable next-line ConditionalExpression: equivalente. El unico `left` con `object` ===
    // ThisExpression y `property` no computada es un MemberExpression (un OptionalMemberExpression no
    // puede ser destino de una asignacion).
    node.left.type === "MemberExpression" &&
    isNode(node.left.object) &&
    node.left.object.type === "ThisExpression" &&
    !node.left.computed &&
    identifierName(node.left.property) === "state";
  const value = isStateProperty ? node.value : isThisStateAssignment ? node.right : null;

  return isNode(value) && value.type === "ObjectExpression" ? value : null;
}

// ---------- Hechos a nivel archivo ----------

function collectFileFacts(node: AstNode, facts: FileFacts, scope: AstNode, reactDom: ReactDomBindings): void {
  const importRef = importOf(node);
  if (importRef !== null) facts.imports.push(importRef);

  const securityRule = securityRuleOf(node);
  if (securityRule !== null) facts.securityIssues.push({ rule: securityRule, line: lineOf(node) });

  const httpCall = httpCallOf(node, scope);
  if (httpCall !== null) facts.httpCalls.push(httpCall);

  const globalKind = globalAccessOf(node);
  if (globalKind !== null) facts.globalAccesses.push({ kind: globalKind, line: lineOf(node) });

  const legacyApi = legacyReactApiOf(node, reactDom);
  if (legacyApi !== null) facts.legacyReactApis.push({ api: legacyApi, line: lineOf(node) });
}

// ---------- APIs legacy de React (XRay X5) ----------

// Los imports son de nivel superior: se leen antes del recorrido.
function reactDomBindings(body: AstNode[]): ReactDomBindings {
  const bindings: ReactDomBindings = { objects: new Set(), functions: new Map() };

  for (const statement of body.filter((node) => node.type === "ImportDeclaration" && (node.source as AstNode).value === "react-dom")) {
    for (const specifier of statement.specifiers as AstNode[]) {
      const local = identifierName(specifier.local);
      if (specifier.type !== "ImportSpecifier") {
        bindings.objects.add(local);
      } else if (REACT_DOM_APIS.has(keyName(specifier.imported as AstNode))) {
        bindings.functions.set(local, keyName(specifier.imported as AstNode) as LegacyApi);
      }
    }
  }

  return bindings;
}

// `ReactDOM.render(…)`, `render(…)` importado de react-dom, `ref="x"` y `this.refs`.
function legacyReactApiOf(node: AstNode, reactDom: ReactDomBindings): LegacyApi | null {
  if (node.type === "JSXAttribute" && (node.name as AstNode).name === "ref" && (node.value as AstNode | null)?.type === "StringLiteral") {
    return "string-ref";
  }
  if (node.type === "MemberExpression" && (node.object as AstNode).type === "ThisExpression" && !node.computed && identifierName(node.property) === "refs") {
    return "string-ref";
  }
  if (node.type !== "CallExpression") {
    return null;
  }
  const callee = node.callee as AstNode;
  const named = reactDom.functions.get(identifierName(callee));
  if (named !== undefined) {
    return named;
  }
  const member = identifierName(callee.property);
  return !callee.computed && reactDom.objects.has(identifierName(callee.object)) && REACT_DOM_APIS.has(member) ? (member as LegacyApi) : null;
}

// ---------- Exports (XRay X2) ----------

function exportsOf(statement: AstNode): JsExport[] {
  const line = statement.loc.start.line;
  const named = (names: string[]) => names.map((name) => ({ name, line }));

  if (statement.type === "ExportDefaultDeclaration") {
    const local = defaultLocal(statement.declaration as AstNode);
    return [local === null ? { name: "default", line } : { name: "default", line, local }];
  }
  // `export * from "m"` no nombra nada (`export * as ns` llega como ExportNamedDeclaration).
  // Solo valores: `export type …` / `export interface …` / `export type { X }` son contrato de tipos.
  if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") {
    return [];
  }
  const values = (statement.specifiers as AstNode[]).filter((specifier) => specifier.exportKind !== "type");
  return named([...declaredNames(statement.declaration), ...values.map((specifier) => keyName(specifier.exported as AstNode))]);
}

// A que identificador apunta `export default …`: el mismo, el de la declaracion o el que envuelve un
// HOC (`withRouter(Foo)`, `connect(m)(Foo)`): primero los argumentos, despues un callee que es llamada.
function defaultLocal(node: AstNode): string | null {
  if (node.type === "ClassDeclaration" || node.type === "FunctionDeclaration") {
    return identifierName(node.id);
  }
  if (node.type !== "CallExpression") {
    return identifierName(node);
  }
  const callee = node.callee as AstNode;
  const args = node.arguments as AstNode[];
  for (const candidate of callee.type === "CallExpression" ? [...args, callee] : args) {
    const local = defaultLocal(candidate);
    if (local !== null) {
      return local;
    }
  }
  return null;
}

// Nombres que declara `export <declaracion>` (una desestructuracion no cuenta).
function declaredNames(declaration: unknown): string[] {
  if (!isNode(declaration)) {
    return [];
  }
  const ids = declaration.type === "VariableDeclaration" ? (declaration.declarations as AstNode[]).map((declarator) => declarator.id) : [declaration.id];
  return ids.map(identifierName).filter((name): name is string => name !== null);
}

function importOf(node: AstNode): JsImport | null {
  if (node.type === "ImportDeclaration") {
    return { source: (node.source as AstNode).value as string, names: (node.specifiers as AstNode[]).map(importedName), line: lineOf(node) };
  }

  if (node.type === "ExportNamedDeclaration" && isNode(node.source)) {
    return { source: node.source.value as string, names: (node.specifiers as AstNode[]).map(importedName), line: lineOf(node) };
  }

  if (node.type === "ExportAllDeclaration") {
    return { source: (node.source as AstNode).value as string, names: ["*"], line: lineOf(node) };
  }

  // Babel 7 representa `import("m")` como CallExpression con callee `Import`. Con template literal
  // queda como patron dinamico (`./config.${}`) que los analizadores resuelven contra los archivos.
  if (isRequireOrDynamicImport(node.callee)) {
    const [first] = node.arguments as AstNode[];
    const source = isNode(first) ? literalText(first) : null;
    return source === null ? null : { source, names: [], line: lineOf(node) };
  }

  return null;
}

function isRequireOrDynamicImport(callee: unknown): boolean {
  return identifierName(callee) === "require" || (isNode(callee) && callee.type === "Import");
}

// Nombre tal como lo exporta el modulo de origen (no el alias local).
function importedName(specifier: AstNode): string {
  if (specifier.type === "ImportDefaultSpecifier") return "default";
  if (specifier.type === "ImportNamespaceSpecifier" || specifier.type === "ExportNamespaceSpecifier") return "*";
  const exported = (specifier.type === "ExportSpecifier" ? specifier.local : specifier.imported) as AstNode;
  return keyName(exported);
}

function securityRuleOf(node: AstNode): JsSecurityIssue["rule"] | null {
  if (node.type === "JSXAttribute" && (node.name as AstNode).name === "dangerouslySetInnerHTML") {
    return "dangerously-set-inner-html";
  }
  // Solo las llamadas (call/new) tienen `callee`.
  if (identifierName(node.callee) === "eval") return "eval-usage";
  if (identifierName(node.callee) === "Function") return "new-function";
  if (node.type === "AssignmentExpression" && isHtmlSink(node.left)) {
    return "inner-html-assignment";
  }
  return null;
}

function isHtmlSink(target: unknown): boolean {
  return isNode(target) && !target.computed && HTML_SINK_PROPERTIES.has(identifierName(target.property));
}

function httpCallOf(node: AstNode, scope: AstNode): JsHttpCall | null {
  if (!isNode(node.callee)) return null;

  const callee = node.callee;
  const [first] = node.arguments as AstNode[];
  const calleeName = identifierName(callee);
  // Un callee identificador no tiene object/property: ambos quedan en null.
  const objectName = identifierName(callee.object);
  const propertyName = identifierName(callee.property);
  const line = lineOf(node);

  if (calleeName === "fetch" || calleeName === "request" || calleeName === "axios") {
    return { client: calleeName, endpoint: endpointOf(first), line };
  }
  if (objectName === "axios") {
    return { client: "axios", endpoint: endpointOf(first), line };
  }
  if (JQUERY_NAMES.has(objectName) && JQUERY_HTTP_METHODS.has(propertyName)) {
    return { client: "jquery-ajax", endpoint: endpointOf(first), line };
  }
  if (isNode(callee.object) && callee.object.type === "ThisExpression" && CRUD_METHODS.has(propertyName)) {
    const endpoint = crudEndpointOf(crudOptionsOf(first, scope, line));
    return endpoint === null ? null : { client: "crud", endpoint, line };
  }
  return null;
}

function endpointOf(argument: AstNode | undefined): string | null {
  if (!isNode(argument)) return null;
  if (argument.type === "ObjectExpression") return endpointOf(propertyValue(argument, "url"));
  return literalText(argument);
}

function literalText(node: AstNode): string | null {
  if (node.type === "StringLiteral") return node.value as string;
  if (node.type === "TemplateLiteral") {
    return (node.quasis as AstNode[]).map((quasi) => (quasi.value as { cooked: string }).cooked).join("${}");
  }
  return null;
}

// Las opciones van inline (`this.all({…})`) o en una variable armada antes en la misma funcion
// (`var options = {…}; this.all(options)`): en ese caso, el valor de la ultima declaracion que
// empieza en o antes de la linea de la llamada (crudEndpointOf exige que sea un objeto literal).
// Solo un VariableDeclarator tiene `id` + `init`.
function crudOptionsOf(argument: AstNode | undefined, scope: AstNode, line: number): unknown {
  const name = identifierName(argument);

  if (name === null) return argument;

  let options: unknown;
  walk(scope, (node) => {
    if (identifierName(node.id) === name && lineOf(node) <= line) {
      options = node.init;
    }
  });

  return options;
}

function crudEndpointOf(argument: unknown): string | null {
  if (!isNode(argument) || argument.type !== "ObjectExpression") return null;

  const method = propertyValue(argument, "method");
  const controller = propertyValue(argument, "controller");

  if (!isNode(method) || method.type !== "StringLiteral") return null;

  const prefix = isNode(controller) && controller.type === "StringLiteral" ? `${controller.value as string}/` : "";
  return `${prefix}${method.value as string}`;
}

function propertyValue(object: AstNode, name: string): AstNode | undefined {
  const property = (object.properties as AstNode[]).find(
    (candidate) => candidate.type === "ObjectProperty" && !candidate.computed && keyName(candidate.key as AstNode) === name,
  );
  return property?.value as AstNode | undefined;
}

// `$(…)`/`new $(…)` por el callee; `$.x`, `window.x`, `document.x` (incluido `?.`) por el object.
function globalAccessOf(node: AstNode): JsGlobalAccess["kind"] | null {
  if (JQUERY_NAMES.has(identifierName(node.callee))) return "jquery";

  const objectName = identifierName(node.object);

  if (JQUERY_NAMES.has(objectName)) return "jquery";
  if (objectName === "document") return "dom";
  if (objectName === "window") {
    return !node.computed && JQUERY_NAMES.has(identifierName(node.property)) ? "jquery" : "window";
  }
  return null;
}
