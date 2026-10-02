import path from "node:path";

export type PathContext = {
  /** Ruta absoluta del archivo donde esta la expresion (para __DIR__ / __FILE__). */
  file: string;
  constant: (name: string) => string | null;
};

type Cursor = { text: string; position: number };

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/y;
const CONSTANT = /^[A-Z_][A-Z0-9_]*$/;

// Valor estatico de una expresion de ruta de PHP: strings, concatenacion, __DIR__, __FILE__,
// dirname(), realpath() y constantes. Cualquier otra cosa → null.
export function evaluatePathExpression(expression: string, context: PathContext): string | null {
  const cursor: Cursor = { text: expression, position: 0 };
  const value = concatenation(cursor, context);

  skipSpaces(cursor);
  return cursor.position === cursor.text.length ? value : null;
}

function concatenation(cursor: Cursor, context: PathContext): string | null {
  let value = term(cursor, context);

  for (skipSpaces(cursor); value !== null && cursor.text[cursor.position] === "."; skipSpaces(cursor)) {
    cursor.position += 1;
    const next = term(cursor, context);
    value = next === null ? null : value + next;
  }

  return value;
}

function term(cursor: Cursor, context: PathContext): string | null {
  skipSpaces(cursor);
  const char = cursor.text[cursor.position];

  if (char === "'" || char === '"') {
    return stringLiteral(cursor, char);
  }
  if (char === "(") {
    cursor.position += 1;
    const inner = concatenation(cursor, context);
    return closeParenthesis(cursor) ? inner : null;
  }

  IDENTIFIER.lastIndex = cursor.position;
  const name = IDENTIFIER.exec(cursor.text)?.[0];
  if (name === undefined) {
    return null;
  }
  cursor.position += name.length;
  return identifier(name, cursor, context);
}

function identifier(name: string, cursor: Cursor, context: PathContext): string | null {
  if (name === "__DIR__") {
    return path.dirname(context.file);
  }
  if (name === "__FILE__") {
    return context.file;
  }
  if (name === "dirname" || name === "realpath") {
    skipSpaces(cursor);
    const argument = cursor.text[cursor.position] === "(" ? term(cursor, context) : null;
    if (argument === null) {
      return null;
    }
    // realpath sin tocar el disco: normaliza y quita la "/" final (no depende del cwd del proceso).
    return name === "dirname" ? path.dirname(argument) : path.normalize(argument).replace(/(.)\/$/, "$1");
  }
  return CONSTANT.test(name) ? context.constant(name) : null;
}

function stringLiteral(cursor: Cursor, quote: string): string | null {
  let value = "";

  // Stryker disable next-line EqualityOperator: leer un caracter mas alla del final no cierra el string (devuelve null igual), mutante equivalente.
  for (let index = cursor.position + 1; index < cursor.text.length; index += 1) {
    const char = cursor.text[index];
    if (char === "\\") {
      value += cursor.text[index + 1];
      index += 1;
    } else if (char === quote) {
      cursor.position = index + 1;
      // Comillas dobles con $ interpolan variables: el valor no es estatico.
      return quote === '"' && value.includes("$") ? null : value;
    } else {
      value += char;
    }
  }

  return null;
}

function closeParenthesis(cursor: Cursor): boolean {
  skipSpaces(cursor);
  if (cursor.text[cursor.position] !== ")") {
    return false;
  }
  cursor.position += 1;
  return true;
}

function skipSpaces(cursor: Cursor): void {
  while (/\s/.test(cursor.text[cursor.position] ?? "")) {
    cursor.position += 1;
  }
}
