import type { Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";

export type CachedPackageInfo = { info: PackageInfo | null; fetchedAt: string };

/** Lo ultimo que respondio el registro por paquete (incluye "no existe" como info null). */
export type PackageInfoCache = {
  get(ecosystem: Ecosystem, name: string): CachedPackageInfo | null;
  set(ecosystem: Ecosystem, name: string, info: PackageInfo | null, fetchedAt: string): void;
};
