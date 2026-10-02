import path from "node:path";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { protectionLevel } from "../../domain/services/protectionLevel.js";
import {
  parseClover,
  parseInfectionLog,
  parseIstanbulSummary,
  parseLcov,
  parsePlaywrightResults,
  parseStrykerReport,
} from "../../domain/services/protectionReports.js";
import type { CoverageCount, E2eCount, MutantCount, ProtectionBaseline } from "../../domain/value-objects/Protection.js";

export type BuildProtectionInput = {
  stackRoot: string;
  testPaths: string[];
  extensions: string[];
  ignoredPaths: string[];
  reader: SourceTreeReader;
};

// Test de cualquier stack: *.test.* / *.spec.* / __tests__, y *Test.php dentro de tests/ o test/ (PHPUnit).
const TEST_FILE = /\.(?:test|spec)\.|\/__tests__\/|\/tests?\/(?:.+\/)?[^/]+Test\.php$/;
const TEST_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".php"];
const ALWAYS_IGNORED = ["**/node_modules", "**/vendor", "**/.*"];

type Parser<T> = (text: string) => T | null;

const COVERAGE: Record<string, Parser<CoverageCount>> = { "coverage-summary.json": parseIstanbulSummary, "lcov.info": parseLcov, "clover.xml": parseClover };
const MUTATION: Record<string, Parser<MutantCount>> = { "mutation.json": parseStrykerReport, "infection-log.json": parseInfectionLog, "index.html": parseStrykerReport };
const E2E: Record<string, Parser<E2eCount>> = { "results.json": parsePlaywrightResults };

// Cuanta red de seguridad tiene el proyecto: tests que ve y reportes que ya genero (no ejecuta nada).
export function buildProtectionBaseline(input: BuildProtectionInput): ProtectionBaseline {
  const { reader, stackRoot } = input;
  const root = projectRoot(stackRoot, reader);
  const isTest = (file: string) => TEST_FILE.test(file);
  const sourceFiles = reader.walkFiles(stackRoot, input.extensions, [...input.ignoredPaths, ...ALWAYS_IGNORED]).filter((file) => !isTest(file));
  // Los tests cuentan aunque ignoredPaths los saque del analisis (la config suele excluirlos a proposito).
  const testFiles = [stackRoot, ...input.testPaths].flatMap((root) => reader.walkFiles(root, TEST_EXTENSIONS, ALWAYS_IGNORED)).filter(isTest).length;
  const candidates = reader
    .walkFiles(root, [...Object.keys(COVERAGE), ...Object.keys(MUTATION), ...Object.keys(E2E)], ALWAYS_IGNORED)
    .filter((file) => path.basename(file) !== "index.html" || path.dirname(file).split(path.sep).includes("mutation"));

  const coverage = collect(candidates, COVERAGE, root, reader);
  const mutation = collect(candidates, MUTATION, root, reader);
  const e2e = collect(candidates, E2E, root, reader);
  const coverageSummary = coverage && { ...coverage.total, percent: percent(coverage.total.covered, coverage.total.total), reports: coverage.reports };
  const mutationSummary = mutation && { ...mutation.total, score: mutationScore(mutation.total), reports: mutation.reports };

  return {
    root,
    tests: { testFiles, sourceFiles: sourceFiles.length },
    coverage: coverageSummary,
    mutation: mutationSummary,
    e2e: e2e && { ...e2e.total, reports: e2e.reports },
    level: protectionLevel({
      testFiles,
      coverage: coverageSummary?.percent ?? null,
      mutation: mutationSummary?.score ?? null,
      reports: [coverage, mutation, e2e].filter(Boolean).length,
    }),
  };
}

// Carpeta mas cercana (incluida la raiz del stack) con .git; si no hay, la raiz del stack.
function projectRoot(stackRoot: string, reader: SourceTreeReader): string {
  for (let directory = stackRoot; ; directory = path.dirname(directory)) {
    const git = path.join(directory, ".git");
    if (reader.isFile(git) || reader.listDirectories(directory).includes(git)) {
      return directory;
    }
    if (path.dirname(directory) === directory) {
      return stackRoot;
    }
  }
}

// Reportes de un tipo: los que se pueden leer, sumados campo por campo.
function collect<T extends Record<string, number>>(candidates: string[], parsers: Record<string, Parser<T>>, root: string, reader: SourceTreeReader): { total: T; reports: string[] } | null {
  const found = candidates
    .map((file) => ({ file, value: parsers[path.basename(file)]?.(reader.readText(file)) ?? null }))
    .filter((entry): entry is { file: string; value: T } => entry.value !== null);

  if (found.length === 0) {
    return null;
  }

  const total = Object.fromEntries(Object.keys(found[0].value).map((key) => [key, found.reduce((sum, entry) => sum + entry.value[key], 0)])) as T;
  // walkFiles ya devuelve las rutas ordenadas.
  return { total, reports: found.map((entry) => path.relative(root, entry.file)) };
}

function percent(covered: number, total: number): number {
  return total === 0 ? 0 : Math.round((covered / total) * 100);
}

function mutationScore({ killed, survived, timeout, noCoverage }: MutantCount): number {
  const detected = killed + timeout;
  return percent(detected, detected + survived + noCoverage);
}
