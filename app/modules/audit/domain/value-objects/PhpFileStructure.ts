export type PhpMethodStructure = {
  name: string;
  startLine: number;
  endLine: number;
  parametersCount: number;
  decisionPointsCount: number;
  directInstantiationsCount: number;
  staticCallsCount: number;
  singletonAccessCount: number;
  globalAccessCount: number;
};

export type PhpClassStructure = {
  name: string;
  startLine: number;
  endLine: number;
  extendsName: string | null;
  methods: PhpMethodStructure[];
};

export type PhpSecurityIssue = {
  rule: "sql-concatenation" | "unsanitized-output" | "eval-usage" | "dynamic-include";
  line: number;
};

export type PhpSqlLiteral = {
  value: string;
  line: number;
  insideLoop: boolean;
};

export type PhpFileStructure = {
  file: string;
  classes: PhpClassStructure[];
  functions: PhpMethodStructure[];
  referencedNames: string[];
  securityIssues: PhpSecurityIssue[];
  sqlLiterals: PhpSqlLiteral[];
};
