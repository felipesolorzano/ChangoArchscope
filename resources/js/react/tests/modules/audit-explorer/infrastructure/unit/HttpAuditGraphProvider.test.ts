import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpAuditGraphProvider } from "../../../../../modules/audit-explorer/infrastructure/api/HttpAuditGraphProvider";

describe("HttpAuditGraphProvider.getHealth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide /audit-health.json con target y version de PHP", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ summary: { files: 1 } }) }));
    vi.stubGlobal("window", { location: { origin: "http://x" } });
    vi.stubGlobal("fetch", fetchMock);

    const health = await new HttpAuditGraphProvider("/audit-graph.json", "/audit-health.json").getHealth("react", "8.3");

    expect(fetchMock.mock.calls[0][0]).toBe("http://x/audit-health.json?target=react&php=8.3");
    expect(health).toEqual({ summary: { files: 1 } });
  });

  it("sin version no manda php", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("window", { location: { origin: "http://x" } });
    vi.stubGlobal("fetch", fetchMock);

    await new HttpAuditGraphProvider("/audit-graph.json", "/audit-health.json").getHealth("laravel", null);

    expect(fetchMock.mock.calls[0][0]).toBe("http://x/audit-health.json?target=laravel");
  });
});
