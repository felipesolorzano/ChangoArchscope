import { describe, expect, it } from "vitest";

import { findDuplicateMigrationPairs } from "../../../../../app/modules/plan/domain/services/findDuplicateMigrationPairs.js";

describe("findDuplicateMigrationPairs", () => {
  it("encuentra la mitad _new cuando el original existe en cualquier carpeta", () => {
    expect(findDuplicateMigrationPairs(["/a/Trafic.lib.inc", "/b/Trafic_new.lib.inc"])).toEqual([
      { file: "/b/Trafic_new.lib.inc", original: "Trafic.lib.inc" },
    ]);
  });

  it("parte el basename en el primer punto: la extension compuesta debe coincidir completa", () => {
    expect(findDuplicateMigrationPairs(["/r/Trafic.lang.lib.inc", "/r/Trafic_new.lib.inc"])).toEqual([]);
  });

  it("sin original no hay par", () => {
    expect(findDuplicateMigrationPairs(["/r/Trafic_new.lib.inc", "/r/Other.lib.inc"])).toEqual([]);
  });

  it("funciona con archivos sin extension", () => {
    expect(findDuplicateMigrationPairs(["/r/Makefile", "/r/Makefile_new"])).toEqual([{ file: "/r/Makefile_new", original: "Makefile" }]);
  });

  it("un archivo sin _new no es la mitad nueva, aunque otro tenga su nombre con _new", () => {
    expect(findDuplicateMigrationPairs(["/r/a.php", "/r/b.php"])).toEqual([]);
    // "_new.php" pediria un original ".php", que no existe.
    expect(findDuplicateMigrationPairs(["/r/new.php", "/r/_new.php"])).toEqual([]);
  });

  it("un nombre que no termina en _new no se recorta (ReportXXXX no es la mitad nueva de Report)", () => {
    expect(findDuplicateMigrationPairs(["/r/Report.php", "/r/ReportXXXX.php"])).toEqual([]);
  });

  it("_new en medio del nombre no cuenta", () => {
    expect(findDuplicateMigrationPairs(["/r/A.php", "/r/A_newer.php", "/r/A_new_x.php"])).toEqual([]);
  });

  it("un archivo por cada mitad nueva, en el orden de entrada", () => {
    const pairs = findDuplicateMigrationPairs(["/r/X_new.php", "/r/X.php", "/s/X_new.php", "/r/Y.inc", "/r/Y_new.inc"]);

    expect(pairs.map((pair) => pair.file)).toEqual(["/r/X_new.php", "/s/X_new.php", "/r/Y_new.inc"]);
  });
});
