import { describe, expect, it } from "vitest";

import { findDuplicateEdges, originalLabelOf } from "../../../../../app/modules/audit/domain/services/auditDuplicates.js";

describe("originalLabelOf", () => {
  it("reconstruye el original quitando solo el sufijo _new del stem, conservando la extension", () => {
    expect(originalLabelOf("OrderService_new.lib.inc")).toBe("OrderService.lib.inc");
    expect(originalLabelOf("Foo_new.php")).toBe("Foo.php");
  });

  it("devuelve null cuando no es una variante _new", () => {
    expect(originalLabelOf("OrderService.lib.inc")).toBeNull();
    expect(originalLabelOf("OrderService.translations.lib.inc")).toBeNull();
  });
});

describe("findDuplicateEdges", () => {
  it("conecta X.<ext> con X_new.<ext> cuando ambos estan presentes", () => {
    const edges = findDuplicateEdges([
      { id: "file:a/OrderService.lib.inc", label: "OrderService.lib.inc" },
      { id: "file:a/OrderService_new.lib.inc", label: "OrderService_new.lib.inc" },
      { id: "file:a/Other.php", label: "Other.php" },
    ]);

    expect(edges).toEqual([
      {
        id: "duplicate:file:a/OrderService.lib.inc:file:a/OrderService_new.lib.inc",
        source: "file:a/OrderService.lib.inc",
        target: "file:a/OrderService_new.lib.inc",
        kind: "duplicate",
      },
    ]);
  });

  it("NO confunde un archivo con extension compuesta distinta (translations) como el original", () => {
    const edges = findDuplicateEdges([
      { id: "file:a/OrderService.translations.lib.inc", label: "OrderService.translations.lib.inc" },
      { id: "file:a/OrderService_new.lib.inc", label: "OrderService_new.lib.inc" },
    ]);

    expect(edges).toEqual([]);
  });

  it("no genera edge si solo existe el _new (sin el original presente)", () => {
    const edges = findDuplicateEdges([{ id: "x", label: "OrderService_new.lib.inc" }]);

    expect(edges).toEqual([]);
  });

  it("no genera edges cuando no hay pares", () => {
    expect(findDuplicateEdges([{ id: "x", label: "A.php" }, { id: "y", label: "B.php" }])).toEqual([]);
  });
});
