import { describe, expect, it, vi } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { createAuditSnapshotCache } from "../../../../../app/modules/audit/application/use-cases/AuditSnapshotCache.js";

function snapshot(target = "laravel"): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target,
    module: null,
    summary: { files_scanned: 0, files_skipped: 0, modules: 0, findings_count: 0, by_category: {}, by_severity: {} },
    findings: [],
    riskScore: { value: 0, breakdown: {} },
    riskBreakdown: { byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] },
    skippedFiles: [],
  };
}

describe("createAuditSnapshotCache", () => {
  it("con mismo key y fingerprint computa una sola vez y reusa el snapshot", async () => {
    const cache = createAuditSnapshotCache();
    const compute = vi.fn(async () => snapshot());

    const a = await cache.resolve("laravel||", "fp1", compute);
    const b = await cache.resolve("laravel||", "fp1", compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("recomputa cuando el fingerprint cambia (codigo modificado)", async () => {
    const cache = createAuditSnapshotCache();
    const compute = vi.fn(async () => snapshot());

    await cache.resolve("laravel||", "fp1", compute);
    await cache.resolve("laravel||", "fp2", compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("mantiene entradas independientes por key", async () => {
    const cache = createAuditSnapshotCache();
    const compute = vi.fn(async () => snapshot());

    await cache.resolve("laravel||", "fp1", compute);
    await cache.resolve("react||", "fp1", compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("requests concurrentes con mismo key+fingerprint comparten un solo computo", async () => {
    const cache = createAuditSnapshotCache();
    const compute = vi.fn(() => new Promise<AuditSnapshot>((r) => setTimeout(() => r(snapshot()), 10)));

    const [a, b] = await Promise.all([
      cache.resolve("laravel||", "fp1", compute),
      cache.resolve("laravel||", "fp1", compute),
    ]);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("un rechazo tardio no borra una entrada mas nueva puesta bajo el mismo key", async () => {
    const cache = createAuditSnapshotCache();
    let rejectFirst!: (error: Error) => void;
    const computeReject = vi.fn(() => new Promise<AuditSnapshot>((_resolve, reject) => (rejectFirst = reject)));
    const computeOk = vi.fn(async () => snapshot());

    // 1er request (fp1) queda en vuelo; 2do request (fp2) lo reemplaza con una entrada valida.
    const first = cache.resolve("laravel||", "fp1", computeReject);
    first.catch(() => undefined);
    await cache.resolve("laravel||", "fp2", computeOk);

    // El 1ro rechaza DESPUES: no debe borrar la entrada fp2 ya cacheada.
    rejectFirst(new Error("tarde"));
    await Promise.resolve();

    await cache.resolve("laravel||", "fp2", computeOk);
    expect(computeOk).toHaveBeenCalledTimes(1); // fp2 siguio cacheada, no se recomputo
  });

  it("no cachea un rechazo: el siguiente resolve reintenta", async () => {
    const cache = createAuditSnapshotCache();
    const compute = vi
      .fn()
      .mockRejectedValueOnce(new Error("docker cayo"))
      .mockResolvedValueOnce(snapshot());

    await expect(cache.resolve("laravel||", "fp1", compute)).rejects.toThrow("docker cayo");
    const second = await cache.resolve("laravel||", "fp1", compute);

    expect(compute).toHaveBeenCalledTimes(2);
    expect(second.target).toBe("laravel");
  });
});
