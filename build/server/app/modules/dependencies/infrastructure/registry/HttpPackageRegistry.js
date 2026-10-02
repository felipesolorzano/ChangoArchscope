import { fetchJson as defaultFetchJson } from "./fetchJson.js";
import { mapNpmDocument } from "./npmDocument.js";
import { mapPackagistDocument } from "./packagistDocument.js";
// npm y Packagist por HTTP: 404 = el paquete no existe; otro status no exitoso es una falla.
export class HttpPackageRegistry {
    fetchJson;
    constructor(fetchJson = defaultFetchJson) {
        this.fetchJson = fetchJson;
    }
    async fetch(ecosystem, name) {
        const url = urlFor(ecosystem, name);
        const { status, body } = await this.fetchJson(url);
        if (status === 404) {
            return null;
        }
        if (status < 200 || status >= 300) {
            throw new Error(`HTTP ${status} en ${url}`);
        }
        return ecosystem === "npm" ? mapNpmDocument(name, body) : mapPackagistDocument(name.toLowerCase(), body);
    }
}
function urlFor(ecosystem, name) {
    return ecosystem === "npm"
        ? `https://registry.npmjs.org/${name.replace("/", "%2F")}`
        : `https://repo.packagist.org/p2/${name.toLowerCase()}.json`;
}
