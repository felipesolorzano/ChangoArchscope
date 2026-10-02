import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { defaultConfig } from "./defaultConfig.js";
export const CONFIG_FILE = "chango-archscope.config.mjs";
/** Patron que agrega `ignoreHidden`: todo archivo o carpeta cuyo nombre empieza con `.`. */
export const HIDDEN_PATTERN = "**/.*";
export async function loadConfig(cwd = process.cwd(), explicitConfigPath = null) {
    const projectRoot = explicitConfigPath ? cwd : detectProjectRoot(cwd);
    const configPath = explicitConfigPath
        ? path.resolve(cwd, explicitConfigPath)
        : findConfigPath(projectRoot);
    if (!existsSync(configPath)) {
        return normalizeConfig(defaultConfig, projectRoot);
    }
    const userConfigModule = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    const userConfig = userConfigModule.default ?? userConfigModule;
    return normalizeConfig(mergeConfig(defaultConfig, userConfig), path.dirname(configPath));
}
export function mergeConfig(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override ?? base;
    }
    const merged = { ...base };
    for (const [key, value] of Object.entries(override)) {
        merged[key] = isPlainObject(value) && isPlainObject(merged[key])
            ? mergeConfig(merged[key], value)
            : value;
    }
    return merged;
}
export function normalizeConfig(config, cwd) {
    return {
        ...config,
        laravel: {
            ...config.laravel,
            modulesPath: path.resolve(cwd, config.laravel.modulesPath),
            ignoredPaths: withHidden(config.laravel.ignoredPaths, config.laravel.ignoreHidden),
            includeConstants: includeConstantsFrom(config.laravel.includeConstants ?? {}, path.resolve(cwd, config.laravel.modulesPath)),
            includePaths: (config.laravel.includePaths ?? []).map((includePath) => path.resolve(cwd, includePath)),
        },
        react: {
            ...config.react,
            modulesPath: path.resolve(cwd, config.react.modulesPath),
            ignoredPaths: withHidden(config.react.ignoredPaths, config.react.ignoreHidden),
            testPaths: (config.react.testPaths ?? []).map((testPath) => path.resolve(cwd, testPath)),
        },
    };
}
// Constantes de include relativas a modulesPath → absolutas, conservando la "/" final (se concatenan).
function includeConstantsFrom(constants, modulesPath) {
    return Object.fromEntries(Object.entries(constants).map(([name, value]) => [name, `${path.resolve(modulesPath, value)}${value.endsWith("/") ? "/" : ""}`]));
}
// `ignoreHidden` (default true) se resuelve aca, asi todo lo que lee `ignoredPaths` lo respeta.
function withHidden(ignoredPaths, ignoreHidden = true) {
    return ignoreHidden && !ignoredPaths.includes(HIDDEN_PATTERN) ? [...ignoredPaths, HIDDEN_PATTERN] : ignoredPaths;
}
function detectProjectRoot(cwd) {
    let current = path.resolve(cwd);
    while (true) {
        if (existsSync(path.join(current, "app/modules")) ||
            existsSync(path.join(current, "app/Modules")) ||
            existsSync(path.join(current, "resources/js/react/modules")) ||
            existsSync(path.join(current, CONFIG_FILE))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return path.resolve(cwd);
        }
        current = parent;
    }
}
function findConfigPath(projectRoot) {
    let current = path.resolve(projectRoot);
    while (true) {
        const configPath = path.join(current, CONFIG_FILE);
        if (existsSync(configPath)) {
            return configPath;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return path.join(projectRoot, CONFIG_FILE);
        }
        current = parent;
    }
}
function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
