import path from "node:path";

import type { CharacterizationStack, CharacterizationTarget, TestSkeleton } from "../value-objects/Characterization.js";
import { pascalCase } from "./pascalCase.js";

const TYPESCRIPT = new Set([".ts", ".tsx"]);

// Esqueletos de tests de caracterizacion para empezar a congelar el comportamiento actual.
export function characterizationSkeletons(target: CharacterizationTarget, stack: CharacterizationStack): TestSkeleton[] {
  return stack === "laravel" ? phpunitSkeletons(target) : reactSkeletons(target);
}

function reactSkeletons(target: CharacterizationTarget): TestSkeleton[] {
  const { dir, name, ext } = path.posix.parse(target.file);
  const folder = dir === "" ? "__characterization__" : `${dir}/__characterization__`;
  const skeletons: TestSkeleton[] = [];

  if (target.untested.some((unit) => unit.exportedAs != null)) {
    skeletons.push({ kind: "rtl", path: `${folder}/${name}.characterization.test.${TYPESCRIPT.has(ext) ? "tsx" : "jsx"}`, content: rtlContent(target, name) });
  }
  if (target.endpoints.length > 0) {
    skeletons.push({ kind: "msw", path: `${folder}/${name}.handlers.js`, content: mswContent(target.endpoints) });
  }
  if (target.kind === "page") {
    skeletons.push({ kind: "playwright", path: `e2e/characterization/${name}.spec.ts`, content: playwrightContent(name) });
  }
  return skeletons;
}

// En JSX el componente va en PascalCase (`<checkout />` seria una etiqueta HTML).
function rtlContent(target: CharacterizationTarget, stem: string): string {
  const exported = target.untested.filter((unit) => unit.exportedAs != null);
  const hidden = target.untested.filter((unit) => unit.exportedAs == null);
  const defaultUnit = exported.find((unit) => unit.exportedAs === "default");
  const named = exported
    .filter((unit) => unit !== defaultUnit)
    .map((unit) => (unit.exportedAs === pascalCase(unit.name) ? unit.exportedAs : `${unit.exportedAs} as ${pascalCase(unit.name)}`));
  const specifiers = [defaultUnit && pascalCase(defaultUnit.name), named.length > 0 ? `{ ${named.join(", ")} }` : undefined].filter(Boolean).join(", ");

  return [
    'import { render } from "@testing-library/react";',
    `import ${specifiers} from "../${stem}";`,
    "",
    `// Caracterizacion: congela lo que ${stem} renderiza HOY (no si esta bien). Si cambia, decidir si fue a proposito.`,
    ...hidden.map((unit) => `// ${unit.name} no se exporta: se caracteriza a traves de quien lo usa`),
    `describe("${stem} (caracterizacion)", () => {`,
    ...exported.map((unit) => pascalCase(unit.name)).flatMap((name) => [
      `  it("${name} renderiza igual que hoy", () => {`,
      `    const { container } = render(<${name} />); // TODO: props reales`,
      "    expect(container).toMatchSnapshot();",
      "  });",
    ]),
    "});",
    "",
  ].join("\n");
}

function mswContent(endpoints: string[]): string {
  return [
    'import { http, HttpResponse } from "msw";',
    "",
    "// Congela los contratos HTTP que usa hoy el componente (usar con setupServer en los tests).",
    "export const handlers = [",
    ...endpoints.map((endpoint) => `  http.all("*${endpoint}*", () => HttpResponse.json({})), // TODO: respuesta real capturada`),
    "];",
    "",
  ].join("\n");
}

function playwrightContent(stem: string): string {
  return [
    'import { expect, test } from "@playwright/test";',
    "",
    `test("${stem} se ve igual que hoy", async ({ page }) => {`,
    `  await page.goto("/"); // TODO: ruta real de ${stem}`,
    "  await expect(page).toHaveScreenshot();",
    "});",
    "",
  ].join("\n");
}

function phpunitSkeletons(target: CharacterizationTarget): TestSkeleton[] {
  const methodsByClass = new Map<string, string[]>();
  for (const unit of target.untested) {
    const [className, method] = unit.name.split("::");
    methodsByClass.set(className, [...(methodsByClass.get(className) ?? []), method]);
  }

  return [...methodsByClass].map(([className, methods]) => ({
    kind: "phpunit",
    path: `tests/Characterization/${className}CharacterizationTest.php`,
    content: phpunitContent(target.file, className, methods),
  }));
}

function phpunitContent(file: string, className: string, methods: string[]): string {
  return [
    "<?php",
    "",
    "use PHPUnit\\Framework\\TestCase;",
    "",
    `// Fuente: ${file}`,
    "// Golden master: la primera corrida guarda la salida actual en golden/; despues cualquier cambio falla.",
    `final class ${className}CharacterizationTest extends TestCase`,
    "{",
    ...methods.flatMap((method) => [
      `    public function test_${method}_golden_master(): void`,
      "    {",
      `        $result = (new ${className}())->${method}(/* TODO: entradas reales */);`,
      `        $this->assertJsonStringEqualsJsonFile(__DIR__ . '/golden/${className}_${method}.json', json_encode($result));`,
      "    }",
      "",
    ]),
    "}",
    "",
  ].join("\n");
}
