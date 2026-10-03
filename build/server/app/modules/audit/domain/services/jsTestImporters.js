import { resolveJsImport } from "./jsImportResolution.js";
const TEST_FILE_PATTERN = /\.(?:test|spec)\.|\/__tests__\//;
export function isJsTestFile(file) {
    return TEST_FILE_PATTERN.test(file);
}
/** Por archivo, los tests que lo importan directamente (ordenados). Un test no se cubre a si mismo. */
export function jsTestImporters(files) {
    const known = new Set(files.map((file) => file.file));
    const importers = new Map();
    for (const test of files.filter((file) => isJsTestFile(file.file))) {
        for (const importRef of test.imports) {
            for (const target of resolveJsImport(test.file, importRef.source, known).filter((resolved) => resolved !== test.file)) {
                importers.set(target, (importers.get(target) ?? new Set()).add(test.file));
            }
        }
    }
    return Object.fromEntries([...importers].map(([file, tests]) => [file, [...tests].sort()]));
}
