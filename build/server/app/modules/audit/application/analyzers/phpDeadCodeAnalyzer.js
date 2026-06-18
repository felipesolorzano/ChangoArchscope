export function phpDeadCodeAnalyzer(files) {
    const referenced = new Set();
    for (const file of files) {
        for (const name of file.referencedNames) {
            referenced.add(name);
        }
    }
    return files.flatMap((file) => fileFindings(file, referenced));
}
function fileFindings(file, referenced) {
    const functionFindings = file.functions
        .filter((fn) => !isMagicMethod(fn.name) && !referenced.has(fn.name))
        .map((fn) => buildFinding(file.file, fn.startLine, "possibly-unused-function", fn.name, null));
    const classFindings = file.classes.flatMap((classStructure) => [
        ...(referenced.has(classStructure.name)
            ? []
            : [buildFinding(file.file, classStructure.startLine, "possibly-unused-class", classStructure.name, classStructure.name)]),
        ...classStructure.methods
            .filter((method) => !isMagicMethod(method.name) && !referenced.has(method.name))
            .map((method) => buildFinding(file.file, method.startLine, "possibly-unused-method", method.name, classStructure.name)),
    ]);
    return [...functionFindings, ...classFindings];
}
function isMagicMethod(name) {
    return name.startsWith("__");
}
function buildFinding(file, line, rule, name, className) {
    return {
        category: "dead_code",
        rule,
        severity: "low",
        source: "native",
        module: "",
        class: className,
        file,
        line,
        message: deadCodeMessage(rule, name),
        details: { name },
    };
}
function deadCodeMessage(rule, name) {
    switch (rule) {
        case "possibly-unused-function":
            return `La funcion "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
        case "possibly-unused-class":
            return `La clase "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
        case "possibly-unused-method":
            return `El metodo "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
    }
}
