import { describe, expect, it, vi } from "vitest";

import { HttpPackageRegistry } from "../../../../../app/modules/dependencies/infrastructure/registry/HttpPackageRegistry.js";

const respond = (status: number, body: unknown = {}) => vi.fn(async () => ({ status, body }));

describe("HttpPackageRegistry", () => {
  it("npm: codifica el scope en la URL y mapea el documento", async () => {
    const fetchJson = respond(200, { versions: { "7.9.0": { version: "7.9.0" } } });

    const info = await new HttpPackageRegistry(fetchJson).fetch("npm", "@babel/core");

    expect(fetchJson).toHaveBeenCalledWith("https://registry.npmjs.org/@babel%2Fcore");
    expect(info).toMatchObject({ ecosystem: "npm", name: "@babel/core", releases: [{ version: "7.9.0" }] });
  });

  it("packagist: nombre en minusculas en la URL y mapea con el nombre pedido", async () => {
    const fetchJson = respond(200, { packages: { "phpoffice/phpexcel": [{ version: "1.8.2" }] } });

    const info = await new HttpPackageRegistry(fetchJson).fetch("composer", "PHPOffice/PHPExcel");

    expect(fetchJson).toHaveBeenCalledWith("https://repo.packagist.org/p2/phpoffice/phpexcel.json");
    expect(info).toMatchObject({ ecosystem: "composer", releases: [{ version: "1.8.2" }] });
  });

  it("404 → null; otro status fuera de 2xx lanza con status y URL; 2xx distinto de 200 tambien mapea", async () => {
    await expect(new HttpPackageRegistry(respond(404)).fetch("npm", "nope")).resolves.toBeNull();
    await expect(new HttpPackageRegistry(respond(500)).fetch("npm", "x")).rejects.toThrow("HTTP 500 en https://registry.npmjs.org/x");
    await expect(new HttpPackageRegistry(respond(304)).fetch("npm", "x")).rejects.toThrow("HTTP 304");
    await expect(new HttpPackageRegistry(respond(300)).fetch("npm", "x")).rejects.toThrow("HTTP 300");
    await expect(new HttpPackageRegistry(respond(203, { versions: {} })).fetch("npm", "x")).resolves.toMatchObject({ releases: [] });
    await expect(new HttpPackageRegistry(respond(199)).fetch("npm", "x")).rejects.toThrow("HTTP 199");
  });
});
