export function phpTestingAnalyzer(files) {
    const testReferencedNames = collectTestReferencedNames(files);
    return files.flatMap((file) => fileFindings(file, testReferencedNames));
}
function collectTestReferencedNames(files) {
    const names = new Set();
    for (const file of files) {
        if (file.classes.some((classStructure) => isTestClass(classStructure))) {
            for (const name of file.referencedNames) {
                names.add(name);
            }
        }
    }
    return names;
}
function fileFindings(file, testReferencedNames) {
    return file.classes
        .filter((classStructure) => !isTestClass(classStructure))
        .filter((classStructure) => !testReferencedNames.has(classStructure.name))
        .flatMap((classStructure) => [
        buildClassFinding(file.file, classStructure),
        ...classStructure.methods
            .filter((method) => method.decisionPointsCount > 0)
            .map((method) => buildMethodFinding(file.file, classStructure, method)),
    ]);
}
function isTestClass(classStructure) {
    return classStructure.extendsName?.endsWith("TestCase") ?? false;
}
function buildClassFinding(file, classStructure) {
    return {
        category: "testing",
        rule: "untested-class",
        severity: "medium",
        source: "native",
        module: "",
        class: classStructure.name,
        file,
        line: classStructure.startLine,
        message: `La clase "${classStructure.name}" no tiene evidencia de test. Verificar antes de asumir que esta cubierta.`,
        details: { name: classStructure.name },
    };
}
function buildMethodFinding(file, classStructure, method) {
    return {
        category: "testing",
        rule: "untested-complex-method",
        severity: "high",
        source: "native",
        module: "",
        class: classStructure.name,
        file,
        line: method.startLine,
        message: `El metodo "${method.name}" de "${classStructure.name}" tiene logica no trivial y la clase no tiene evidencia de test.`,
        details: { name: classStructure.name, method: method.name },
    };
}
