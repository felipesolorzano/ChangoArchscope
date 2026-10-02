import { describe, expect, it } from "vitest";

import { resolveJsImport } from "../../../../../app/modules/audit/domain/services/jsImportResolution.js";

const known = new Set([
  "/src/pages/page.home.js",
  "/src/components/card.jsx",
  "/src/components/list.ts",
  "/src/components/item.tsx",
  "/src/routes/index.js",
  "/src/widgets/index.jsx",
  "/src/data/index.ts",
  "/src/ui/index.tsx",
  "/src/raw/data.json",
]);

describe("resolveJsImport", () => {
  it("resuelve la ruta exacta", () => {
    expect(resolveJsImport("/src/pages/page.home.js", "../raw/data.json", known)).toEqual(["/src/raw/data.json"]);
  });

  it.each([
    ["./page.home", "/src/pages/page.home.js"],
    ["../components/card", "/src/components/card.jsx"],
    ["../components/list", "/src/components/list.ts"],
    ["../components/item", "/src/components/item.tsx"],
  ])("agrega la extension: %s", (source, expected) => {
    expect(resolveJsImport("/src/pages/page.home.js", source, known)).toEqual([expected]);
  });

  it.each([
    ["../routes", "/src/routes/index.js"],
    ["../widgets", "/src/widgets/index.jsx"],
    ["../data", "/src/data/index.ts"],
    ["../ui", "/src/ui/index.tsx"],
  ])("resuelve index de una carpeta: %s", (source, expected) => {
    expect(resolveJsImport("/src/pages/page.home.js", source, known)).toEqual([expected]);
  });

  it("convencion ESM de TypeScript: un import .js/.jsx apunta al .ts/.tsx", () => {
    const files = new Set(["/src/app/App.tsx", "/src/app/store.ts", "/src/app/Card.tsx", "/src/app/real.js", "/src/app/real.ts"]);

    expect(resolveJsImport("/src/app/main.tsx", "./App.js", files)).toEqual(["/src/app/App.tsx"]);
    expect(resolveJsImport("/src/app/main.tsx", "./store.js", files)).toEqual(["/src/app/store.ts"]);
    expect(resolveJsImport("/src/app/main.tsx", "./Card.jsx", files)).toEqual(["/src/app/Card.tsx"]);
    expect(resolveJsImport("/src/app/main.tsx", "./real.js", files)).toEqual(["/src/app/real.js"]);
    expect(resolveJsImport("/src/app/main.tsx", "./missing.js", files)).toEqual([]);
  });

  it("solo reemplaza un .js/.jsx FINAL", () => {
    expect(resolveJsImport("/src/main.ts", "./legacy.js.bak", new Set(["/src/legacy.bak.ts"]))).toEqual([]);
  });

  it("prefiere el archivo a la carpeta con index", () => {
    const files = new Set(["/src/a.js", "/src/a/index.js"]);

    expect(resolveJsImport("/src/b.js", "./a", files)).toEqual(["/src/a.js"]);
  });

  it("paquetes, alias y rutas inexistentes son null", () => {
    expect(resolveJsImport("/src/pages/page.home.js", "react", known)).toEqual([]);
    expect(resolveJsImport("/src/pages/page.home.js", "@modules/x", known)).toEqual([]);
    expect(resolveJsImport("/src/pages/page.home.js", "./missing", known)).toEqual([]);
  });

  it("no confunde un paquete que empieza con punto en el nombre", () => {
    expect(resolveJsImport("/src/a.js", ".hidden", new Set(["/src/.hidden.js"]))).toEqual([]);
  });
});

describe("resolveJsImport — imports dinamicos", () => {
  const configs = new Set([
    "/src/configs/config.js",
    "/src/configs/config.avis.js",
    "/src/configs/config.hertz.jsx",
    "/src/configs/brand/index.ts",
    "/src/configs/other.js",
    "/src/configs/sub/config.deep.js",
    "/src/configs/config.notes.txt",
  ]);

  it("devuelve todos los archivos que encajan con el patron (${} no cruza carpetas)", () => {
    expect(resolveJsImport("/src/configs/config.js", "./config.${}", configs)).toEqual([
      "/src/configs/config.avis.js",
      "/src/configs/config.hertz.jsx",
    ]);
  });

  it("el patron encaja con extension o con index de carpeta, no con la base exacta", () => {
    const files = new Set(["/src/a/x.json", "/src/a/y/index.tsx", "/src/a/z.ts", "/src/a/.ts"]);

    expect(resolveJsImport("/src/main.js", "./a/${}", files)).toEqual(["/src/a/y/index.tsx", "/src/a/z.ts"]);
  });

  it("escapa los caracteres especiales del texto fijo", () => {
    const files = new Set(["/src/a+b.c.js", "/src/aab.c.js", "/src/a+bxc.js"]);

    expect(resolveJsImport("/src/main.js", "./a+b.${}", files)).toEqual(["/src/a+b.c.js"]);
  });

  it("un patron no relativo o sin coincidencias es vacio", () => {
    expect(resolveJsImport("/src/main.js", "${}/x", configs)).toEqual([]);
    expect(resolveJsImport("/src/main.js", "./nope.${}", configs)).toEqual([]);
  });
});
