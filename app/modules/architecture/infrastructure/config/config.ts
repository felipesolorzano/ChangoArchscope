import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

import type { ArchitectureConfig } from "../../domain/value-objects/ArchitectureConfig.js";
import { defaultConfig } from "./defaultConfig.js";

export const CONFIG_FILE = "chango-archscope.config.mjs";

/** Patron que agrega `ignoreHidden`: todo archivo o carpeta cuyo nombre empieza con `.`. */
export const HIDDEN_PATTERN = "**/.*";

export async function loadConfig(
  cwd: string = process.cwd(),
  explicitConfigPath: string | null = null,
): Promise<ArchitectureConfig> {
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

export function mergeConfig<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T | undefined) ?? base;
  }

  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key])
      ? mergeConfig(merged[key], value)
      : value;
  }

  return merged as T;
}

export function normalizeConfig(config: ArchitectureConfig, cwd: string): ArchitectureConfig {
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
function includeConstantsFrom(constants: Record<string, string>, modulesPath: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(constants).map(([name, value]) => [name, `${path.resolve(modulesPath, value)}${value.endsWith("/") ? "/" : ""}`]),
  );
}

// `ignoreHidden` (default true) se resuelve aca, asi todo lo que lee `ignoredPaths` lo respeta.
function withHidden(ignoredPaths: string[], ignoreHidden: boolean = true): string[] {
  return ignoreHidden && !ignoredPaths.includes(HIDDEN_PATTERN) ? [...ignoredPaths, HIDDEN_PATTERN] : ignoredPaths;
}

function detectProjectRoot(cwd: string): string {
  let current = path.resolve(cwd);

  while (true) {
    if (
      existsSync(path.join(current, "app/modules")) ||
      existsSync(path.join(current, "app/Modules")) ||
      existsSync(path.join(current, "resources/js/react/modules")) ||
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

function findConfigPath(projectRoot: string): string {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
