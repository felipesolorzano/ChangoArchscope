import { fetchJson as defaultFetchJson } from "../registry/fetchJson.js";
// endoflife.date: ciclos de vida de un producto; 404 = producto desconocido.
export class EndOfLifeCalendar {
    fetchJson;
    constructor(fetchJson = defaultFetchJson) {
        this.fetchJson = fetchJson;
    }
    async fetch(product) {
        const url = `https://endoflife.date/api/${product}.json`;
        const { status, body } = await this.fetchJson(url);
        if (status === 404) {
            return null;
        }
        if (status < 200 || status >= 300) {
            throw new Error(`HTTP ${status} en ${url}`);
        }
        return body.map((cycle) => ({
            cycle: String(cycle.cycle),
            latest: cycle.latest ?? null,
            releaseDate: cycle.releaseDate ?? null,
            eol: cycle.eol,
            support: cycle.support ?? null,
        }));
    }
}
