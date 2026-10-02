import type { SupportCalendar } from "../../application/contracts/SupportCalendar.js";
import type { SupportCycle } from "../../domain/value-objects/Security.js";
import { fetchJson as defaultFetchJson, type FetchJson } from "../registry/fetchJson.js";

type EndOfLifeCycle = { cycle: string | number; latest?: string; releaseDate?: string; eol: string | boolean; support?: string | boolean };

// endoflife.date: ciclos de vida de un producto; 404 = producto desconocido.
export class EndOfLifeCalendar implements SupportCalendar {
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  async fetch(product: string): Promise<SupportCycle[] | null> {
    const url = `https://endoflife.date/api/${product}.json`;
    const { status, body } = await this.fetchJson(url);

    if (status === 404) {
      return null;
    }
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} en ${url}`);
    }

    return (body as EndOfLifeCycle[]).map((cycle) => ({
      cycle: String(cycle.cycle),
      latest: cycle.latest ?? null,
      releaseDate: cycle.releaseDate ?? null,
      eol: cycle.eol,
      support: cycle.support ?? null,
    }));
  }
}
