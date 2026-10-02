import { describe, expect, it } from "vitest";

import { characterizationSkeletons } from "../../../../../app/modules/characterization/domain/services/characterizationSkeletons.js";
import type { CharacterizationTarget } from "../../../../../app/modules/characterization/domain/value-objects/Characterization.js";

const target = (overrides: Partial<CharacterizationTarget> = {}): CharacterizationTarget => ({
  file: "pages/page.checkout.js",
  kind: "page",
  score: 1,
  risk: 1,
  importers: 0,
  untested: [
    { name: "PageCheckout", complexity: 40, exportedAs: "default" },
    { name: "Cart", complexity: 3, exportedAs: "Cart" },
  ],
  endpoints: ["DoPayment", "GetPromotion"],
  ...overrides,
});

describe("characterizationSkeletons (react)", () => {
  it("pagina con endpoints: rtl, msw y playwright", () => {
    const [rtl, msw, playwright] = characterizationSkeletons(target(), "react");

    expect(rtl.kind).toBe("rtl");
    expect(rtl.path).toBe("pages/__characterization__/page.checkout.characterization.test.jsx");
    expect(rtl.content).toContain('import { render } from "@testing-library/react";');
    expect(rtl.content).toContain('import PageCheckout, { Cart } from "../page.checkout";');
    expect(rtl.content).toContain('it("PageCheckout renderiza igual que hoy", () => {');
    expect(rtl.content).toContain("const { container } = render(<PageCheckout />); // TODO: props reales");
    expect(rtl.content).toContain('it("Cart renderiza igual que hoy", () => {');
    expect(rtl.content).toContain("expect(container).toMatchSnapshot();");

    expect(msw).toMatchObject({ kind: "msw", path: "pages/__characterization__/page.checkout.handlers.js" });
    expect(msw.content).toContain('import { http, HttpResponse } from "msw";');
    expect(msw.content).toContain('http.all("*DoPayment*", () => HttpResponse.json({})), // TODO: respuesta real capturada');
    expect(msw.content).toContain('http.all("*GetPromotion*"');

    expect(playwright).toMatchObject({ kind: "playwright", path: "e2e/characterization/page.checkout.spec.ts" });
    expect(playwright.content).toContain('import { expect, test } from "@playwright/test";');
    expect(playwright.content).toContain('await page.goto("/"); // TODO: ruta real de page.checkout');
    expect(playwright.content).toContain("await expect(page).toHaveScreenshot();");
  });

  it("componente sin endpoints en raiz y TypeScript: solo rtl tsx", () => {
    const skeletons = characterizationSkeletons(target({ file: "Hub.tsx", kind: "component", endpoints: [], untested: [{ name: "Hub", complexity: 1, exportedAs: "default" }] }), "react");

    expect(skeletons.map((skeleton) => [skeleton.kind, skeleton.path])).toEqual([["rtl", "__characterization__/Hub.characterization.test.tsx"]]);
    expect(skeletons[0].content).toContain('import Hub from "../Hub";');
    expect(characterizationSkeletons(target({ file: "a/b.ts", kind: "component", endpoints: [] }), "react")[0].path).toBe("a/__characterization__/b.characterization.test.tsx");
  });
});

describe("characterizationSkeletons (react): nombres en JSX y no exportados", () => {
  it("minusculas pasan a PascalCase (alias en el import nombrado); los no exportados quedan como comentario", () => {
    const untested = [
      { name: "checkout", complexity: 5, exportedAs: "default" },
      { name: "cartlist", complexity: 3, exportedAs: "cartlist" },
      { name: "Inner", complexity: 2, exportedAs: null },
    ];
    const [rtl] = characterizationSkeletons(target({ untested, endpoints: [] }), "react");

    expect(rtl.content).toBe(`import { render } from "@testing-library/react";
import Checkout, { cartlist as Cartlist } from "../page.checkout";

// Caracterizacion: congela lo que page.checkout renderiza HOY (no si esta bien). Si cambia, decidir si fue a proposito.
// Inner no se exporta: se caracteriza a traves de quien lo usa
describe("page.checkout (caracterizacion)", () => {
  it("Checkout renderiza igual que hoy", () => {
    const { container } = render(<Checkout />); // TODO: props reales
    expect(container).toMatchSnapshot();
  });
  it("Cartlist renderiza igual que hoy", () => {
    const { container } = render(<Cartlist />); // TODO: props reales
    expect(container).toMatchSnapshot();
  });
});
`);
  });

  it("solo nombrados: sin import por defecto; nada exportado: sin rtl", () => {
    const named = characterizationSkeletons(target({ kind: "component", endpoints: [], untested: [{ name: "Cart", complexity: 1, exportedAs: "Cart" }] }), "react");
    expect(named[0].content).toContain('import { Cart } from "../page.checkout";');

    const hidden = characterizationSkeletons(target({ endpoints: [], untested: [{ name: "Inner", complexity: 1, exportedAs: null }] }), "react");
    expect(hidden.map((skeleton) => skeleton.kind)).toEqual(["playwright"]);
  });
});

describe("characterizationSkeletons (laravel)", () => {
  it("un golden master de PHPUnit por clase con un metodo por metodo sin test", () => {
    const skeletons = characterizationSkeletons(
      target({ file: "lib/Trafic.lib.inc", kind: "php", endpoints: [], untested: [{ name: "MSTrafic::Book", complexity: null }, { name: "MSTrafic::Cancel", complexity: null }, { name: "Other::Run", complexity: null }] }),
      "laravel",
    );

    expect(skeletons.map((skeleton) => [skeleton.kind, skeleton.path])).toEqual([
      ["phpunit", "tests/Characterization/MSTraficCharacterizationTest.php"],
      ["phpunit", "tests/Characterization/OtherCharacterizationTest.php"],
    ]);
    const [trafic] = skeletons;
    expect(trafic.content).toContain("// Fuente: lib/Trafic.lib.inc");
    expect(trafic.content).toContain("final class MSTraficCharacterizationTest extends TestCase");
    expect(trafic.content).toContain("public function test_Book_golden_master(): void");
    expect(trafic.content).toContain("public function test_Cancel_golden_master(): void");
    expect(trafic.content).toContain("$result = (new MSTrafic())->Book(/* TODO: entradas reales */);");
    expect(trafic.content).toContain("$this->assertJsonStringEqualsJsonFile(__DIR__ . '/golden/MSTrafic_Book.json', json_encode($result));");
  });
});

describe("characterizationSkeletons: contenido completo", () => {
  it("rtl, msw y playwright de una pagina", () => {
    const [rtl, msw, playwright] = characterizationSkeletons(target({ endpoints: ["DoPayment"] }), "react");

    expect(rtl.content).toBe(`import { render } from "@testing-library/react";
import PageCheckout, { Cart } from "../page.checkout";

// Caracterizacion: congela lo que page.checkout renderiza HOY (no si esta bien). Si cambia, decidir si fue a proposito.
describe("page.checkout (caracterizacion)", () => {
  it("PageCheckout renderiza igual que hoy", () => {
    const { container } = render(<PageCheckout />); // TODO: props reales
    expect(container).toMatchSnapshot();
  });
  it("Cart renderiza igual que hoy", () => {
    const { container } = render(<Cart />); // TODO: props reales
    expect(container).toMatchSnapshot();
  });
});
`);
    expect(msw.content).toBe(`import { http, HttpResponse } from "msw";

// Congela los contratos HTTP que usa hoy el componente (usar con setupServer en los tests).
export const handlers = [
  http.all("*DoPayment*", () => HttpResponse.json({})), // TODO: respuesta real capturada
];
`);
    expect(playwright.content).toBe(`import { expect, test } from "@playwright/test";

test("page.checkout se ve igual que hoy", async ({ page }) => {
  await page.goto("/"); // TODO: ruta real de page.checkout
  await expect(page).toHaveScreenshot();
});
`);
  });

  it("varios componentes nombrados sin default y extension .jsx o .tsx", () => {
    const [rtl] = characterizationSkeletons(target({ file: "w.tsx.bak.js", kind: "component", endpoints: [], untested: [{ name: "A", complexity: 1, exportedAs: "A" }, { name: "B", complexity: 1, exportedAs: "B" }] }), "react");

    expect(rtl.path).toBe("__characterization__/w.tsx.bak.characterization.test.jsx");
    expect(rtl.content).toContain('import { A, B } from "../w.tsx.bak";');
    expect(characterizationSkeletons(target({ file: "x.mtsx", kind: "component", endpoints: [] }), "react")[0].path).toBe("__characterization__/x.characterization.test.jsx");
  });

  it("phpunit completo", () => {
    const [php] = characterizationSkeletons(target({ file: "lib/T.php", kind: "php", endpoints: [], untested: [{ name: "T::Run", complexity: null }] }), "laravel");

    expect(php.content).toBe(`<?php

use PHPUnit\\Framework\\TestCase;

// Fuente: lib/T.php
// Golden master: la primera corrida guarda la salida actual en golden/; despues cualquier cambio falla.
final class TCharacterizationTest extends TestCase
{
    public function test_Run_golden_master(): void
    {
        $result = (new T())->Run(/* TODO: entradas reales */);
        $this->assertJsonStringEqualsJsonFile(__DIR__ . '/golden/T_Run.json', json_encode($result));
    }

}
`);
  });
});
