import { describe, expect, it } from "vitest";

import { runtimeProduct, supportProductFor } from "../../../../../app/modules/dependencies/domain/services/supportProducts.js";
import { supportStatus } from "../../../../../app/modules/dependencies/domain/services/supportStatus.js";
import type { SupportCycle } from "../../../../../app/modules/dependencies/domain/value-objects/Security.js";

const cycle = (name: string, eol: string | boolean, latest: string | null = null): SupportCycle => ({ cycle: name, latest, releaseDate: null, eol, support: null });
const TODAY = "2026-10-02";

describe("supportStatus", () => {
  const php = [cycle("8.3", "2027-12-31", "8.3.35"), cycle("8.2", "2026-10-02", "8.2.34"), cycle("8.0", "2023-11-26"), cycle("8", false)];

  it("ciclo por prefijo de segmentos, el mas largo, con eol vigente", () => {
    expect(supportStatus("php", "8.3.6", php, TODAY)).toEqual({ product: "php", cycle: "8.3", eol: "2027-12-31", isEol: false, latestInCycle: "8.3.35" });
    expect(supportStatus("php", "8.3", php, TODAY)?.cycle).toBe("8.3");
  });

  it("eol con fecha de hoy o pasada esta vencido; eol booleano se respeta", () => {
    expect(supportStatus("php", "8.2.1", php, TODAY)?.isEol).toBe(true);
    expect(supportStatus("php", "8.0.30", php, TODAY)?.isEol).toBe(true);
    expect(supportStatus("php", "8.1.0", php, TODAY)).toMatchObject({ cycle: "8", isEol: false, latestInCycle: null });
    expect(supportStatus("jquery", "2.2.4", [cycle("2", true)], TODAY)?.isEol).toBe(true);
  });

  it("gana el ciclo mas largo aunque venga despues", () => {
    expect(supportStatus("php", "8.0.1", [cycle("8", false), cycle("8.0", "2023-11-26")], TODAY)).toMatchObject({ cycle: "8.0", isEol: true });
    expect(supportStatus("php", "8.0.1", [cycle("8", false), cycle("8.0", "2023-11-26"), cycle("7", true)], "2026-10-02T12:00:00.000Z")?.cycle).toBe("8.0");
  });

  it("8.3 no es prefijo de 8.30; sin version o sin ciclo → null", () => {
    expect(supportStatus("php", "8.30.0", [cycle("8.3", false)], TODAY)).toBeNull();
    expect(supportStatus("php", null, php, TODAY)).toBeNull();
    expect(supportStatus("php", "7.4.0", php, TODAY)).toBeNull();
  });
});

describe("productos de endoflife.date", () => {
  it("runtimes", () => {
    expect(["php", "node", "npm"].map((kind) => runtimeProduct(kind as "php"))).toEqual(["php", "nodejs", null]);
  });

  it("paquetes npm y composer reconocidos; el resto null", () => {
    const npm = ["react", "vue", "@angular/core", "jquery", "jquery-ui", "bootstrap", "eslint", "express", "electron", "next", "nuxt"];
    expect(npm.map((name) => supportProductFor("npm", name))).toEqual(["react", "vue", "angular", "jquery", "jquery-ui", "bootstrap", "eslint", "express", "electron", "nextjs", "nuxt"]);

    const composer = ["laravel/framework", "symfony/symfony", "symfony/http-kernel", "drupal/core", "cakephp/cakephp"];
    expect(composer.map((name) => supportProductFor("composer", name))).toEqual(["laravel", "symfony", "symfony", "drupal", "cakephp"]);

    expect(supportProductFor("npm", "lodash")).toBeNull();
    expect(supportProductFor("composer", "react")).toBeNull();
    expect(supportProductFor("npm", "laravel/framework")).toBeNull();
  });
});
