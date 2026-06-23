import { describe, expect, it } from "vitest";

import { normalizeBoundedContextMap } from "../../../../../app/modules/migration/domain/services/normalizeBoundedContextMap.js";

describe("normalizeBoundedContextMap", () => {
  it("normaliza un mapa valido: completa las 4 capas y validated por defecto", () => {
    const map = normalizeBoundedContextMap({
      generatedAt: "2026-01-01T00:00:00.000Z",
      modules: [
        {
          key: "tours",
          name: "Tours",
          layers: { domain: [{ path: "Tours/Domain/Tour.php", note: "raiz" }] },
        },
      ],
    });

    expect(map.modules[0]).toEqual({
      key: "tours",
      name: "Tours",
      validated: false,
      layers: {
        domain: [{ path: "Tours/Domain/Tour.php", note: "raiz" }],
        application: [],
        infrastructure: [],
        presentation: [],
      },
    });
    expect(map.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("conserva description, validated y generatedBy cuando vienen", () => {
    const map = normalizeBoundedContextMap({
      generatedBy: "agente-x",
      modules: [{ key: "users", name: "Users", description: "cuentas", validated: true, layers: {} }],
    });

    expect(map.generatedBy).toBe("agente-x");
    expect(map.modules[0]).toMatchObject({ description: "cuentas", validated: true });
  });

  it("descarta archivos sin path string y notas no-string", () => {
    const map = normalizeBoundedContextMap({
      modules: [{ key: "a", name: "A", layers: { domain: [{ path: "ok.php" }, { note: "x" }, "bad", { path: 5 }] } }],
    });

    expect(map.modules[0].layers.domain).toEqual([{ path: "ok.php" }]);
  });

  it("modules vacio es valido (mapa vacio); genera generatedAt si falta", () => {
    const map = normalizeBoundedContextMap({ modules: [] });

    expect(map.modules).toEqual([]);
    expect(map.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("lanza si no es objeto, si modules no es arreglo, o si un modulo no tiene key/name", () => {
    expect(() => normalizeBoundedContextMap(null)).toThrow();
    expect(() => normalizeBoundedContextMap({ modules: "x" })).toThrow();
    expect(() => normalizeBoundedContextMap({ modules: [{ name: "SinKey", layers: {} }] })).toThrow(/key/);
    expect(() => normalizeBoundedContextMap({ modules: [{ key: "a", layers: {} }] })).toThrow(/name/);
  });
});
