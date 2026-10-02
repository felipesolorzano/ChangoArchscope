import { describe, expect, it } from "vitest";

import { BabelJsParser } from "../../../../../app/modules/audit/infrastructure/parser/BabelJsParser.js";

const parser = new BabelJsParser();
const parse = (source: string, file = "/src/a.js") => parser.parse(file, source);

describe("BabelJsParser — archivo", () => {
  it("devuelve el file y la cantidad de lineas", () => {
    const structure = parse("const a = 1;\nconst b = 2;\n");

    expect(structure.file).toBe("/src/a.js");
    expect(structure.linesCount).toBe(3);
  });

  it("un archivo vacio no tiene nada", () => {
    expect(parse("")).toEqual({
      file: "/src/a.js",
      linesCount: 1,
      classes: [],
      functions: [],
      imports: [],
      securityIssues: [],
      httpCalls: [],
      globalAccesses: [],
    });
  });

  it("lanza ante un error de sintaxis", () => {
    expect(() => parse("const = ;")).toThrow();
  });

  it("parsea JSX dentro de .js y CommonJS", () => {
    expect(() => parse("const x = require('a');\nmodule.exports = () => <div />;")).not.toThrow();
  });

  it("parsea decoradores legacy en .js", () => {
    expect(() => parse("@withRouter\nclass A {}")).not.toThrow();
  });

  it("parsea TypeScript en .ts (sin jsx: el cast <T> es valido)", () => {
    expect(() => parse("const a = <number>b; type T = { x: string };", "/src/a.ts")).not.toThrow();
  });

  it("parsea TypeScript + JSX en .tsx", () => {
    expect(() => parse("const C = (p: { x: string }) => <div>{p.x}</div>;", "/src/a.tsx")).not.toThrow();
  });

  it("tolera arrays con huecos (elementos null en el AST)", () => {
    expect(() => parse("const x = [1, , 2];")).not.toThrow();
  });

  it(".js no acepta anotaciones de TypeScript", () => {
    expect(() => parse("const a: number = 1;")).toThrow();
  });
});

describe("BabelJsParser — funciones de nivel superior", () => {
  it("declaracion de funcion con rango, parametros y kind", () => {
    const [fn] = parse("\nfunction sum(a, b, c) {\n  return a + b + c;\n}\n").functions;

    expect(fn).toEqual({
      name: "sum",
      kind: "function",
      startLine: 2,
      endLine: 4,
      parametersCount: 3,
      decisionPointsCount: 0,
      containsJsx: false,
    });
  });

  it("const con arrow y con function expression", () => {
    const { functions } = parse("const a = (x) => x;\nconst b = function () {};\n");

    expect(functions.map((fn) => [fn.name, fn.kind, fn.parametersCount])).toEqual([
      ["a", "arrow", 1],
      ["b", "function", 0],
    ]);
  });

  it("ignora variables que no son funciones y destructurings", () => {
    const { functions } = parse("const a = 1;\nconst { b } = obj;\nlet c;\nconst { d } = () => {};\n");

    expect(functions).toEqual([]);
  });

  it("un export sin declaracion no aporta funciones ni clases", () => {
    const structure = parse("const d = 1;\nexport { d };\n");

    expect(structure.functions).toEqual([]);
    expect(structure.classes).toEqual([]);
  });

  it("incluye las exportadas (named y default con nombre)", () => {
    const { functions } = parse("export function a() {}\nexport const b = () => 1;\nexport default function c() {}\n");

    expect(functions.map((fn) => fn.name)).toEqual(["a", "b", "c"]);
  });

  it("export default anonimo (function y arrow) se llama default", () => {
    expect(parse("export default function () {}").functions.map((fn) => [fn.name, fn.kind])).toEqual([["default", "function"]]);
    expect(parse("export default () => <div />;").functions.map((fn) => [fn.name, fn.kind])).toEqual([["default", "arrow"]]);
  });

  it("no lista funciones anidadas como de nivel superior", () => {
    const { functions } = parse("function outer() {\n  function inner() {}\n  const x = () => 1;\n}\n");

    expect(functions.map((fn) => fn.name)).toEqual(["outer"]);
  });

  it("containsJsx detecta elementos y fragmentos", () => {
    const { functions } = parse("const A = () => <div />;\nconst B = () => <></>;\nconst C = () => null;\n");

    expect(functions.map((fn) => fn.containsJsx)).toEqual([true, true, false]);
  });
});

describe("BabelJsParser — puntos de decision", () => {
  const count = (body: string) => parse(`function f(a, b) {\n${body}\n}`).functions[0].decisionPointsCount;

  it.each([
    ["if", "if (a) {}"],
    ["ternario", "const x = a ? 1 : 2;"],
    ["for", "for (let i = 0; i < 1; i++) {}"],
    ["for in", "for (const k in a) {}"],
    ["for of", "for (const v of a) {}"],
    ["while", "while (a) {}"],
    ["do while", "do {} while (a);"],
    ["catch", "try {} catch (e) {}"],
    ["&&", "const x = a && b;"],
    ["||", "const x = a || b;"],
    ["??", "const x = a ?? b;"],
  ])("%s suma 1", (_name, body) => {
    expect(count(body)).toBe(1);
  });

  it("cada case con test suma 1, default no", () => {
    expect(count("switch (a) { case 1: break; case 2: break; default: break; }")).toBe(2);
  });

  it("operadores no logicos no suman", () => {
    expect(count("const x = a + b; const y = a === b;")).toBe(0);
  });

  it("cuenta tambien dentro de funciones anidadas", () => {
    expect(count("const g = () => { if (a) {} };\nif (b) {}")).toBe(2);
  });
});

describe("BabelJsParser — clases", () => {
  it("clase con rango, extends identificador y metodos", () => {
    const [klass] = parse(
      "\nclass Tours extends Global {\n  constructor(props) {\n    super(props);\n  }\n  render() {\n    return <div />;\n  }\n}\n",
    ).classes;

    expect(klass).toMatchObject({ name: "Tours", startLine: 2, endLine: 9, extendsName: "Global", stateKeysCount: 0 });
    expect(klass.methods).toEqual([
      { name: "constructor", kind: "method", startLine: 3, endLine: 5, parametersCount: 1, decisionPointsCount: 0, containsJsx: false },
      { name: "render", kind: "method", startLine: 6, endLine: 8, parametersCount: 0, decisionPointsCount: 0, containsJsx: true },
    ]);
  });

  it("extends con member expression se une con punto; sin extends es null", () => {
    expect(parse("class A extends React.Component {}").classes[0].extendsName).toBe("React.Component");
    expect(parse("class A extends a.b.C {}").classes[0].extendsName).toBe("a.b.C");
    expect(parse("class A {}").classes[0].extendsName).toBeNull();
  });

  it("extends con una expresion no nombrable es null", () => {
    expect(parse("class A extends mixin(B) {}").classes[0].extendsName).toBeNull();
    expect(parse("class A extends mixin(B).Base {}").classes[0].extendsName).toBeNull();
    expect(parse("class A extends bases[0] {}").classes[0].extendsName).toBeNull();
    expect(parse("class A extends bases.list[0] {}").classes[0].extendsName).toBeNull();
  });

  it("nombres de metodo con clave string, privada y computada", () => {
    const { methods } = parse("class A {\n  'quoted'() {}\n  #secret() {}\n  [dynamic]() {}\n  0() {}\n}").classes[0];

    expect(methods.map((method) => [method.name, method.kind])).toEqual([
      ["quoted", "method"],
      ["#secret", "method"],
      ["[computed]", "method"],
      ["0", "method"],
    ]);
  });

  it("propiedades de clase con arrow o function cuentan como metodos con su kind; las demas no", () => {
    const { methods } = parse("class A {\n  handle = (e) => {};\n  other = function () {};\n  count = 1;\n  static x;\n}").classes[0];

    expect(methods.map((method) => [method.name, method.kind, method.parametersCount])).toEqual([
      ["handle", "arrow", 1],
      ["other", "function", 0],
    ]);
  });

  it("stateKeysCount cuenta las claves de this.state = {...} (el maximo)", () => {
    const { classes } = parse(
      "class A {\n  constructor() {\n    this.state = { a: 1, b: 2 };\n  }\n  reset() {\n    this.state = { a: 1, b: 2, c: 3 };\n  }\n}",
    );

    expect(classes[0].stateKeysCount).toBe(3);
  });

  it("stateKeysCount cuenta la propiedad de clase state = {...}", () => {
    expect(parse("class A {\n  state = { a: 1 };\n}").classes[0].stateKeysCount).toBe(1);
  });

  it("stateKeysCount ignora nodos con this.state a la izquierda que no son asignaciones", () => {
    expect(parse("class A {\n  m() {\n    for (this.state in { a: 1, b: 2 }) {}\n  }\n}").classes[0].stateKeysCount).toBe(0);
  });

  it("stateKeysCount ignora otras propiedades de clase con objeto", () => {
    expect(parse("class A {\n  defaults = { a: 1, b: 2 };\n}").classes[0].stateKeysCount).toBe(0);
  });

  it("stateKeysCount ignora otras asignaciones", () => {
    const source = "class A {\n  m() {\n    this.other = { a: 1 };\n    that.state = { a: 1, b: 2 };\n    this.state = makeState();\n  }\n}";

    expect(parse(source).classes[0].stateKeysCount).toBe(0);
  });

  it("clases exportadas y export default anonima", () => {
    expect(parse("export class A {}\nexport default class B {}").classes.map((klass) => klass.name)).toEqual(["A", "B"]);
    expect(parse("export default class extends Global {}").classes.map((klass) => klass.name)).toEqual(["default"]);
  });

  it("no lista clases anidadas en funciones", () => {
    expect(parse("function f() { class Inner {} }").classes).toEqual([]);
  });

  it("los metodos de clase no se listan como funciones de nivel superior", () => {
    expect(parse("class A { m() {} }").functions).toEqual([]);
  });
});

describe("BabelJsParser — imports", () => {
  it("import default, named (nombre importado), namespace y side-effect", () => {
    const { imports } = parse(
      "import React, { useState as us, Component } from 'react';\nimport * as ns from './ns';\nimport './style.css';\n",
    );

    expect(imports).toEqual([
      { source: "react", names: ["default", "useState", "Component"], line: 1 },
      { source: "./ns", names: ["*"], line: 2 },
      { source: "./style.css", names: [], line: 3 },
    ]);
  });

  it("require y import() con string literal; sin literal no cuentan", () => {
    const { imports } = parse("const a = require('./a');\nconst b = import('./b');\nrequire(name);\n");

    expect(imports).toEqual([
      { source: "./a", names: [], line: 1 },
      { source: "./b", names: [], line: 2 },
    ]);
  });

  it("require e import() con template literal son imports dinamicos (patron con ${})", () => {
    const { imports } = parse("const c = require(`./config.${brand}`);\nconst p = import(`./pages/${a}/${b}`);\nrequire(`${base}/x`);\n");

    expect(imports).toEqual([
      { source: "./config.${}", names: [], line: 1 },
      { source: "./pages/${}/${}", names: [], line: 2 },
      { source: "${}/x", names: [], line: 3 },
    ]);
  });

  it("otras llamadas con un string no son imports", () => {
    expect(parse("load('./a');\nobj.require('./b');").imports).toEqual([]);
  });

  it("export from cuenta como import con los nombres reexportados", () => {
    const { imports } = parse(
      "export { a, b as c } from './x';\nexport * from './y';\nexport * as ns from './z';\nconst d = 1;\nexport { d };\n",
    );

    expect(imports).toEqual([
      { source: "./x", names: ["a", "b"], line: 1 },
      { source: "./y", names: ["*"], line: 2 },
      { source: "./z", names: ["*"], line: 3 },
    ]);
  });

  it("import con nombre string (import { 'a-b' as x })", () => {
    expect(parse("import { 'a-b' as x } from './m';").imports).toEqual([{ source: "./m", names: ["a-b"], line: 1 }]);
  });
});

describe("BabelJsParser — seguridad", () => {
  it("detecta las cuatro reglas con su linea", () => {
    const { securityIssues } = parse(
      "const a = <div dangerouslySetInnerHTML={{ __html: x }} />;\neval(code);\nconst f = new Function('a', 'return a');\nel.innerHTML = x;\nel.outerHTML = y;\nconst g = Function('return 1');\n",
    );

    expect(securityIssues).toEqual([
      { rule: "dangerously-set-inner-html", line: 1 },
      { rule: "eval-usage", line: 2 },
      { rule: "new-function", line: 3 },
      { rule: "inner-html-assignment", line: 4 },
      { rule: "inner-html-assignment", line: 5 },
      { rule: "new-function", line: 6 },
    ]);
  });

  it("no marca casos parecidos pero seguros", () => {
    const { securityIssues } = parse(
      "const a = <div className='x' />;\nobj.eval(code);\nnew Fn();\nconst h = el.innerHTML;\nel.textContent = x;\nel[innerHTML] = x;\nconst s = el.innerHTML + x;\n",
    );

    expect(securityIssues).toEqual([]);
  });
});

describe("BabelJsParser — llamadas HTTP", () => {
  it("fetch con literal, template y variable", () => {
    const { httpCalls } = parse("fetch('/api/a');\nfetch(`${api}/GetTours?id=${id}`);\nfetch(url);\n");

    expect(httpCalls).toEqual([
      { client: "fetch", endpoint: "/api/a", line: 1 },
      { client: "fetch", endpoint: "${}/GetTours?id=${}", line: 2 },
      { client: "fetch", endpoint: null, line: 3 },
    ]);
  });

  it("fetch sin argumentos tiene endpoint null", () => {
    expect(parse("fetch();").httpCalls).toEqual([{ client: "fetch", endpoint: null, line: 1 }]);
  });

  it("axios directo y con metodo", () => {
    const { httpCalls } = parse("axios('/a');\naxios.post('/b', data);\n");

    expect(httpCalls).toEqual([
      { client: "axios", endpoint: "/a", line: 1 },
      { client: "axios", endpoint: "/b", line: 2 },
    ]);
  });

  it("jquery ajax/get/post/getJSON con $ y jQuery; url desde objeto", () => {
    const { httpCalls } = parse(
      "$.ajax({ url: '/a', dataType: 'json' });\njQuery.get('/b');\n$.post(`${base}/c`);\n$.getJSON('/d');\n$.ajax({ url: config.apiurl + path });\n",
    );

    expect(httpCalls).toEqual([
      { client: "jquery-ajax", endpoint: "/a", line: 1 },
      { client: "jquery-ajax", endpoint: "/b", line: 2 },
      { client: "jquery-ajax", endpoint: "${}/c", line: 3 },
      { client: "jquery-ajax", endpoint: "/d", line: 4 },
      { client: "jquery-ajax", endpoint: null, line: 5 },
    ]);
  });

  it("otros metodos de jQuery no son HTTP", () => {
    expect(parse("$.each(a, f);\n$('#x').hide();").httpCalls).toEqual([]);
  });

  it("request con string y con objeto { url }", () => {
    const { httpCalls } = parse("request(`${api}/GetTours`, cb);\nrequest({ url: '/x', method: 'POST' }, cb);\n");

    expect(httpCalls).toEqual([
      { client: "request", endpoint: "${}/GetTours", line: 1 },
      { client: "request", endpoint: "/x", line: 2 },
    ]);
  });

  it("crud: this.<op>({ method }) con y sin controller", () => {
    const { httpCalls } = parse(
      "class A {\n  m() {\n    this.all({ method: 'GetTours', query: q });\n    this.single({ controller: 'tours', method: 'GetTour' });\n    this.edit({ method: 'Save' });\n    this.create({ method: 'Add' });\n    this.delete({ method: 'Del' });\n  }\n}",
    );

    expect(httpCalls).toEqual([
      { client: "crud", endpoint: "GetTours", line: 3 },
      { client: "crud", endpoint: "tours/GetTour", line: 4 },
      { client: "crud", endpoint: "Save", line: 5 },
      { client: "crud", endpoint: "Add", line: 6 },
      { client: "crud", endpoint: "Del", line: 7 },
    ]);
  });

  it("crud resuelve opciones declaradas en una variable de la misma funcion", () => {
    const { httpCalls } = parse(
      "class A {\n  m() {\n    var options = { controller: 'tours', method: 'GetTourDetails' };\n    this.single(options);\n  }\n}",
    );

    expect(httpCalls).toEqual([{ client: "crud", endpoint: "tours/GetTourDetails", line: 4 }]);
  });

  it("crud usa la ultima declaracion antes de la llamada", () => {
    const { httpCalls } = parse(
      "function f() {\n  var o = { method: 'A' };\n  this.all(o);\n  var o = { method: 'B' };\n  this.all(o);\n}",
    );

    expect(httpCalls.map((call) => call.endpoint)).toEqual(["A", "B"]);
  });

  it("crud usa la ultima declaracion aunque no sea un objeto literal (endpoint desconocido)", () => {
    expect(parse("function f() {\n  var o = { method: 'A' };\n  var o = build();\n  this.all(o);\n}").httpCalls).toEqual([]);
  });

  it("crud no resuelve variables de una funcion externa desde un callback", () => {
    const source = "function outer() {\n  var o = { method: 'Outer' };\n  const inner = () => {\n    this.all(o);\n  };\n}";

    expect(parse(source).httpCalls).toEqual([]);
  });

  it("crud resuelve una declaracion en la misma linea de la llamada", () => {
    expect(parse("function f() { const o = { method: 'A' }; this.all(o); }").httpCalls.map((call) => call.endpoint)).toEqual(["A"]);
  });

  it("crud resuelve a nivel archivo cuando no hay funcion contenedora", () => {
    expect(parse("const o = { method: 'Top' };\nthis.all(o);").httpCalls.map((call) => call.endpoint)).toEqual(["Top"]);
  });

  it("crud no resuelve variables de otra funcion, posteriores, ni sin objeto literal", () => {
    const { httpCalls } = parse(
      "function a() { var o = { method: 'A' }; }\nfunction b() { this.all(o); }\nfunction c() {\n  this.all(p);\n  var p = { method: 'C' };\n}\nfunction d() { var q = build(); this.all(q); }\nfunction e() { var { r } = { method: 'E' }; this.all(r); }",
    );

    expect(httpCalls).toEqual([]);
  });

  it("crud tolera spread y metodos en el objeto de opciones", () => {
    expect(parse("this.all({ ...opts, cb() {}, method: 'GetTours' });").httpCalls).toEqual([
      { client: "crud", endpoint: "GetTours", line: 1 },
    ]);
  });

  it("crud con controller no literal usa solo el method", () => {
    expect(parse("this.all({ controller: c, method: 'GetTours' });").httpCalls).toEqual([
      { client: "crud", endpoint: "GetTours", line: 1 },
    ]);
  });

  it("no es crud sin method literal, sin objeto, fuera de this, u otro metodo", () => {
    const { httpCalls } = parse(
      "this.all({ method: name });\nthis.all();\nthis.all('x');\nother.all({ method: 'A' });\nthis.update({ method: 'A' });\nthis.all({ ['method']: 'A' });\n",
    );

    expect(httpCalls).toEqual([]);
  });
});

describe("BabelJsParser — accesos globales", () => {
  it("jquery, window y document con su linea", () => {
    const { globalAccesses } = parse(
      "$('#a');\njQuery('.b');\n$.each(x, f);\nconst $1 = window.$;\nwindow.jQuery.fn;\nwindow.location.href;\ndocument.getElementById('x');\n",
    );

    expect(globalAccesses).toEqual([
      { kind: "jquery", line: 1 },
      { kind: "jquery", line: 2 },
      { kind: "jquery", line: 3 },
      { kind: "jquery", line: 4 },
      { kind: "jquery", line: 5 },
      { kind: "window", line: 6 },
      { kind: "dom", line: 7 },
    ]);
  });

  it("$.ajax cuenta como acceso jquery ademas de llamada HTTP", () => {
    const structure = parse("$.ajax({ url: '/a' });");

    expect(structure.globalAccesses).toEqual([{ kind: "jquery", line: 1 }]);
    expect(structure.httpCalls).toHaveLength(1);
  });

  it("no cuenta identificadores parecidos ni propiedades llamadas window/document/$", () => {
    expect(parse("other.window.x;\nobj.$.y;\nconst w = win.x;\ndoc.x;\nfoo();\n").globalAccesses).toEqual([]);
  });
});
