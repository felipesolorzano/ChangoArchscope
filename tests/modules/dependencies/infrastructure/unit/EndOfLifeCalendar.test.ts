import { describe, expect, it, vi } from "vitest";

import { EndOfLifeCalendar } from "../../../../../app/modules/dependencies/infrastructure/support/EndOfLifeCalendar.js";

describe("EndOfLifeCalendar", () => {
  it("pide el producto y mapea los ciclos (faltantes → null, cycle como string)", async () => {
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: [
        { cycle: "8.3", releaseDate: "2023-11-23", eol: "2027-12-31", latest: "8.3.35", support: "2025-12-31" },
        { cycle: 4, eol: false, support: true },
      ],
    }));

    const cycles = await new EndOfLifeCalendar(fetchJson).fetch("php");

    expect(fetchJson).toHaveBeenCalledWith("https://endoflife.date/api/php.json");
    expect(cycles).toEqual([
      { cycle: "8.3", latest: "8.3.35", releaseDate: "2023-11-23", eol: "2027-12-31", support: "2025-12-31" },
      { cycle: "4", latest: null, releaseDate: null, eol: false, support: true },
    ]);
  });

  it("404 → null; otro error lanza; support ausente → null", async () => {
    await expect(new EndOfLifeCalendar(async () => ({ status: 404, body: null })).fetch("nope")).resolves.toBeNull();
    await expect(new EndOfLifeCalendar(async () => ({ status: 500, body: null })).fetch("php")).rejects.toThrow("HTTP 500 en https://endoflife.date/api/php.json");
    await expect(new EndOfLifeCalendar(async () => ({ status: 300, body: null })).fetch("php")).rejects.toThrow("HTTP 300");
    await expect(new EndOfLifeCalendar(async () => ({ status: 199, body: null })).fetch("php")).rejects.toThrow("HTTP 199");
    await expect(new EndOfLifeCalendar(async () => ({ status: 200, body: [{ cycle: "1", eol: true }] })).fetch("x")).resolves.toEqual([
      { cycle: "1", latest: null, releaseDate: null, eol: true, support: null },
    ]);
  });
});
