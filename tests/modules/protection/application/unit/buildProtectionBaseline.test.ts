import path from "node:path";

import { minimatch } from "minimatch";
import { describe, expect, it } from "vitest";

import { buildProtectionBaseline } from "../../../../../app/modules/protection/application/use-cases/buildProtectionBaseline.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

function memoryReader(files: Record<string, string>): SourceTreeReader {
  const ignored = (root: string, file: string, patterns: string[]) => {
    const segments = path.relative(root, file).split(path.sep);
    return segments.some((_, index) => patterns.some((pattern) => minimatch(segments.slice(0, index + 1).join("/"), pattern, { dot: true })));
  };
  return {
    listDirectories: (dir) => [...new Set(Object.keys(files).filter((file) => file.startsWith(`${dir}/`)).map((file) => path.join(dir, path.relative(dir, file).split(path.sep)[0])))].filter((entry) => !(entry in files)),
    walkFiles: (root, extensions, patterns = []) =>
      Object.keys(files).filter((file) => file.startsWith(`${root}/`) && extensions.some((ext) => file.endsWith(ext)) && !ignored(root, file, patterns)).sort(),
    readText: (file) => files[file],
    isFile: (file) => file in files,
  };
}

const istanbul = (covered: number, total: number) => JSON.stringify({ total: { lines: { covered, total } } });
const stryker = (...statuses: string[]) => JSON.stringify({ files: { "a.ts": { mutants: statuses.map((status) => ({ status })) } } });

describe("buildProtectionBaseline", () => {
  it("proyecto sin tests ni reportes: nivel none", () => {
    const reader = memoryReader({ "/mc/.git/HEAD": "", "/mc/admin/a.php": "", "/mc/admin/b.inc": "" });

    expect(buildProtectionBaseline({ stackRoot: "/mc", testPaths: [], extensions: [".php", ".inc"], ignoredPaths: [], reader })).toEqual({
      root: "/mc",
      tests: { testFiles: 0, sourceFiles: 2 },
      coverage: null,
      mutation: null,
      e2e: null,
      level: "none",
    });
  });

  it("raiz por .git hacia arriba; cuenta tests del stack y de testPaths; suma reportes y los ordena", () => {
    const reader = memoryReader({
      "/repo/.git/HEAD": "",
      "/repo/src/a.ts": "",
      "/repo/src/b.tsx": "",
      "/repo/src/a.test.ts": "",
      "/repo/src/__tests__/b.ts": "",
      "/repo/src/legacy/old.ts": "",
      "/repo/tests/c.spec.ts": "",
      "/repo/tests/helper.ts": "",
      "/repo/coverage/coverage-summary.json": istanbul(60, 100),
      "/repo/front/coverage/lcov.info": "LF:100\nLH:40\n",
      "/repo/reports/mutation/node/index.html": `<script>app.report = ${stryker("Killed", "Killed", "Survived")};\nfunction x() {}</script>`,
      "/repo/reports/mutation/mutation.json": stryker("Killed", "NoCoverage", "Timeout"),
      "/repo/vendor/pkg/coverage/lcov.info": "LF:50\nLH:50\n",
      "/repo/docs/index.html": `<script>app.report = ${stryker("Killed")};</script>`,
      "/repo/playwright-report/results.json": JSON.stringify({ suites: [], stats: { expected: 8, unexpected: 1, flaky: 0 } }),
      "/repo/data/results.json": JSON.stringify({ rows: [] }),
      "/repo/node_modules/x/coverage/coverage-summary.json": istanbul(1, 1),
      "/repo/.cache/lcov.info": "LF:9\nLH:9\n",
      "/repo/build/clover.xml": "<roto",
    });

    const baseline = buildProtectionBaseline({ stackRoot: "/repo/src", testPaths: ["/repo/tests"], extensions: [".ts", ".tsx"], ignoredPaths: ["legacy/**"], reader });

    expect(baseline).toEqual({
      root: "/repo",
      tests: { testFiles: 3, sourceFiles: 2 },
      coverage: { percent: 50, covered: 100, total: 200, reports: ["coverage/coverage-summary.json", "front/coverage/lcov.info"] },
      mutation: { score: 67, killed: 3, survived: 1, timeout: 1, noCoverage: 1, reports: ["reports/mutation/mutation.json", "reports/mutation/node/index.html"] },
      e2e: { passed: 8, failed: 1, reports: ["playwright-report/results.json"] },
      level: "medium",
    });
  });

  it("sin .git la raiz es la del stack; PHP cuenta tests *Test.php; clover e infection", () => {
    const reader = memoryReader({
      "/p/app/User.php": "",
      "/p/app/UserTest.php": "",
      "/p/app/UserTest.php.inc": "",
      "/p/tests/Unit/UserTest.php": "",
      "/p/test/OtherTest.php": "",
      "/p/tests/FakeTest.php.cjs": "",
      "/p/lib/JAMA/examples/LMQuadTest.php": "",
      "/p/reports/tests/php/share.test.php": "",
      "/p/reports/tests/browser/dashboard.test.mjs": "",
      "/p/mailer/tpl.test.html": "",
      "/p/build/logs/clover.xml": `<coverage><project><metrics statements="10" coveredstatements="9"/></project></coverage>`,
      "/p/infection-log.json": JSON.stringify({ stats: { killedCount: 7, escapedCount: 3, timeOutCount: 0, notCoveredCount: 0 } }),
    });

    expect(buildProtectionBaseline({ stackRoot: "/p", testPaths: [], extensions: [".php", ".inc"], ignoredPaths: [], reader })).toMatchObject({
      root: "/p",
      tests: { testFiles: 4, sourceFiles: 4 },
      coverage: { percent: 90, covered: 9, total: 10 },
      mutation: { score: 70, killed: 7, survived: 3 },
      e2e: null,
      level: "high",
    });
  });

  it("reportes con totales en cero dan 0%", () => {
    const reader = memoryReader({ "/z/.git": "", "/z/coverage/lcov.info": "LF:0\nLH:0\n", "/z/reports/mutation/mutation.json": stryker("CompileError") });

    expect(buildProtectionBaseline({ stackRoot: "/z", testPaths: [], extensions: [".ts"], ignoredPaths: [], reader })).toMatchObject({
      coverage: { percent: 0, total: 0 },
      mutation: { score: 0, killed: 0 },
      level: "low",
    });
  });

  it("los tests del stack cuentan aunque ignoredPaths los saque del analisis", () => {
    const reader = memoryReader({ "/r/.git": "", "/r/a.js": "", "/r/a.test.js": "", "/r/__tests__/b.js": "" });

    expect(buildProtectionBaseline({ stackRoot: "/r", testPaths: [], extensions: [".js"], ignoredPaths: ["**/*.test.*", "**/__tests__/**"], reader }).tests).toEqual({
      testFiles: 2,
      sourceFiles: 1,
    });
  });
});

