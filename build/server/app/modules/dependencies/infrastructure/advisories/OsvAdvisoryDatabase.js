import { fetchJson as defaultFetchJson } from "../registry/fetchJson.js";
import { mapOsvVulns, OSV_ECOSYSTEMS } from "./osvDocument.js";
const QUERY_URL = "https://api.osv.dev/v1/query";
// api.osv.dev: todas las vulns del paquete (siguiendo la paginacion), reducidas a ese paquete.
export class OsvAdvisoryDatabase {
    fetchJson;
    constructor(fetchJson = defaultFetchJson) {
        this.fetchJson = fetchJson;
    }
    async fetch(ecosystem, name) {
        const pkg = { name, ecosystem: OSV_ECOSYSTEMS[ecosystem] };
        // Stryker disable next-line ArrayDeclaration: una entrada basura se descarta al mapear (no es un affected del paquete), mutante equivalente.
        const vulns = [];
        let pageToken;
        do {
            const { status, body } = await this.fetchJson(QUERY_URL, { method: "POST", body: pageToken ? { package: pkg, page_token: pageToken } : { package: pkg } });
            if (status < 200 || status >= 300) {
                throw new Error(`HTTP ${status} en ${QUERY_URL}`);
            }
            const page = body;
            // Stryker disable next-line ArrayDeclaration: una entrada basura se descarta al mapear (no es un affected del paquete), mutante equivalente.
            vulns.push(...(page.vulns ?? []));
            pageToken = page.next_page_token;
        } while (pageToken);
        return mapOsvVulns(ecosystem, name, vulns);
    }
}
