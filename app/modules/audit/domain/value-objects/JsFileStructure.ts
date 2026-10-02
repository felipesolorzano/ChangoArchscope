export type JsFunctionKind = "function" | "arrow" | "method";

export type JsFunctionStructure = {
  name: string;
  kind: JsFunctionKind;
  startLine: number;
  endLine: number;
  parametersCount: number;
  decisionPointsCount: number;
  containsJsx: boolean;
};

export type JsClassStructure = {
  name: string;
  startLine: number;
  endLine: number;
  extendsName: string | null;
  methods: JsFunctionStructure[];
  stateKeysCount: number;
};

export type JsImport = {
  source: string;
  names: string[];
  line: number;
};

/** Nombre que el archivo exporta (XRay X2), con la linea de su sentencia. */
export type JsExport = {
  name: string;
  line: number;
};

export type JsSecurityIssue = {
  rule: "dangerously-set-inner-html" | "eval-usage" | "new-function" | "inner-html-assignment";
  line: number;
};

export type JsHttpCall = {
  client: "fetch" | "axios" | "jquery-ajax" | "request" | "crud";
  endpoint: string | null;
  line: number;
};

export type JsGlobalAccess = {
  kind: "jquery" | "window" | "dom";
  line: number;
};

export type JsFileStructure = {
  file: string;
  linesCount: number;
  classes: JsClassStructure[];
  functions: JsFunctionStructure[];
  imports: JsImport[];
  exports: JsExport[];
  securityIssues: JsSecurityIssue[];
  httpCalls: JsHttpCall[];
  globalAccesses: JsGlobalAccess[];
};

export type JsParseFailure = {
  file: string;
  error: string;
};
