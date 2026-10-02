import type { RuntimeKind } from "../../domain/value-objects/Dependency.js";

/** Version del runtime instalado en la maquina (php, node, npm); null si no esta o no responde. */
export type RuntimeProbe = {
  versionOf(kind: RuntimeKind): string | null;
};
