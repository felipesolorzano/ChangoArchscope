import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

import type { ArchitectureConfig } from "../../domain/value-objects/ArchitectureConfig.js";
import { defaultConfig } from "./defaultConfig.js";

export const CONFIG_FILE = "chango-archscope.config.mjs";

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

function normalizeConfig(config: ArchitectureConfig, cwd: string): ArchitectureConfig {
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
