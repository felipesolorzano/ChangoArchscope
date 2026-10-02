import { describe, expect, it } from "vitest";

import { detectRuntimes } from "../../../../../app/modules/dependencies/domain/services/detectRuntimes.js";
import type { RuntimeKind } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";

const LOCAL: Record<RuntimeKind, string | null> = { php: "8.3.6", node: "v23.6.0", npm: "10.9.2" };
const probe = (kind: RuntimeKind) => LOCAL[kind];
const none = () => null;
const ALL: RuntimeKind[] = ["php", "node", "npm"];
const empty = { composer: null, npm: null, nodeVersionFile: null };

describe("detectRuntimes", () => {
  it("sin declaraciones usa el binario local, en orden php/node/npm y normalizado", () => {
    expect(detectRuntimes(empty, ALL, probe)).toEqual([
      { kind: "php", version: "8.3.6", source: "local" },
      { kind: "node", version: "23.6.0", source: "local" },
      { kind: "npm", version: "10.9.2", source: "local" },
    ]);
  });

  it("solo devuelve los kinds pedidos, en ese orden, y marca desconocido sin probe", () => {
    expect(detectRuntimes(empty, ["npm", "php"], none)).toEqual([
      { kind: "npm", version: null, source: "desconocido" },
      { kind: "php", version: null, source: "desconocido" },
    ]);
    expect(detectRuntimes({}, ["node"], probe)).toEqual([{ kind: "node", version: "23.6.0", source: "local" }]);
  });

  it("php: config.platform.php gana a require.php, que gana al local", () => {
    expect(detectRuntimes({ ...empty, composer: { php: ">=7.2", platformPhp: "7.4.33" } }, ["php"], probe)).toEqual([
      { kind: "php", version: "7.4.33", source: "composer.json config.platform.php" },
    ]);
    expect(detectRuntimes({ ...empty, composer: { php: "^7.2|^8.0" } }, ["php"], probe)).toEqual([
      { kind: "php", version: "7.2.0", source: "composer.json require.php" },
    ]);
    expect(detectRuntimes({ ...empty, composer: {} }, ["php"], probe)[0].source).toBe("local");
  });

  it("node: .nvmrc/.node-version gana a engines.node; alias como lts/* no cuentan", () => {
    const npm = { node: ">=14.17" };

    expect(detectRuntimes({ ...empty, npm, nodeVersionFile: { name: ".nvmrc", text: "v16.20.2\n" } }, ["node"], probe)).toEqual([
      { kind: "node", version: "16.20.2", source: ".nvmrc" },
    ]);
    expect(detectRuntimes({ ...empty, npm, nodeVersionFile: { name: ".node-version", text: "18" } }, ["node"], probe)[0]).toEqual(
      { kind: "node", version: "18.0.0", source: ".node-version" },
    );
    expect(detectRuntimes({ ...empty, npm, nodeVersionFile: { name: ".nvmrc", text: "lts/*" } }, ["node"], probe)[0]).toEqual(
      { kind: "node", version: "14.17.0", source: "package.json engines.node" },
    );
    expect(detectRuntimes({ ...empty, npm: {} }, ["node"], probe)[0].source).toBe("local");
  });

  it("npm: packageManager npm@ gana a engines.npm; otro gestor no cuenta", () => {
    expect(detectRuntimes({ ...empty, npm: { npm: ">=8", packageManager: "npm@10.2.0" } }, ["npm"], probe)).toEqual([
      { kind: "npm", version: "10.2.0", source: "package.json packageManager" },
    ]);
    expect(detectRuntimes({ ...empty, npm: { npm: ">=8", packageManager: "yarn@4.0.0" } }, ["npm"], probe)[0]).toEqual(
      { kind: "npm", version: "8.0.0", source: "package.json engines.npm" },
    );
    expect(detectRuntimes({ ...empty, npm: { packageManager: "yarn@4.0.0" } }, ["npm"], probe)[0].source).toBe("local");
    expect(detectRuntimes({ ...empty, npm: { packageManager: "pnpm@8.0.0" } }, ["npm"], probe)[0].source).toBe("local");
  });

  it("una declaracion invalida cae al siguiente origen", () => {
    expect(detectRuntimes({ ...empty, composer: { platformPhp: "x", php: "not a range !!" } }, ["php"], probe)[0]).toEqual(
      { kind: "php", version: "8.3.6", source: "local" },
    );
  });
});
