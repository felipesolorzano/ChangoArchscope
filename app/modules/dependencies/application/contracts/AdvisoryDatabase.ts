import type { Ecosystem } from "../../domain/value-objects/Dependency.js";
import type { Advisory } from "../../domain/value-objects/Security.js";

/** Base de vulnerabilidades (OSV): todas las advisories del paquete; lanza si la consulta falla. */
export type AdvisoryDatabase = {
  fetch(ecosystem: Ecosystem, name: string): Promise<Advisory[]>;
};
