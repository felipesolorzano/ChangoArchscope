import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { diffFileStats } from "./diffFileStats.js";
import { parsePhpcsReportByFile } from "./parsePhpcsReport.js";
import { phpcsExtensionsArg } from "./phpcsExtensionsArg.js";
const run = promisify(execFile);
const DEFAULT_IMAGE = "chango/php-compat:1";
const REPORT_FILE = "php-compatibility.json";
// Si cambian mas archivos que esto de golpe, conviene un scan completo del directorio en vez
// de pasar miles de paths como args (riesgo de ARG_MAX) y muchos contenedores.
const FULL_RESCAN_THRESHOLD = 200;
/**
 * Scanner de compatibilidad incremental: mantiene resultados por-archivo y solo vuelve a
 * correr phpcs sobre los archivos que cambiaron (mtime/size). Implementa el mismo puerto que
 * DockerPhpcsScanner. Unica pieza con I/O; excluida de Stryker. La logica pura (diff, parseo)
 * vive en diffFileStats/parsePhpcsReportByFile.
 */
export class IncrementalDockerPhpcsScanner {
    image;
    dockerfileDir;
    reader;
    timeoutMs;
    caches = new Map();
    constructor(options) {
        this.image = options.image ?? DEFAULT_IMAGE;
        this.dockerfileDir = options.dockerfileDir;
        this.reader = options.reader;
        this.timeoutMs = options.timeoutMs ?? 600_000;
    }
    async scan(repoPath, targetPhp, extensions) {
        if (!(await this.dockerAvailable())) {
            return { status: "unavailable", reason: "Docker no esta disponible" };
        }
        if (!(await this.ensureImage())) {
            return { status: "unavailable", reason: `No se pudo construir la imagen ${this.image}` };
        }
        // Llave por (repoPath, targetPhp): las reglas cambian entre versiones y las rutas
        // relativas dependen del repo. Sin repoPath, cambiar de modulesPath contamina el cache.
        const cacheKey = `${repoPath}|${targetPhp}`;
        const current = this.statFiles(repoPath, extensions);
        const cache = this.caches.get(cacheKey) ?? new Map();
        const cold = cache.size === 0;
        const cachedStats = new Map([...cache].map(([path, entry]) => [path, { mtimeMs: entry.mtimeMs, size: entry.size }]));
        const { changed, deleted } = diffFileStats(cachedStats, current);
        for (const path of deleted) {
            cache.delete(path);
        }
        try {
            if (changed.length > 0) {
                const full = cold || changed.length > FULL_RESCAN_THRESHOLD;
                const byFile = await this.runPhpcs(repoPath, targetPhp, extensions, full ? null : changed);
                const currentByPath = new Map(current.map((file) => [file.path, file]));
                const rescanned = full ? current.map((file) => file.path) : changed;
                for (const path of rescanned) {
                    const file = currentByPath.get(path);
                    if (file !== undefined) {
                        // Ruta ABSOLUTA en el issue, igual que los findings nativos (que vienen de
                        // walkFiles con rutas absolutas). Si no, el riskBreakdown trata al mismo archivo
                        // como dos entradas distintas (relativa vs absoluta) y los hallazgos de compat
                        // no se mezclan con los nativos del archivo.
                        const absolute = join(repoPath, path);
                        const issues = (byFile.get(path) ?? []).map((issue) => ({ ...issue, file: absolute }));
                        cache.set(path, { mtimeMs: file.mtimeMs, size: file.size, issues });
                    }
                }
            }
        }
        catch (error) {
            return { status: "unavailable", reason: reason(error) };
        }
        this.caches.set(cacheKey, cache);
        const issues = [...cache.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([, entry]) => entry.issues);
        return { status: "ok", targetPhp, issues };
    }
    statFiles(repoPath, extensions) {
        const stats = [];
        for (const file of this.reader.walkFiles(repoPath, extensions, [])) {
            try {
                const info = statSync(file);
                stats.push({ path: relative(repoPath, file), mtimeMs: info.mtimeMs, size: info.size });
            }
            catch {
                // archivo desaparecido entre walk y stat: se omite.
            }
        }
        return stats;
    }
    // Corre phpcs (sobre el repo entero si `files` es null, o sobre esos archivos) y devuelve
    // el reporte agrupado por archivo. phpcs sale != 0 cuando hay hallazgos; lo valida el reporte.
    async runPhpcs(repoPath, targetPhp, extensions, files) {
        const outDir = await mkdtemp(join(tmpdir(), "chango-phpcompat-"));
        const targets = files === null ? ["/repo"] : files.map((file) => `/repo/${file}`);
        try {
            await run("docker", [
                "run", "--rm",
                "-v", `${repoPath}:/repo:ro`,
                "-v", `${outDir}:/output`,
                this.image,
                "-d", "memory_limit=1024M",
                "--standard=PHPCompatibility",
                "--runtime-set", "testVersion", targetPhp,
                `--extensions=${phpcsExtensionsArg(extensions)}`,
                "--report=json",
                `--report-file=/output/${REPORT_FILE}`,
                ...targets,
            ], { timeout: this.timeoutMs, maxBuffer: 64 * 1024 * 1024 }).catch(() => {
                // Ignorar el codigo de salida; se valida leyendo el reporte.
            });
            const report = await readFile(join(outDir, REPORT_FILE), "utf8");
            return parsePhpcsReportByFile(JSON.parse(report));
        }
        finally {
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
}
function reason(error) {
    return error instanceof Error ? error.message : "Fallo el scan de compatibilidad";
}
