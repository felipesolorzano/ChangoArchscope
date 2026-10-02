import { describe, expect, it } from "vitest";

import { parseComposerManifest, parsePackageManifest } from "../../../../../app/modules/dependencies/domain/services/parseManifests.js";

const PKG = "/p/package.json";
const COMPOSER = "/p/composer.json";

const packageJson = JSON.stringify({
  dependencies: { react: "^16.13.1", jquery: "3.4.1" },
  devDependencies: { jest: "^24.9.0" },
  optionalDependencies: { fsevents: "^2.0.0" },
  engines: { node: ">=14", npm: ">=6" },
  packageManager: "npm@10.2.0",
});

describe("parsePackageManifest", () => {
  it("lista dependencies, devDependencies y optionalDependencies en ese orden, con su constraint", () => {
    const { dependencies } = parsePackageManifest(PKG, packageJson, null);

    expect(dependencies).toEqual([
      { ecosystem: "npm", name: "react", constraint: "^16.13.1", installed: null, dev: false, manifest: PKG },
      { ecosystem: "npm", name: "jquery", constraint: "3.4.1", installed: null, dev: false, manifest: PKG },
      { ecosystem: "npm", name: "jest", constraint: "^24.9.0", installed: null, dev: true, manifest: PKG },
      { ecosystem: "npm", name: "fsevents", constraint: "^2.0.0", installed: null, dev: false, manifest: PKG },
    ]);
  });

  it("toma installed del lock v2/v3 (packages) y del v1 (dependencies), normalizado", () => {
    const lockV3 = JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/react": { version: "16.14.0" } } });
    const lockV1 = JSON.stringify({ lockfileVersion: 1, dependencies: { react: { version: "v16.13.1" }, jest: { version: "24.9.0" } } });

    expect(parsePackageManifest(PKG, packageJson, lockV3).dependencies.map((d) => d.installed)).toEqual(["16.14.0", null, null, null]);
    expect(parsePackageManifest(PKG, packageJson, lockV1).dependencies.map((d) => d.installed)).toEqual(["16.13.1", null, "24.9.0", null]);
  });

  it("un lock invalido se ignora", () => {
    expect(parsePackageManifest(PKG, packageJson, "{nope").dependencies[0].installed).toBeNull();
  });

  it("devuelve las declaraciones de runtime crudas", () => {
    expect(parsePackageManifest(PKG, packageJson, null).runtime).toEqual({ node: ">=14", npm: ">=6", packageManager: "npm@10.2.0" });
    expect(parsePackageManifest(PKG, "{}", null)).toEqual({ dependencies: [], runtime: { node: undefined, npm: undefined, packageManager: undefined } });
  });

  it("JSON invalido en el manifiesto lanza", () => {
    expect(() => parsePackageManifest(PKG, "{nope", null)).toThrow();
  });
});

const composerJson = JSON.stringify({
  require: { php: ">=7.2", "ext-json": "*", "lib-icu": "*", "php-64bit": "*", hhvm: "*", composer: "*", "composer-plugin-api": "^2", "composer-runtime-api": "^2", "phpoffice/phpexcel": "^1.8" },
  "require-dev": { "phpunit/phpunit": "^8.5" },
  config: { platform: { php: "7.4.33" } },
});

describe("parseComposerManifest", () => {
  it("omite requisitos de plataforma y separa require / require-dev", () => {
    const { dependencies } = parseComposerManifest(COMPOSER, composerJson, null);

    expect(dependencies).toEqual([
      { ecosystem: "composer", name: "phpoffice/phpexcel", constraint: "^1.8", installed: null, dev: false, manifest: COMPOSER },
      { ecosystem: "composer", name: "phpunit/phpunit", constraint: "^8.5", installed: null, dev: true, manifest: COMPOSER },
    ]);
  });

  it("toma installed de packages y packages-dev del composer.lock, normalizado", () => {
    const lock = JSON.stringify({ packages: [{ name: "phpoffice/phpexcel", version: "1.8.2" }], "packages-dev": [{ name: "phpunit/phpunit", version: "v8.5.21" }] });

    expect(parseComposerManifest(COMPOSER, composerJson, lock).dependencies.map((d) => d.installed)).toEqual(["1.8.2", "8.5.21"]);
    expect(parseComposerManifest(COMPOSER, composerJson, "{nope").dependencies.map((d) => d.installed)).toEqual([null, null]);
  });

  it("devuelve require.php y config.platform.php crudos", () => {
    expect(parseComposerManifest(COMPOSER, composerJson, null).runtime).toEqual({ php: ">=7.2", platformPhp: "7.4.33" });
    expect(parseComposerManifest(COMPOSER, "{}", null)).toEqual({ dependencies: [], runtime: { php: undefined, platformPhp: undefined } });
    expect(parseComposerManifest(COMPOSER, JSON.stringify({ config: { "sort-packages": true } }), null).runtime.platformPhp).toBeUndefined();
  });

  it("JSON invalido en el manifiesto lanza", () => {
    expect(() => parseComposerManifest(COMPOSER, "{nope", null)).toThrow();
  });
});
