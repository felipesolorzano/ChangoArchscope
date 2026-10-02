import path from "node:path";
import { isJsEntryPoint } from "../../domain/services/jsEntryPoints.js";
import { resolveJsImport } from "../../domain/services/jsImportResolution.js";
import { jsFinding } from "./jsFinding.js";
// Marca de copia manual al final del nombre (sin extension), con o sin " (N)": "x - copia (4)",
// "x copy 2", "x_old", "x.devel", "x.bak".
const MANUAL_COPY_PATTERN = /(?: - cop(?:y|ia)| cop(?:y|ia)(?: \d+)?|_cop(?:y|ia)|_old|\.devel|\.bak)(?: \(\d+\))?$/i;
// `testFiles` (de testRoots) solo cuentan como uso de exports: un helper exportado para testearlo esta
// en uso, pero un archivo que solo importan sus tests sigue siendo codigo muerto.
export function jsDeadCodeAnalyzer(files, testFiles = []) {
    const known = new Set(files.map((file) => file.file));
    const fileUsage = importedNames(files, known);
    const exportUsage = importedNames([...files, ...testFiles], known);
    return files.flatMap((file) => {
        const name = path.posix.basename(file.file);
        const stem = path.posix.parse(name).name;
        const findings = [];
        if (!isJsEntryPoint(file.file)) {
            if (!fileUsage.has(file.file)) {
                findings.push(build(file.file, "possibly-unused-file", name, `Ningun archivo escaneado importa "${name}". Verificar antes de eliminar.`));
            }
            else {
                findings.push(...unusedExports(file, name, exportUsage.get(file.file)));
            }
        }
        if (MANUAL_COPY_PATTERN.test(stem)) {
            findings.push(build(file.file, "manual-copy-file", name, `"${name}" parece una copia manual de otro archivo. Verificar antes de eliminar.`));
        }
        return findings;
    });
}
const EVERYTHING = "*";
// Por archivo importado por OTRO archivo escaneado (un auto-import no cuenta): los nombres que le
// importan. `*` = todos (namespace, `export *`, o require/import()/efecto: no se sabe cuales).
function importedNames(files, known) {
    const usage = new Map();
    for (const file of files) {
        for (const importRef of file.imports) {
            const names = importRef.names.length === 0 ? [EVERYTHING] : importRef.names;
            for (const target of resolveJsImport(file.file, importRef.source, known).filter((candidate) => candidate !== file.file)) {
                const used = usage.get(target) ?? new Set();
                names.forEach((importedName) => used.add(importedName));
                usage.set(target, used);
            }
        }
    }
    return usage;
}
// XRay X2: exports de un archivo importado que ningun otro archivo usa.
function unusedExports(file, name, used) {
    if (used.has(EVERYTHING)) {
        return [];
    }
    return file.exports
        .filter((exported) => !used.has(exported.name))
        .map((exported) => jsFinding({
        category: "dead_code",
        rule: "unused-export",
        severity: "low",
        class: null,
        file: file.file,
        line: exported.line,
        message: `"${exported.name}" se exporta pero ningun archivo lo importa. Verificar antes de eliminar.`,
        details: { name, export: exported.name },
    }));
}
function build(file, rule, name, message) {
    return jsFinding({ category: "dead_code", rule, severity: "low", class: null, file, line: 1, message, details: { name } });
}
