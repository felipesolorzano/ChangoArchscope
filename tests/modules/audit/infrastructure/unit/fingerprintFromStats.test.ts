import { describe, expect, it } from "vitest";

import { fingerprintFromStats } from "../../../../../app/modules/audit/infrastructure/cache/fingerprintFromStats.js";

const base = [
  { path: "a.php", mtimeMs: 1000, size: 50 },
  { path: "b.inc", mtimeMs: 2000, size: 80 },
];

describe("fingerprintFromStats", () => {
  it("es estable: misma entrada produce el mismo hash", () => {
    expect(fingerprintFromStats(base)).toBe(fingerprintFromStats(base));
  });

  it("es independiente del orden de entrada", () => {
    expect(fingerprintFromStats(base)).toBe(fingerprintFromStats([...base].reverse()));
  });

  it("cambia si cambia el mtime de algun archivo", () => {
    const changed = [{ ...base[0], mtimeMs: 1001 }, base[1]];
    expect(fingerprintFromStats(changed)).not.toBe(fingerprintFromStats(base));
  });

  it("cambia si cambia el size de algun archivo", () => {
    const changed = [{ ...base[0], size: 51 }, base[1]];
    expect(fingerprintFromStats(changed)).not.toBe(fingerprintFromStats(base));
  });

  it("cambia si cambia la ruta de algun archivo", () => {
    const changed = [{ ...base[0], path: "renamed.php" }, base[1]];
    expect(fingerprintFromStats(changed)).not.toBe(fingerprintFromStats(base));
  });

  it("cambia si se agrega o quita un archivo", () => {
    expect(fingerprintFromStats([base[0]])).not.toBe(fingerprintFromStats(base));
  });

  it("distingue conjuntos de archivos que concatenarian igual sin separador", () => {
    // Sin el separador "\n", estos dos colapsan a la misma cadena "a:1:2b:1:2" y colisionarian
    // (dos repos distintos con el mismo hash). El separador lo evita.
    const twoFiles = [
      { path: "a", mtimeMs: 1, size: 2 },
      { path: "b", mtimeMs: 1, size: 2 },
    ];
    const oneFile = [{ path: "a:1:2b", mtimeMs: 1, size: 2 }];

    expect(fingerprintFromStats(twoFiles)).not.toBe(fingerprintFromStats(oneFile));
  });

  it("una lista vacia produce un hash estable y no vacio", () => {
    expect(fingerprintFromStats([])).toBe(fingerprintFromStats([]));
    expect(fingerprintFromStats([])).toMatch(/^[0-9a-f]{40}$/);
  });
});
