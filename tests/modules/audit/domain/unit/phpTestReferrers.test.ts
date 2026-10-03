import { describe, expect, it } from "vitest";

import { phpTestReferrers } from "../../../../../app/modules/audit/domain/services/phpTestReferrers.js";
import { phpClass, phpFile } from "../../support/phpStructures.js";

describe("phpTestReferrers (XRay X5)", () => {
  it("por archivo, los tests (clase *TestCase) que referencian alguna de sus clases", () => {
    const files = [
      phpFile("/mc/Trafic.php", { classes: [phpClass("Trafic"), phpClass("Helper")] }),
      phpFile("/mc/Other.php", { classes: [phpClass("Other")] }),
      phpFile("/mc/procedural.php", { referencedNames: ["Trafic"] }),
      phpFile("/mc/tests/ZTest.php", { classes: [phpClass("ZTest", "PHPUnit\\Framework\\TestCase")], referencedNames: ["Helper", "ATest"] }),
      phpFile("/mc/tests/ATest.php", { classes: [phpClass("ATest", "TestCase")], referencedNames: ["Trafic", "Missing", "ATest"] }),
      phpFile("/mc/tests/NotATest.php", { classes: [phpClass("NotATest", "Base")], referencedNames: ["Other"] }),
    ];

    expect(phpTestReferrers(files)).toEqual({ "/mc/Trafic.php": ["/mc/tests/ATest.php", "/mc/tests/ZTest.php"] });
  });
});
