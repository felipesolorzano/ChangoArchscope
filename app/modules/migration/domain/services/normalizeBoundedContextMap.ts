import {
  LAYER_KEYS,
  type BoundedContextFile,
  type BoundedContextLayers,
  type BoundedContextMap,
  type BoundedContextModule,
} from "../value-objects/BoundedContextMap.js";

// Valida y normaliza un mapa arbitrario (lo que manda el agente) a un BoundedContextMap limpio:
// garantiza las 4 capas, `validated` por defecto, y descarta archivos mal formados. Lanza si la
// estructura base es invalida (no objeto, `modules` no arreglo, o un modulo sin key/name).
export function normalizeBoundedContextMap(input: unknown): BoundedContextMap {
  if (!isObject(input)) {
    throw new Error("El mapa debe ser un objeto.");
  }

  if (!Array.isArray(input.modules)) {
    throw new Error("El mapa debe tener un arreglo `modules`.");
  }

  return {
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : new Date().toISOString(),
    ...(typeof input.generatedBy === "string" ? { generatedBy: input.generatedBy } : {}),
    modules: input.modules.map(normalizeModule),
  };
}

function normalizeModule(input: unknown): BoundedContextModule {
  if (!isObject(input) || typeof input.key !== "string" || input.key.length === 0) {
    throw new Error("Cada modulo necesita un `key` string no vacio.");
  }
  if (typeof input.name !== "string" || input.name.length === 0) {
    throw new Error("Cada modulo necesita un `name` string no vacio.");
  }

  return {
    key: input.key,
    name: input.name,
    ...(typeof input.description === "string" ? { description: input.description } : {}),
    validated: input.validated === true,
    layers: normalizeLayers(input.layers),
  };
}

function normalizeLayers(input: unknown): BoundedContextLayers {
  const source = isObject(input) ? input : {};

  return Object.fromEntries(
    LAYER_KEYS.map((layer) => [layer, normalizeFiles(source[layer])]),
  ) as BoundedContextLayers;
}

function normalizeFiles(input: unknown): BoundedContextFile[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((file): file is Record<string, unknown> => isObject(file) && typeof file.path === "string")
    .map((file) => ({ path: file.path as string, ...(typeof file.note === "string" ? { note: file.note } : {}) }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
