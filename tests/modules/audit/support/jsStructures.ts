import type {
  JsClassStructure,
  JsFileStructure,
  JsFunctionStructure,
} from "../../../../app/modules/audit/domain/value-objects/JsFileStructure.js";

export function jsFile(file: string, overrides: Partial<JsFileStructure> = {}): JsFileStructure {
  return {
    file,
    linesCount: 10,
    classes: [],
    functions: [],
    imports: [],
    securityIssues: [],
    httpCalls: [],
    globalAccesses: [],
    ...overrides,
  };
}

export function jsFunction(overrides: Partial<JsFunctionStructure> = {}): JsFunctionStructure {
  return {
    name: "fn",
    kind: "function",
    startLine: 1,
    endLine: 5,
    parametersCount: 0,
    decisionPointsCount: 0,
    containsJsx: false,
    ...overrides,
  };
}

export function jsMethod(overrides: Partial<JsFunctionStructure> = {}): JsFunctionStructure {
  return jsFunction({ name: "method", kind: "method", ...overrides });
}

export function jsClass(overrides: Partial<JsClassStructure> = {}): JsClassStructure {
  return {
    name: "Klass",
    startLine: 1,
    endLine: 20,
    extendsName: null,
    methods: [],
    stateKeysCount: 0,
    ...overrides,
  };
}

/** Clase componente minima: tiene `render`. */
export function jsComponentClass(overrides: Partial<JsClassStructure> = {}): JsClassStructure {
  return jsClass({ methods: [jsMethod({ name: "render", containsJsx: true })], ...overrides });
}
