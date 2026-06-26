import type { PhpCompatibilityIssue } from "../../domain/value-objects/PhpCompatibilityIssue.js";

type PhpcsMessage = {
  message?: unknown;
  source?: unknown;
  type?: unknown;
  line?: unknown;
};

type PhpcsFile = {
  messages?: unknown;
};

const MOUNT_PREFIX = "/repo/";

/**
 * Normaliza el JSON de `phpcs --report=json` agrupado por archivo (ruta relativa, sin el
 * prefijo de montaje). Incluye archivos escaneados sin hallazgos como `[]`, lo que permite
 * al scan incremental registrar que un archivo paso a cero. Pura y defensiva.
 */
export function parsePhpcsReportByFile(raw: unknown): Map<string, PhpCompatibilityIssue[]> {
  const byFile = new Map<string, PhpCompatibilityIssue[]>();
  const files = (raw as { files?: unknown } | null)?.files;
  if (files === null || typeof files !== "object") return byFile;

  for (const [absolutePath, fileReport] of Object.entries(files as Record<string, unknown>)) {
    const messages = (fileReport as PhpcsFile)?.messages;
    if (!Array.isArray(messages)) continue;

    const file = stripMountPrefix(absolutePath);
    const issues: PhpCompatibilityIssue[] = [];

    for (const raw of messages) {
      const issue = toIssue(file, raw as PhpcsMessage);
      if (issue !== null) issues.push(issue);
    }

    byFile.set(file, issues);
  }

  return byFile;
}

/**
 * Lista plana de issues de compatibilidad. Aplana `parsePhpcsReportByFile` para tener una
 * sola fuente de verdad de la normalizacion.
 */
export function parsePhpcsReport(raw: unknown): PhpCompatibilityIssue[] {
  return [...parsePhpcsReportByFile(raw).values()].flat();
}

function toIssue(file: string, message: PhpcsMessage): PhpCompatibilityIssue | null {
  const source = message.source;
  if (typeof source !== "string" || !source.startsWith("PHPCompatibility")) return null;

  return {
    file,
    line: typeof message.line === "number" ? message.line : 0,
    rule: source,
    severityRaw: message.type === "ERROR" ? "error" : "warning",
    message: typeof message.message === "string" ? message.message : "",
  };
}

function stripMountPrefix(absolutePath: string): string {
  if (absolutePath.startsWith(MOUNT_PREFIX)) return absolutePath.slice(MOUNT_PREFIX.length);
  if (absolutePath === "/repo") return "";
  return absolutePath;
}
