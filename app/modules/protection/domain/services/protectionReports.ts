import type { CoverageCount, E2eCount, MutantCount } from "../value-objects/Protection.js";

type Json = Record<string, any>;

const STRYKER_STATUSES: Record<string, keyof MutantCount> = { Killed: "killed", Survived: "survived", Timeout: "timeout", NoCoverage: "noCoverage" };

// JSON del reporte o null; los llamadores leen con `?.` (un escalar no tiene las claves).
// Stryker disable BlockStatement: sin el return del catch el resultado es undefined, que los llamadores tratan igual que null, mutante equivalente.
function json(text: string): Json | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
// Stryker restore BlockStatement

const isCount = (value: unknown): value is number => typeof value === "number";

// coverage-summary.json de Istanbul: total.lines.
export function parseIstanbulSummary(text: string): CoverageCount | null {
  const lines = json(text)?.total?.lines ?? {};
  return isCount(lines.covered) && isCount(lines.total) ? { covered: lines.covered, total: lines.total } : null;
}

// lcov.info: suma de LH (cubiertas) y LF (encontradas) de todos los archivos.
export function parseLcov(text: string): CoverageCount | null {
  const sum = (prefix: string) => [...text.matchAll(new RegExp(`^${prefix}:(\\d+)$`, "gm"))].reduce((total, match) => total + Number(match[1]), 0);
  return /^LF:\d+$/m.test(text) ? { covered: sum("LH"), total: sum("LF") } : null;
}

// clover.xml: el primer <metrics> que es hijo directo de <project> (el resumen del proyecto).
export function parseClover(text: string): CoverageCount | null {
  const project = text.match(/<project[^>]*>([\s\S]*?)<\/project>/)?.[1];
  // Stryker disable next-line StringLiteral: lo que reemplaza a los bloques de package/file no contiene "<metrics", mutantes equivalentes.
  const metrics = project?.replace(/<file[\s\S]*?<\/file>/g, "").replace(/<package[\s\S]*?<\/package>/g, "").match(/<metrics\b[^>]*>/)?.[0];
  if (metrics === undefined) {
    return null;
  }
  const attribute = (name: string) => metrics.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1];
  const covered = attribute("coveredstatements");
  const total = attribute("statements");
  return covered !== undefined && total !== undefined ? { covered: Number(covered), total: Number(total) } : null;
}

// Stryker: mutation.json o el index.html del reporte (JSON en `app.report = …`, con uniones "+").
export function parseStrykerReport(text: string): MutantCount | null {
  const marker = text.indexOf("app.report = ");
  const report = marker === -1 ? json(text) : json(embeddedObject(text.slice(marker + "app.report = ".length).replaceAll('"+"', "")));
  const files = report?.files;
  if (typeof files !== "object" || files === null) {
    return null;
  }

  const count: MutantCount = { killed: 0, survived: 0, timeout: 0, noCoverage: 0 };
  for (const file of Object.values(files) as Json[]) {
    // Stryker disable next-line ArrayDeclaration: un mutante basura no tiene un estado conocido, mutante equivalente.
    for (const mutant of file.mutants ?? []) {
      const key = STRYKER_STATUSES[mutant.status];
      if (key !== undefined) {
        count[key] += 1;
      }
    }
  }
  return count;
}

// El objeto JSON que empieza en el texto (balanceando llaves fuera de strings).
function embeddedObject(text: string): string {
  let depth = 0;
  let inString = false;
  // Stryker disable next-line EqualityOperator: leer un caracter mas alla del final no cambia las llaves, mutante equivalente.
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}" && --depth === 0) {
      return text.slice(0, index + 1);
    }
  }
  return text;
}

// Log JSON de Infection (PHP).
export function parseInfectionLog(text: string): MutantCount | null {
  const stats = json(text)?.stats;
  if (!isCount(stats?.killedCount)) {
    return null;
  }
  return { killed: stats.killedCount, survived: stats.escapedCount ?? 0, timeout: stats.timeOutCount ?? 0, noCoverage: stats.notCoveredCount ?? 0 };
}

// Reporter JSON de Playwright.
export function parsePlaywrightResults(text: string): E2eCount | null {
  const report = json(text);
  const stats = report?.stats;
  if (!Array.isArray(report?.suites) || !isCount(stats?.expected)) {
    return null;
  }
  return { passed: stats.expected + (stats.flaky ?? 0), failed: stats.unexpected ?? 0 };
}
