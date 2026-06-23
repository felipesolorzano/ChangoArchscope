import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { BoundedContextMap } from "../../../../../app/modules/migration/domain/value-objects/BoundedContextMap.js";
import type { BoundedContextMapRepository } from "../../../../../app/modules/migration/application/contracts/BoundedContextMapRepository.js";
import { BoundedContextMapController } from "../../../../../app/modules/migration/presentation/http/BoundedContextMapController.js";

function repository(map: BoundedContextMap | null = null): BoundedContextMapRepository {
  return { getMap: vi.fn(() => map), saveMap: vi.fn() };
}

const source = {
  getSource: (target: string) => ({ target, root: "/abs/app/modules", extensions: [".php"], ignoredPaths: [], files: ["/abs/app/modules/A.php"] }),
};

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json, response: { status } as unknown as Response };
}

describe("BoundedContextMapController", () => {
  it("show devuelve un mapa vacio cuando no hay guardado (target laravel por defecto)", () => {
    const repo = repository(null);
    const controller = new BoundedContextMapController({ repository: repo, source });
    const { status, json, response } = fakeResponse();

    controller.show({ query: {} } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(repo.getMap).toHaveBeenCalledWith("laravel");
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({ modules: [] });
  });

  it("show devuelve el mapa guardado y usa el target del query", () => {
    const saved: BoundedContextMap = { generatedAt: "t", modules: [{ key: "tours", name: "Tours", validated: true, layers: { domain: [], application: [], infrastructure: [], presentation: [] } }] };
    const repo = repository(saved);
    const controller = new BoundedContextMapController({ repository: repo, source });
    const { json, response } = fakeResponse();

    controller.show({ query: { target: "myproj" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(repo.getMap).toHaveBeenCalledWith("myproj");
    expect(json.mock.calls[0][0]).toBe(saved);
  });

  it("save normaliza el body, lo persiste y responde el mapa normalizado", () => {
    const repo = repository();
    const controller = new BoundedContextMapController({ repository: repo, source });
    const { status, json, response } = fakeResponse();

    controller.save(
      { query: { target: "laravel" }, body: { modules: [{ key: "tours", name: "Tours", layers: { domain: [{ path: "Tours/Domain/Tour.php" }] } }] } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(repo.saveMap).toHaveBeenCalledWith("laravel", expect.objectContaining({ modules: expect.any(Array) }));
    expect(status).toHaveBeenCalledWith(200);
    const saved = json.mock.calls[0][0] as BoundedContextMap;
    expect(saved.modules[0].layers.application).toEqual([]); // normalizado: 4 capas
  });

  it("source devuelve la raiz del proyecto y los archivos en alcance (para el agente)", () => {
    const controller = new BoundedContextMapController({ repository: repository(), source });
    const { status, json, response } = fakeResponse();

    controller.source({ query: { target: "laravel" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({ target: "laravel", root: "/abs/app/modules", files: ["/abs/app/modules/A.php"] });
  });

  it("save con body invalido delega a next sin persistir", () => {
    const repo = repository();
    const controller = new BoundedContextMapController({ repository: repo, source });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    controller.save({ query: {}, body: { modules: [{ name: "SinKey" }] } } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(repo.saveMap).not.toHaveBeenCalled();
  });
});
