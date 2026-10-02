import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpDependenciesProvider } from "../../../../../modules/dependencies-explorer/infrastructure/api/HttpDependenciesProvider";

function stub(ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({ ok, status, json: async () => ({ total: 1 }) }));
  vi.stubGlobal("window", { location: { origin: "http://x" } });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HttpDependenciesProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide el reporte con target y solo los runtimes con valor", async () => {
    const fetchMock = stub();

    const report = await new HttpDependenciesProvider("/dependencies.json").getReport("react", { node: "20.19.5", npm: "", php: undefined }, false);

    expect(fetchMock.mock.calls[0]).toEqual(["http://x/dependencies.json?target=react&node=20.19.5", { headers: { Accept: "application/json" } }]);
    expect(report).toEqual({ total: 1 });
  });

  it("refresh agrega refresh=1 y respeta el orden php/node/npm", async () => {
    const fetchMock = stub();

    await new HttpDependenciesProvider("/dependencies.json").getReport("laravel", { npm: "10.9.3", php: "7.4.33", node: "14.21.3" }, true);

    expect(fetchMock.mock.calls[0][0]).toBe("http://x/dependencies.json?target=laravel&php=7.4.33&node=14.21.3&npm=10.9.3&refresh=1");
  });

  it("un error HTTP lanza con el status", async () => {
    stub(false, 502);

    await expect(new HttpDependenciesProvider("/dependencies.json").getReport("laravel", {}, false)).rejects.toThrow("No se pudo cargar el reporte de dependencias (502)");
  });
});
