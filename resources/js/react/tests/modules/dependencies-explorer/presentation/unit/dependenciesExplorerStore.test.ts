import { beforeEach, describe, expect, it } from "vitest";

import { initialDependenciesExplorerState, useDependenciesExplorerStore } from "../../../../../modules/dependencies-explorer/presentation/store/dependenciesExplorerStore";

const state = () => useDependenciesExplorerStore.getState();

beforeEach(() => {
  useDependenciesExplorerStore.setState(initialDependenciesExplorerState());
});

describe("dependenciesExplorerStore", () => {
  it("arranca sin runtime elegido, sin filtros y sin seleccion", () => {
    expect(initialDependenciesExplorerState()).toEqual({ runtimes: {}, status: "all", query: "", hideDev: false, selected: null });
    expect(state()).toMatchObject(initialDependenciesExplorerState());
  });

  it("setRuntime guarda por kind sin pisar los demas", () => {
    state().setRuntime("node", "22.20.0");
    state().setRuntime("npm", "10.9.3");
    state().setRuntime("node", "20.19.5");

    expect(state().runtimes).toEqual({ node: "20.19.5", npm: "10.9.3" });
  });

  it("toggleStatus filtra por un estado y el mismo otra vez vuelve a all", () => {
    state().toggleStatus("major");
    expect(state().status).toBe("major");

    state().toggleStatus("deprecated");
    expect(state().status).toBe("deprecated");

    state().toggleStatus("deprecated");
    expect(state().status).toBe("all");
  });

  it("query, hideDev y select", () => {
    state().setQuery("react");
    state().setHideDev(true);
    state().select("npm:react");

    expect(state()).toMatchObject({ query: "react", hideDev: true, selected: "npm:react" });

    state().select(null);
    expect(state().selected).toBeNull();
  });

  it("el snapshot de servidor es el estado actual (render estatico)", () => {
    state().setQuery("x");

    const api = useDependenciesExplorerStore as unknown as { getServerState: () => { query: string } };
    expect(api.getServerState().query).toBe("x");
  });
});
