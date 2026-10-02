import path from "node:path";
import { phpIncludeSyntax } from "../../domain/services/phpIncludeSyntax.js";
import { evaluatePathExpression } from "../../domain/services/phpPathExpression.js";
const CONSTANT_LIMIT = 10;
// Constantes integradas de PHP que aparecen en rutas.
const BUILT_IN = { DIRECTORY_SEPARATOR: "/" };
// include/require del PHP legacy resueltos a archivos del grafo, con constantes deducidas de los define.
export function resolvePhpIncludes(input) {
    const parsed = [...input.files]
        .sort((a, b) => a.file.localeCompare(b.file))
        .map((entry) => ({ ...entry, ...phpIncludeSyntax(input.reader.readText(entry.file)) }));
    const graphFiles = new Set(parsed.map((entry) => entry.file));
    const lookup = constantLookup(parsed, input.includeConstants);
    const links = [];
    const missing = new Map();
    let external = 0;
    let unresolved = 0;
    for (const entry of parsed) {
        for (const include of entry.includes) {
            const blockers = new Set();
            const value = evaluatePathExpression(include.expression, {
                file: entry.file,
                constant: (name) => lookup(name, entry) ?? (blockers.add(name), null),
            });
            blockers.forEach((name) => missing.set(name, (missing.get(name) ?? 0) + 1));
            const target = value === null ? null : targetOf(value, entry.file, input);
            if (graphFiles.has(target)) {
                links.push({ from: entry.file, to: target, line: include.line, expression: include.expression });
            }
            else if (target !== null && !isInside(target, input.modulesPath)) {
                external += 1;
            }
            else {
                unresolved += 1;
            }
        }
    }
    return {
        links,
        stats: {
            total: links.length + external + unresolved,
            resolved: links.length,
            external,
            unresolved,
            unresolvedConstants: [...missing]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                .slice(0, CONSTANT_LIMIT),
        },
    };
}
// Valor de una constante vista desde un archivo: config → el mismo archivo → su modulo → cualquiera.
// Gana la primera definicion evaluable; cada define se evalua en el contexto de su archivo.
function constantLookup(parsed, configured) {
    const memo = new Map();
    const lookup = (name, scope, visiting = new Set()) => {
        if (name in BUILT_IN) {
            return BUILT_IN[name];
        }
        if (name in configured) {
            return configured[name];
        }
        // Una constante que depende de si misma no tiene valor (sin guardarlo: no es definitivo).
        if (visiting.has(name)) {
            return null;
        }
        const key = `${name}|${scope.file}`;
        // Stryker disable next-line ConditionalExpression: el memo solo evita recalcular (mismo valor), mutante equivalente.
        if (!memo.has(key)) {
            memo.set(key, firstDefinition(name, scope, new Set([...visiting, name])));
        }
        return memo.get(key);
    };
    const firstDefinition = (name, scope, visiting) => {
        // Repetir un archivo no cambia el resultado: gana la primera definicion evaluable en este orden.
        const owners = [scope, ...parsed.filter((entry) => entry.module === scope.module), ...parsed];
        for (const owner of owners) {
            for (const define of owner.defines.filter((candidate) => candidate.name === name)) {
                const value = evaluatePathExpression(define.expression, { file: owner.file, constant: (inner) => lookup(inner, owner, visiting) });
                if (value !== null) {
                    return value;
                }
            }
        }
        return null;
    };
    return lookup;
}
// Absoluta → esa; ./ o ../ → junto al archivo; otra → junto al archivo y despues el include_path.
function targetOf(value, file, { reader, includePaths }) {
    const directory = path.dirname(file);
    const candidates = path.isAbsolute(value)
        ? [path.normalize(value)]
        : value.startsWith("./") || value.startsWith("../")
            ? [path.join(directory, value)]
            : [path.join(directory, value), ...includePaths.map((includePath) => path.join(includePath, value))];
    return candidates.find((candidate) => reader.isFile(candidate)) ?? candidates[0];
}
function isInside(target, root) {
    return target === root || target.startsWith(`${root}/`);
}
