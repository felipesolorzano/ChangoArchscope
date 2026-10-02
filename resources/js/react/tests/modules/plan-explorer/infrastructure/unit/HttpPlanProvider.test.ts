import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpPlanProvider } from "../../../../../modules/plan-explorer/infrastructure/api/HttpPlanProvider";

describe("HttpPlanProvider.getProtection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide la proteccion del target", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ level: "none" }) }));
    vi.stubGlobal("window", { location: { origin: "http://x" } });
    vi.stubGlobal("fetch", fetchMock);

    const protection = await new HttpPlanProvider("/plan.json", "/plan/tasks", "/protection.json", "/characterization.json").getProtection("react");

    expect(fetchMock.mock.calls[0]).toEqual(["http://x/protection.json?target=react", { headers: { Accept: "application/json" } }]);
    expect(protection).toEqual({ level: "none" });
  });

  it("sin target usa laravel; error HTTP lanza con el status", async () => {
    vi.stubGlobal("window", { location: { origin: "http://x" } });
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new HttpPlanProvider("/plan.json", "/plan/tasks", "/protection.json", "/characterization.json").getProtection()).rejects.toThrow("No se pudo cargar la proteccion (500)");
    expect(fetchMock.mock.calls[0][0]).toBe("http://x/protection.json?target=laravel");
  });
});

describe("HttpPlanProvider.getCharacterization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide los objetivos del target; sin target laravel; error con status", async () => {
    vi.stubGlobal("window", { location: { origin: "http://x" } });
    const ok = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ targets: [] }) }));
    vi.stubGlobal("fetch", ok);
    const provider = new HttpPlanProvider("/plan.json", "/plan/tasks", "/protection.json", "/characterization.json");

    expect(await provider.getCharacterization("react")).toEqual({ targets: [] });
    expect(ok.mock.calls[0]).toEqual(["http://x/characterization.json?target=react", { headers: { Accept: "application/json" } }]);

    const failing = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    vi.stubGlobal("fetch", failing);
    await expect(provider.getCharacterization()).rejects.toThrow("No se pudieron calcular los objetivos de caracterizacion (502)");
    expect(failing.mock.calls[0][0]).toBe("http://x/characterization.json?target=laravel");
  });
});

