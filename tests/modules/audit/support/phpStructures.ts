import type { PhpClassStructure, PhpFileStructure } from "../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";

export function phpFile(file: string, overrides: Partial<PhpFileStructure> = {}): PhpFileStructure {
  return {
    file,
    classes: [],
    functions: [],
    referencedNames: [],
    securityIssues: [],
    sqlLiterals: [],
    functionCalls: [],
    ...overrides,
  };
}

export function phpClass(name: string, extendsName: string | null = null): PhpClassStructure {
  return { name, startLine: 1, endLine: 10, extendsName, methods: [] };
}
