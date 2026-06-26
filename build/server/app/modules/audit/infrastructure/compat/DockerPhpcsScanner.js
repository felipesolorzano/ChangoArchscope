import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parsePhpcsReport } from "./parsePhpcsReport.js";
import { phpcsExtensionsArg } from "./phpcsExtensionsArg.js";
const run = promisify(execFile);
const DEFAULT_IMAGE = "chango/php-compat:1";
const REPORT_FILE = "php-compatibility.json";
/**
 * Adapter del puerto PhpCompatibilityScanner. Unica pieza que conoce Docker y
 * el formato JSON de phpcs. Traduce cualquier fallo de entorno a `unavailable`
 * en vez de lanzar, para no tumbar el resto del audit.
 */
export class DockerPhpcsScanner {
    image;
    dockerfileDir;
    timeoutMs;
    constructor(options) {
        this.image = options.image ?? DEFAULT_IMAGE;
        this.dockerfileDir = options.dockerfileDir;
        this.timeoutMs = options.timeoutMs ?? 600_000;
    }
    async scan(repoPath, targetPhp, extensions) {
        if (!(await this.dockerAvailable())) {
            return { status: "unavailable", reason: "Docker no esta disponible" };
        }
        if (!(await this.ensureImage())) {
            return { status: "unavailable", reason: `No se pudo construir la imagen ${this.image}` };
        }
        let outDir = null;
        try {
            outDir = await mkdtemp(join(tmpdir(), "chango-phpcompat-"));
            await this.runScan(repoPath, targetPhp, phpcsExtensionsArg(extensions), outDir);
            const report = await readFile(join(outDir, REPORT_FILE), "utf8");
            // Ruta absoluta (como los findings nativos) para que el mismo archivo no quede dividido
            // en dos entradas (relativa vs absoluta) en el riskBreakdown.
            const issues = parsePhpcsReport(JSON.parse(report)).map((issue) => ({ ...issue, file: join(repoPath, issue.file) }));
            return { status: "ok", targetPhp, issues };
        }
        catch (error) {
            return { status: "unavailable", reason: reason(error) };
        }
        finally {
            if (outDir !== null)
                await rm(outDir, { recursive: true, force: true });
        }
    }
    async dockerAvailable() {
        try {
            await run("docker", ["--version"]);
            return true;
        }
        catch {
            return false;
        }
    }
    async ensureImage() {
        try {
            await run("docker", ["image", "inspect", this.image]);
            return true;
        }
        catch {
            // No existe localmente: intentar construirla.
        }
        try {
            await run("docker", ["build", "-t", this.image, this.dockerfileDir], { timeout: this.timeoutMs });
            return true;
        }
        catch {
            return false;
        }
    }
    async runScan(repoPath, targetPhp, extensions, outDir) {
        // phpcs sale con codigo != 0 cuando encuentra hallazgos; eso es exito, no error.
        // La verdad la da el archivo de reporte: si se escribio, el scan corrio.
        await run("docker", [
            "run", "--rm",
            "-v", `${repoPath}:/repo:ro`,
            "-v", `${outDir}:/output`,
            this.image,
            // memory_limit alto: el default de PHP (128M) se agota en repos legacy grandes
            // (miles de archivos) y phpcs muere con fatal, dejando el reporte truncado.
            "-d", "memory_limit=1024M",
            "--standard=PHPCompatibility",
            "--runtime-set", "testVersion", targetPhp,
            `--extensions=${extensions}`,
            "--report=json",
            `--report-file=/output/${REPORT_FILE}`,
            "/repo",
        ], { timeout: this.timeoutMs, maxBuffer: 64 * 1024 * 1024 }).catch(() => {
            // Ignorar el codigo de salida; runScan se valida leyendo el reporte.
        });
    }
}
function reason(error) {
    return error instanceof Error ? error.message : "Fallo el scan de compatibilidad";
}
