import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App, viewKey } from "../../../../../modules/app/presentation/App";
import { browserLocation } from "../../../../../modules/app/infrastructure/browser/browserLocation";

describe("App", () => {
  it("selector de stack con el activo marcado, las 5 pestañas y Arquitectura montada", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toMatch(/aria-pressed="true"[^>]*>Laravel</);
    expect(markup).toMatch(/aria-pressed="false"[^>]*>React</);
    for (const tab of ["Arquitectura", "Auditoría", "Plan", "Migración", "Diseño"]) expect(markup).toContain(`>${tab}<`);
    expect(markup).toMatch(/app-tab--active"[^>]*>Arquitectura</);
    expect(markup).toContain("Architecture Explorer");
  });
});

describe("viewKey", () => {
  it("distingue vista y stack: Migracion y Diseño no comparten instancia", () => {
    expect(viewKey("migration", "laravel")).toBe("migration:laravel");
    expect(viewKey("design", "laravel")).not.toBe(viewKey("migration", "laravel"));
    expect(viewKey("design", "react")).not.toBe(viewKey("design", "laravel"));
  });
});

describe("browserLocation sin window", () => {
  it("search devuelve vacio", () => {
    expect(browserLocation.search()).toBe("");
  });
});
