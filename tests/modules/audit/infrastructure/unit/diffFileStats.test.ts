import { describe, expect, it } from "vitest";

import { diffFileStats, type CachedStat } from "../../../../../app/modules/audit/infrastructure/compat/diffFileStats.js";
import type { FileStat } from "../../../../../app/modules/audit/infrastructure/cache/fingerprintFromStats.js";

function cache(entries: Array<[string, CachedStat]>): Map<string, CachedStat> {
  return new Map(entries);
}

const stat = (path: string, mtimeMs: number, size: number): FileStat => ({ path, mtimeMs, size });

describe("diffFileStats", () => {
  it("marca como changed un archivo con mtime distinto", () => {
    const result = diffFileStats(cache([["a.php", { mtimeMs: 1, size: 10 }]]), [stat("a.php", 2, 10)]);

    expect(result.changed).toEqual(["a.php"]);
    expect(result.deleted).toEqual([]);
  });

  it("marca como changed un archivo con size distinto", () => {
    const result = diffFileStats(cache([["a.php", { mtimeMs: 1, size: 10 }]]), [stat("a.php", 1, 11)]);

    expect(result.changed).toEqual(["a.php"]);
  });

  it("marca como changed un archivo nuevo (no estaba en cache)", () => {
    const result = diffFileStats(cache([]), [stat("nuevo.php", 1, 10)]);

    expect(result.changed).toEqual(["nuevo.php"]);
  });

  it("no marca nada cuando mtime y size coinciden", () => {
    const result = diffFileStats(cache([["a.php", { mtimeMs: 1, size: 10 }]]), [stat("a.php", 1, 10)]);

    expect(result.changed).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it("marca como deleted un archivo que ya no esta en el actual", () => {
    const result = diffFileStats(cache([["viejo.php", { mtimeMs: 1, size: 10 }]]), []);

    expect(result.deleted).toEqual(["viejo.php"]);
    expect(result.changed).toEqual([]);
  });

  it("clasifica simultaneamente changed, nuevo y deleted", () => {
    const result = diffFileStats(
      cache([
        ["igual.php", { mtimeMs: 1, size: 10 }],
        ["mod.php", { mtimeMs: 1, size: 10 }],
        ["borrado.php", { mtimeMs: 1, size: 10 }],
      ]),
      [stat("igual.php", 1, 10), stat("mod.php", 5, 10), stat("nuevo.php", 1, 10)],
    );

    expect(result.changed.sort()).toEqual(["mod.php", "nuevo.php"]);
    expect(result.deleted).toEqual(["borrado.php"]);
  });
});
