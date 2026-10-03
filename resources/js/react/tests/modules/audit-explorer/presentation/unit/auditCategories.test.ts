import { describe, expect, it } from "vitest";

import { auditCategoriesFor } from "../../../../../modules/audit-explorer/presentation/constants/auditCategories";

describe("auditCategoriesFor", () => {
  it("laravel: categorias PHP en orden, sin api_access", () => {
    expect(auditCategoriesFor("laravel")).toEqual([
      { accent: "php_compatibility", label: "Compatibilidad PHP" },
      { accent: "security", label: "Seguridad" },
      { accent: "database", label: "Base de datos" },
      { accent: "complexity", label: "Complejidad" },
      { accent: "testing", label: "Testing" },
      { accent: "dead_code", label: "Codigo muerto" },
      { accent: "coupling_low_level", label: "Acoplamiento" },
      { accent: "legacy_api", label: "APIs legacy" },
    ]);
  });

  it("react: categorias React en orden, sin php_compatibility ni database", () => {
    expect(auditCategoriesFor("react")).toEqual([
      { accent: "security", label: "Seguridad" },
      { accent: "api_access", label: "API / HTTP" },
      { accent: "complexity", label: "Complejidad" },
      { accent: "testing", label: "Testing" },
      { accent: "dead_code", label: "Codigo muerto" },
      { accent: "coupling_low_level", label: "Acoplamiento" },
      { accent: "legacy_api", label: "APIs legacy" },
    ]);
  });
});
