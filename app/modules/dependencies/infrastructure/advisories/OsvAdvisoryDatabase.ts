import type { AdvisoryDatabase } from "../../application/contracts/AdvisoryDatabase.js";
import type { Ecosystem } from "../../domain/value-objects/Dependency.js";
import type { Advisory } from "../../domain/value-objects/Security.js";
import { fetchJson as defaultFetchJson, type FetchJson } from "../registry/fetchJson.js";
import { mapOsvVulns, OSV_ECOSYSTEMS, type OsvVuln } from "./osvDocument.js";

const QUERY_URL = "https://api.osv.dev/v1/query";

type OsvPage = { vulns?: OsvVuln[]; next_page_token?: string };

// api.osv.dev: todas las vulns del paquete (siguiendo la paginacion), reducidas a ese paquete.
export class OsvAdvisoryDatabase implements AdvisoryDatabase {
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  async fetch(ecosystem: Ecosystem, name: string): Promise<Advisory[]> {
    const pkg = { name, ecosystem: OSV_ECOSYSTEMS[ecosystem] };
    // Stryker disable next-line ArrayDeclaration: una entrada basura se descarta al mapear (no es un affected del paquete), mutante equivalente.
    const vulns: OsvVuln[] = [];
    let pageToken: string | undefined;

    do {
      const { status, body } = await this.fetchJson(QUERY_URL, { method: "POST", body: pageToken ? { package: pkg, page_token: pageToken } : { package: pkg } });
      if (status < 200 || status >= 300) {
        throw new Error(`HTTP ${status} en ${QUERY_URL}`);
      }
      const page = body as OsvPage;
      // Stryker disable next-line ArrayDeclaration: una entrada basura se descarta al mapear (no es un affected del paquete), mutante equivalente.
      vulns.push(...(page.vulns ?? []));
      pageToken = page.next_page_token;
    } while (pageToken);

    return mapOsvVulns(ecosystem, name, vulns);
  }
}
