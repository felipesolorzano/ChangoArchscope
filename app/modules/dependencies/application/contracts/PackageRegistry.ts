import type { Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";

/** Registro publico de paquetes (npm, Packagist). null = no existe; lanza si la consulta falla. */
export type PackageRegistry = {
  fetch(ecosystem: Ecosystem, name: string): Promise<PackageInfo | null>;
};
