import { describe, expect, it } from "vitest";

import { protectionLevel } from "../../../../../app/modules/protection/domain/services/protectionLevel.js";
import {
  parseClover,
  parseInfectionLog,
  parseIstanbulSummary,
  parseLcov,
  parsePlaywrightResults,
  parseStrykerReport,
} from "../../../../../app/modules/protection/domain/services/protectionReports.js";

describe("cobertura", () => {
  it("Istanbul summary toma total.lines", () => {
    expect(parseIstanbulSummary(JSON.stringify({ total: { lines: { total: 200, covered: 150, pct: 75 } }, "/a.js": {} }))).toEqual({ covered: 150, total: 200 });
    expect(parseIstanbulSummary("{nope")).toBeNull();
    expect(parseIstanbulSummary(JSON.stringify({ total: {} }))).toBeNull();
    expect(parseIstanbulSummary(JSON.stringify({}))).toBeNull();
    expect(parseIstanbulSummary(JSON.stringify({ total: { lines: { covered: 3 } } }))).toBeNull();
    expect(parseIstanbulSummary(JSON.stringify({ total: { lines: { total: 3 } } }))).toBeNull();
  });

  it("lcov suma LH y LF de todos los archivos", () => {
    const lcov = "TN:\nSF:/a.js\nLF:10\nLH:7\nend_of_record\nSF:/b.js\nLF:5\nLH:5\nend_of_record\n";

    expect(parseLcov(lcov)).toEqual({ covered: 12, total: 15 });
    expect(parseLcov("no es lcov")).toBeNull();
    expect(parseLcov("XLF:5\nLH:1")).toBeNull();
    expect(parseLcov("LF:5abc\nLH:1")).toBeNull();
  });

  it("clover toma el primer metrics del project", () => {
    const xml = `<?xml version="1.0"?><coverage><project timestamp="1"><file name="a"><metrics statements="3" coveredstatements="1"/></file><metrics files="2" statements="40" coveredstatements="30" elements="50"/></project></coverage>`;

    expect(parseClover(xml)).toEqual({ covered: 30, total: 40 });
    expect(parseClover(`<coverage><project><metrics elements="1"/></project></coverage>`)).toBeNull();
    expect(parseClover(`<coverage><project><metrics statements="5"/></project></coverage>`)).toBeNull();
    expect(parseClover(`<coverage><project><metrics coveredstatements="5"/></project></coverage>`)).toBeNull();
    const phpunit = `<coverage>
  <project timestamp="1">
    <package name="App">
      <file name="/a.php"><class name="A"/><metrics statements="3" coveredstatements="1"/></file>
      <metrics files="1" statements="3" coveredstatements="1"/>
    </package>
    <file name="/b.php">
      <metrics statements="7" coveredstatements="7"/>
    </file>
    <metrics files="2" statements="10" coveredstatements="8"/>
  </project>
</coverage>`;
    expect(parseClover(phpunit)).toEqual({ covered: 8, total: 10 });
    expect(parseClover("<nada/>")).toBeNull();
    expect(parseClover("<coverage><project></project></coverage>")).toBeNull();
  });
});

describe("mutation", () => {
  const report = { schemaVersion: "1.0", files: { "a.ts": { mutants: [{ status: "Killed" }, { status: "Killed" }, { status: "Survived" }, { status: "Timeout" }, { status: "NoCoverage" }, { status: "CompileError" }] }, "b.ts": { mutants: [{ status: "Ignored" }] } } };

  it("Stryker JSON cuenta por estado", () => {
    expect(parseStrykerReport(JSON.stringify(report))).toEqual({ killed: 2, survived: 1, timeout: 1, noCoverage: 1 });
  });

  it('Stryker HTML trae el JSON en app.report con uniones "+"', () => {
    const json = JSON.stringify(report).replace('"a.ts"', '"<"+"a.ts"');
    const html = `<html><script>const app = document.querySelector('x');\n      app.report = ${json};\n      function updateTheme() {}\n</script></html>`;

    expect(parseStrykerReport(html)).toEqual({ killed: 2, survived: 1, timeout: 1, noCoverage: 1 });
    expect(parseStrykerReport("<html>sin reporte</html>")).toBeNull();
    expect(parseStrykerReport("<html><script>app.report = {roto</script></html>")).toBeNull();
    expect(parseStrykerReport(JSON.stringify({ schemaVersion: "1" }))).toBeNull();
    expect(parseStrykerReport(JSON.stringify({ files: null }))).toBeNull();
    expect(parseStrykerReport(JSON.stringify({ files: { "a.ts": {} } }))).toEqual({ killed: 0, survived: 0, timeout: 0, noCoverage: 0 });
  });

  it("HTML: la union puede partir un estado y los strings pueden tener llaves y comillas escapadas", () => {
    const tricky = '{"files":{"a.ts":{"mutants":[{"status":"Kil"+"led","statusReason":"esperaba \\"}"},{"status":"Survived"}]}}}';
    const html = `<script>app.report = ${tricky};
      function f() { return {}; }</script>`;

    expect(parseStrykerReport(html)).toEqual({ killed: 1, survived: 1, timeout: 0, noCoverage: 0 });
  });

  it("Infection: stats a los mismos estados", () => {
    expect(parseInfectionLog(JSON.stringify({ stats: { killedCount: 80, escapedCount: 10, timeOutCount: 2, notCoveredCount: 8, totalMutantsCount: 100 } }))).toEqual({
      killed: 80,
      survived: 10,
      timeout: 2,
      noCoverage: 8,
    });
    expect(parseInfectionLog(JSON.stringify({ source: { directories: ["src"] } }))).toBeNull();
    expect(parseInfectionLog("{")).toBeNull();
  });
});

describe("E2E", () => {
  it("Playwright JSON: expected + flaky pasan, unexpected fallan", () => {
    expect(parsePlaywrightResults(JSON.stringify({ suites: [], stats: { expected: 20, unexpected: 2, flaky: 1, skipped: 3 } }))).toEqual({ passed: 21, failed: 2 });
    expect(parsePlaywrightResults(JSON.stringify({ stats: { expected: 1 } }))).toBeNull();
    expect(parsePlaywrightResults(JSON.stringify({ results: [] }))).toBeNull();
    expect(parsePlaywrightResults(JSON.stringify({ suites: [] }))).toBeNull();
    expect(parsePlaywrightResults(JSON.stringify({ suites: [], stats: { expected: 4 } }))).toEqual({ passed: 4, failed: 0 });
    expect(parsePlaywrightResults("[")).toBeNull();
  });
});

describe("protectionLevel", () => {
  const base = { testFiles: 1, coverage: null as number | null, mutation: null as number | null, reports: 0 };

  it("sin tests ni reportes no hay red", () => {
    expect(protectionLevel({ ...base, testFiles: 0 })).toBe("none");
    expect(protectionLevel({ ...base, testFiles: 0, reports: 1 })).toBe("low");
  });

  it("alta con cobertura >= 80 y mutation >= 70; media con alguna >= 50; si no baja", () => {
    expect(protectionLevel({ ...base, coverage: 80, mutation: 70 })).toBe("high");
    expect(protectionLevel({ ...base, coverage: 79, mutation: 70 })).toBe("medium");
    expect(protectionLevel({ ...base, coverage: 80, mutation: 69 })).toBe("medium");
    expect(protectionLevel({ ...base, coverage: 50 })).toBe("medium");
    expect(protectionLevel({ ...base, mutation: 50 })).toBe("medium");
    expect(protectionLevel({ ...base, coverage: 49, mutation: 49 })).toBe("low");
    expect(protectionLevel(base)).toBe("low");
  });
});
