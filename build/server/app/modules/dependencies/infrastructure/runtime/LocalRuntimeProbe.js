import { execFileSync } from "node:child_process";
import { normalizeVersion } from "../../domain/services/versioning.js";
const COMMANDS = {
    php: ["php", ["-r", "echo PHP_VERSION;"]],
    node: ["node", ["-v"]],
    npm: ["npm", ["-v"]],
};
const defaultExec = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 5000 });
// Pregunta su version a los binarios instalados; uno que no existe o falla no tumba la deteccion.
export class LocalRuntimeProbe {
    exec;
    constructor(exec = defaultExec) {
        this.exec = exec;
    }
    versionOf(kind) {
        const [command, args] = COMMANDS[kind];
        try {
            return normalizeVersion(this.exec(command, args));
        }
        catch {
            return null;
        }
    }
}
