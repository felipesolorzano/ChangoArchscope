import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { defaultConfig } from "./defaultConfig.mjs";

export const CONFIG_FILE = "chango-archscope.config.mjs";

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
    merged[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeConfig(base[key], value)
      : value;
  }

  return merged;
}

function normalizeConfig(config, cwd) {
  return {
    ...config,
    laravel: {
      ...config.laravel,
      modulesPath: path.resolve(cwd, config.laravel.modulesPath),
    },
    react: {
      ...config.react,
      modulesPath: path.resolve(cwd, config.react.modulesPath),
    },
  };
}

function detectProjectRoot(cwd) {
  let current = path.resolve(cwd);

  while (true) {
    if (
      existsSync(path.join(current, "app/Modules")) ||
      existsSync(path.join(current, "resources/js/react/src/modules")) ||
      existsSync(path.join(current, CONFIG_FILE))
    ) {
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
