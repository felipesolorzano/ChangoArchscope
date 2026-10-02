import { normalizeVersion } from "./versioning.js";
const PACKAGE_SECTIONS = [
    ["dependencies", false],
    ["devDependencies", true],
    ["optionalDependencies", false],
];
const COMPOSER_SECTIONS = [
    ["require", false],
    ["require-dev", true],
];
const PLATFORM_PACKAGES = new Set(["php", "php-64bit", "hhvm", "composer", "composer-plugin-api", "composer-runtime-api"]);
export function parsePackageManifest(manifest, text, lockText) {
    const json = JSON.parse(text);
    const lock = parseLock(lockText);
    const installedOf = (name) => lock.packages?.[`node_modules/${name}`]?.version ?? lock.dependencies?.[name]?.version;
    return {
        dependencies: declared("npm", manifest, json, PACKAGE_SECTIONS, () => true, installedOf),
        runtime: { node: json.engines?.node, npm: json.engines?.npm, packageManager: json.packageManager },
    };
}
export function parseComposerManifest(manifest, text, lockText) {
    const json = JSON.parse(text);
    const lock = parseLock(lockText);
    const locked = [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])];
    const installedOf = (name) => locked.find((entry) => entry.name === name)?.version;
    return {
        dependencies: declared("composer", manifest, json, COMPOSER_SECTIONS, isComposerPackage, installedOf),
        runtime: { php: json.require?.php, platformPhp: json.config?.platform?.php },
    };
}
function isComposerPackage(name) {
    return !PLATFORM_PACKAGES.has(name) && !name.startsWith("ext-") && !name.startsWith("lib-");
}
function declared(ecosystem, manifest, json, sections, include, installedOf) {
    return sections.flatMap(([section, dev]) => Object.entries((json[section] ?? {}))
        .filter(([name]) => include(name))
        .map(([name, constraint]) => {
        const installed = installedOf(name);
        return { ecosystem, name, constraint, installed: typeof installed === "string" ? normalizeVersion(installed) : null, dev, manifest };
    }));
}
// Un lock ausente o ilegible no invalida el manifiesto: solo se pierde la version instalada.
function parseLock(lockText) {
    try {
        return lockText === null ? {} : JSON.parse(lockText);
    }
    catch {
        return {};
    }
}
