import path from "node:path";
import { parse } from "@babel/parser";
const FUNCTION_KINDS = {
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
const JQUERY_NAMES = new Set(["$", "jQuery"]);
const JQUERY_HTTP_METHODS = new Set(["ajax", "get", "post", "getJSON"]);
const CRUD_METHODS = new Set(["all", "single", "edit", "create", "delete"]);
const HTML_SINK_PROPERTIES = new Set(["innerHTML", "outerHTML"]);
export class BabelJsParser {
    parse(file, source) {
        const program = parse(source, { sourceType: "unambiguous", plugins: pluginsFor(file) })
            .program;
        const body = program.body;
        const facts = { imports: [], securityIssues: [], httpCalls: [], globalAccesses: [] };
        walk(program, (node, ancestors) => collectFileFacts(node, facts, scopeOf(ancestors)));
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
function pluginsFor(file) {
    const extension = path.extname(file).toLowerCase();
    if (extension === ".ts")
        return ["typescript"];
    if (extension === ".tsx")
        return ["typescript", "jsx"];
    return ["jsx", "decorators-legacy"];
}
// ---------- Recorrido generico ----------
function isNode(value) {
    // Stryker disable next-line ConditionalExpression: equivalente. Los unicos objetos sin `type` del AST
    // de Babel (`loc`, `extra`, `value` de un TemplateElement) no matchean ninguna regla de este parser:
    // recorrerlos o tomarlos como nodo no cambia ningun resultado.
    return typeof value === "object" && value !== null && typeof value.type === "string";
}
// Pre-orden en orden de aparicion. Solo baja por nodos (los `loc`/`extra` no tienen `type`).
// `ancestors` va de la raiz al padre del nodo visitado.
function walk(node, visit, ancestors = []) {
    visit(node, ancestors);
    const path = [...ancestors, node];
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            value.filter(isNode).forEach((child) => walk(child, visit, path));
        }
        else if (isNode(value)) {
            walk(value, visit, path);
        }
    }
}
// Funcion mas cercana que contiene al nodo; el Program (primer ancestro) si no hay ninguna.
function scopeOf(ancestors) {
    return [...ancestors].reverse().find(isFunctionNode) ?? ancestors[0];
}
function countNodes(root, predicate) {
    let count = 0;
    walk(root, (node) => {
        if (predicate(node))
            count += 1;
    });
    return count;
}
function lineOf(node) {
    return node.loc.start.line;
}
function identifierName(node) {
    return isNode(node) && node.type === "Identifier" ? node.name : null;
}
// Nombre de una clave NO computada: identificador, privada (`#x`) o literal (string/numero).
function keyName(key) {
    if (key.type === "Identifier")
        return key.name;
    if (key.type === "PrivateName")
        return `#${key.id.name}`;
    return String(key.value);
}
// ---------- Funciones y clases de nivel superior ----------
function unwrapExport(node) {
    if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
        return isNode(node.declaration) ? node.declaration : null;
    }
    return node;
}
function topLevelFunctions(statement) {
    const node = unwrapExport(statement);
    if (node === null)
        return [];
    if (node.type === "VariableDeclaration") {
        return node.declarations
            .filter((declarator) => identifierName(declarator.id) !== null && isFunctionNode(declarator.init))
            .map((declarator) => toFunctionStructure(identifierName(declarator.id), declarator.init, declarator.init));
    }
    if (isFunctionNode(node)) {
        return [toFunctionStructure(identifierName(node.id) ?? "default", node, node)];
    }
    return [];
}
function topLevelClasses(statement) {
    const node = unwrapExport(statement);
    return node !== null && node.type === "ClassDeclaration" ? [toClassStructure(node)] : [];
}
function isFunctionNode(node) {
    return isNode(node) && node.type in FUNCTION_KINDS;
}
// `span` da el rango de lineas (la propiedad de clase entera); `fn` da kind, params y cuerpo.
function toFunctionStructure(name, span, fn) {
    const body = fn.body;
    return {
        name,
        kind: FUNCTION_KINDS[fn.type],
        startLine: span.loc.start.line,
        endLine: span.loc.end.line,
        parametersCount: fn.params.length,
        decisionPointsCount: countNodes(body, isDecisionPoint),
        containsJsx: countNodes(body, (node) => JSX_NODE_TYPES.has(node.type)) > 0,
    };
}
function isDecisionPoint(node) {
    if (node.type === "SwitchCase")
        return node.test !== null;
    return DECISION_NODE_TYPES.has(node.type);
}
function toClassStructure(node) {
    const members = node.body.body;
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
function qualifiedName(node) {
    if (!isNode(node))
        return null;
    if (node.type === "Identifier")
        return node.name;
    if (node.computed)
        return null;
    const objectName = qualifiedName(node.object);
    return objectName === null ? null : `${objectName}.${keyName(node.property)}`;
}
function classMemberFunction(member) {
    const name = member.computed ? "[computed]" : keyName(member.key);
    // Metodo de clase: el propio miembro es la funcion. Propiedad de clase: lo es su valor.
    const fn = member.type in FUNCTION_KINDS ? member : member.value;
    return isFunctionNode(fn) ? [toFunctionStructure(name, member, fn)] : [];
}
// Claves del objeto asignado al estado: `this.state = {…}` en cualquier metodo, o la propiedad
// de clase `state = {…}`. El maximo, porque un reset puede reasignar el estado completo.
function stateKeysCount(classNode) {
    let max = 0;
    walk(classNode.body, (node) => {
        const stateObject = stateObjectOf(node);
        if (stateObject !== null) {
            max = Math.max(max, stateObject.properties.length);
        }
    });
    return max;
}
function stateObjectOf(node) {
    const isStateProperty = node.type === "ClassProperty" && keyName(node.key) === "state";
    const isThisStateAssignment = node.type === "AssignmentExpression" &&
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
function collectFileFacts(node, facts, scope) {
    const importRef = importOf(node);
    if (importRef !== null)
        facts.imports.push(importRef);
    const securityRule = securityRuleOf(node);
    if (securityRule !== null)
        facts.securityIssues.push({ rule: securityRule, line: lineOf(node) });
    const httpCall = httpCallOf(node, scope);
    if (httpCall !== null)
        facts.httpCalls.push(httpCall);
    const globalKind = globalAccessOf(node);
    if (globalKind !== null)
        facts.globalAccesses.push({ kind: globalKind, line: lineOf(node) });
}
// ---------- Exports (XRay X2) ----------
function exportsOf(statement) {
    const line = statement.loc.start.line;
    const named = (names) => names.map((name) => ({ name, line }));
    if (statement.type === "ExportDefaultDeclaration") {
        return named(["default"]);
    }
    // `export * from "m"` no nombra nada (`export * as ns` llega como ExportNamedDeclaration).
    // Solo valores: `export type …` / `export interface …` / `export type { X }` son contrato de tipos.
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") {
        return [];
    }
    const values = statement.specifiers.filter((specifier) => specifier.exportKind !== "type");
    return named([...declaredNames(statement.declaration), ...values.map((specifier) => keyName(specifier.exported))]);
}
// Nombres que declara `export <declaracion>` (una desestructuracion no cuenta).
function declaredNames(declaration) {
    if (!isNode(declaration)) {
        return [];
    }
    const ids = declaration.type === "VariableDeclaration" ? declaration.declarations.map((declarator) => declarator.id) : [declaration.id];
    return ids.map(identifierName).filter((name) => name !== null);
}
function importOf(node) {
    if (node.type === "ImportDeclaration") {
        return { source: node.source.value, names: node.specifiers.map(importedName), line: lineOf(node) };
    }
    if (node.type === "ExportNamedDeclaration" && isNode(node.source)) {
        return { source: node.source.value, names: node.specifiers.map(importedName), line: lineOf(node) };
    }
    if (node.type === "ExportAllDeclaration") {
        return { source: node.source.value, names: ["*"], line: lineOf(node) };
    }
    // Babel 7 representa `import("m")` como CallExpression con callee `Import`. Con template literal
    // queda como patron dinamico (`./config.${}`) que los analizadores resuelven contra los archivos.
    if (isRequireOrDynamicImport(node.callee)) {
        const [first] = node.arguments;
        const source = isNode(first) ? literalText(first) : null;
        return source === null ? null : { source, names: [], line: lineOf(node) };
    }
    return null;
}
function isRequireOrDynamicImport(callee) {
    return identifierName(callee) === "require" || (isNode(callee) && callee.type === "Import");
}
// Nombre tal como lo exporta el modulo de origen (no el alias local).
function importedName(specifier) {
    if (specifier.type === "ImportDefaultSpecifier")
        return "default";
    if (specifier.type === "ImportNamespaceSpecifier" || specifier.type === "ExportNamespaceSpecifier")
        return "*";
    const exported = (specifier.type === "ExportSpecifier" ? specifier.local : specifier.imported);
    return keyName(exported);
}
function securityRuleOf(node) {
    if (node.type === "JSXAttribute" && node.name.name === "dangerouslySetInnerHTML") {
        return "dangerously-set-inner-html";
    }
    // Solo las llamadas (call/new) tienen `callee`.
    if (identifierName(node.callee) === "eval")
        return "eval-usage";
    if (identifierName(node.callee) === "Function")
        return "new-function";
    if (node.type === "AssignmentExpression" && isHtmlSink(node.left)) {
        return "inner-html-assignment";
    }
    return null;
}
function isHtmlSink(target) {
    return isNode(target) && !target.computed && HTML_SINK_PROPERTIES.has(identifierName(target.property));
}
function httpCallOf(node, scope) {
    if (!isNode(node.callee))
        return null;
    const callee = node.callee;
    const [first] = node.arguments;
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
function endpointOf(argument) {
    if (!isNode(argument))
        return null;
    if (argument.type === "ObjectExpression")
        return endpointOf(propertyValue(argument, "url"));
    return literalText(argument);
}
function literalText(node) {
    if (node.type === "StringLiteral")
        return node.value;
    if (node.type === "TemplateLiteral") {
        return node.quasis.map((quasi) => quasi.value.cooked).join("${}");
    }
    return null;
}
// Las opciones van inline (`this.all({…})`) o en una variable armada antes en la misma funcion
// (`var options = {…}; this.all(options)`): en ese caso, el valor de la ultima declaracion que
// empieza en o antes de la linea de la llamada (crudEndpointOf exige que sea un objeto literal).
// Solo un VariableDeclarator tiene `id` + `init`.
function crudOptionsOf(argument, scope, line) {
    const name = identifierName(argument);
    if (name === null)
        return argument;
    let options;
    walk(scope, (node) => {
        if (identifierName(node.id) === name && lineOf(node) <= line) {
            options = node.init;
        }
    });
    return options;
}
function crudEndpointOf(argument) {
    if (!isNode(argument) || argument.type !== "ObjectExpression")
        return null;
    const method = propertyValue(argument, "method");
    const controller = propertyValue(argument, "controller");
    if (!isNode(method) || method.type !== "StringLiteral")
        return null;
    const prefix = isNode(controller) && controller.type === "StringLiteral" ? `${controller.value}/` : "";
    return `${prefix}${method.value}`;
}
function propertyValue(object, name) {
    const property = object.properties.find((candidate) => candidate.type === "ObjectProperty" && !candidate.computed && keyName(candidate.key) === name);
    return property?.value;
}
// `$(…)`/`new $(…)` por el callee; `$.x`, `window.x`, `document.x` (incluido `?.`) por el object.
function globalAccessOf(node) {
    if (JQUERY_NAMES.has(identifierName(node.callee)))
        return "jquery";
    const objectName = identifierName(node.object);
    if (JQUERY_NAMES.has(objectName))
        return "jquery";
    if (objectName === "document")
        return "dom";
    if (objectName === "window") {
        return !node.computed && JQUERY_NAMES.has(identifierName(node.property)) ? "jquery" : "window";
    }
    return null;
}
