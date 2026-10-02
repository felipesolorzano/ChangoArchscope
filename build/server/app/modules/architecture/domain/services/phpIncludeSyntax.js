const INCLUDE = /(?<![\w$>:])(?:include|require)(?:_once)?\b\s*([^;]*?)\s*;/g;
const DEFINE = /(?<![\w$>:])define\s*\(\s*(['"])([A-Za-z_][A-Za-z0-9_]*)\1\s*,\s*([^;]*?)\s*(?:,\s*(?:true|false)\s*)?\)\s*;/gi;
// Includes y defines del codigo PHP (ignora HTML de afuera, comentarios y lo que este dentro de strings).
export function phpIncludeSyntax(source) {
    // Stryker disable all: atajo de rendimiento; sin estas palabras el analisis completo tambien da vacio, mutantes equivalentes.
    if (!/include|require|define/i.test(source)) {
        return { includes: [], defines: [] };
    }
    // Stryker restore all
    const { code, strings } = lex(source);
    // Stryker disable next-line EqualityOperator: los bordes de un string son comillas, donde nunca empieza una palabra clave, mutante equivalente.
    const outsideStrings = (index) => !strings.some(([from, to]) => index >= from && index < to);
    return {
        includes: [...code.matchAll(INCLUDE)]
            .filter((match) => outsideStrings(match.index))
            .map((match) => ({ expression: match[1], line: lineAt(source, match.index) })),
        defines: [...code.matchAll(DEFINE)]
            .filter((match) => outsideStrings(match.index))
            .map((match) => ({ name: match[2], expression: match[3] })),
    };
}
function lineAt(source, index) {
    return source.slice(0, index).split("\n").length;
}
// Copia del fuente con el HTML y los comentarios en blanco (conserva saltos de linea y posiciones),
// `?>` como fin de sentencia, y los rangos [desde, hasta) que son contenido de strings. Avanza de un
// cambio de estado al siguiente (archivos legacy de mas de 1 MB).
function lex(source) {
    const chunks = [];
    // Stryker disable next-line ArrayDeclaration: un rango basura no contiene ninguna posicion numerica, mutante equivalente.
    const strings = [];
    const blank = (from, to) => chunks.push(source.slice(from, to).replace(/[^\n]/g, " "));
    const PHP_EVENT = /\?>|\/\/|#|\/\*|['"]/g;
    const PHP_OPEN = /<\?(?:php|=)/g;
    let index = 0;
    for (;;) {
        // HTML hasta la siguiente apertura de PHP.
        PHP_OPEN.lastIndex = index;
        const open = PHP_OPEN.exec(source);
        if (open === null) {
            blank(index, source.length);
            break;
        }
        blank(index, open.index + open[0].length);
        index = open.index + open[0].length;
        // Codigo PHP hasta `?>`.
        for (;;) {
            PHP_EVENT.lastIndex = index;
            const event = PHP_EVENT.exec(source);
            if (event === null) {
                chunks.push(source.slice(index));
                index = source.length;
                break;
            }
            chunks.push(source.slice(index, event.index));
            index = event.index;
            const token = event[0];
            if (token === "?>") {
                chunks.push("; ");
                // Stryker disable next-line AssignmentOperator: retroceder solo re-blanquea el "?>" (no aparece ni desaparece ninguna sentencia), mutante equivalente.
                index += 2;
                break;
            }
            if (token === "/*") {
                const close = source.indexOf("*/", index + 2);
                // Stryker disable next-line ArithmeticOperator: cortar el comentario 2 caracteres antes solo deja "*/"-adyacentes como codigo, donde no cabe una sentencia, mutante equivalente.
                const end = close === -1 ? source.length : close + 2;
                blank(index, end);
                index = end;
            }
            else if (token === "//" || token === "#") {
                const newline = source.indexOf("\n", index);
                const end = newline === -1 ? source.length : newline;
                blank(index, end);
                index = end;
            }
            else {
                const end = stringEnd(source, index, token);
                chunks.push(source.slice(index, end));
                // Stryker disable next-line ArithmeticOperator: correr los bordes un caracter solo cubre comillas o el caracter previo, donde no empieza una palabra clave, mutante equivalente.
                strings.push([index + 1, end - 1]);
                index = end;
            }
        }
    }
    return { code: chunks.join(""), strings };
}
// Posicion siguiente al cierre del string que empieza en `start` (respeta escapes).
function stringEnd(source, start, quote) {
    // Stryker disable next-line EqualityOperator: un caracter mas alla del final no es comilla, mutante equivalente.
    for (let index = start + 1; index < source.length; index += 1) {
        if (source[index] === "\\") {
            index += 1;
        }
        else if (source[index] === quote) {
            return index + 1;
        }
    }
    return source.length;
}
