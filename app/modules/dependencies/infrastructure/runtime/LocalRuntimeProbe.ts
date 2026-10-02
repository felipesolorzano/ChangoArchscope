import { execFileSync } from "node:child_process";

import type { RuntimeProbe } from "../../application/contracts/RuntimeProbe.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import type { RuntimeKind } from "../../domain/value-objects/Dependency.js";

export type Exec = (command: string, args: string[]) => string;

const COMMANDS: Record<RuntimeKind, [string, string[]]> = {
  php: ["php", ["-r", "echo PHP_VERSION;"]],
  node: ["node", ["-v"]],
  npm: ["npm", ["-v"]],
};

const defaultExec: Exec = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 5000 });

// Pregunta su version a los binarios instalados; uno que no existe o falla no tumba la deteccion.
export class LocalRuntimeProbe implements RuntimeProbe {
  constructor(private readonly exec: Exec = defaultExec) {}

  versionOf(kind: RuntimeKind): string | null {
    const [command, args] = COMMANDS[kind];

    try {
      return normalizeVersion(this.exec(command, args));
    } catch {
      return null;
    }
  }
}
