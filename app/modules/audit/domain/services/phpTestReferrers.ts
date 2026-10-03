import type { PhpClassStructure, PhpFileStructure } from "../value-objects/PhpFileStructure.js";

function isTestClass(classStructure: PhpClassStructure): boolean {
  return classStructure.extendsName?.endsWith("TestCase") ?? false;
}

/** Por archivo, los tests (clase `*TestCase`) que referencian alguna de sus clases (ordenados). */
export function phpTestReferrers(files: PhpFileStructure[]): Record<string, string[]> {
  const tests = files.filter((file) => file.classes.some(isTestClass));
  const referrers: Record<string, string[]> = {};

  for (const file of files) {
    const names = file.classes.filter((classStructure) => !isTestClass(classStructure)).map((classStructure) => classStructure.name);
    const covering = tests.filter((test) => names.some((name) => test.referencedNames.includes(name))).map((test) => test.file);
    if (covering.length > 0) {
      referrers[file.file] = covering.sort();
    }
  }

  return referrers;
}
