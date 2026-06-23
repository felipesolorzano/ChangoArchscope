import type { MapProvider } from "../../application/contracts/MapProvider";
import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap";

async function readJson(response: Response, message: string): Promise<BoundedContextMap> {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }
  return response.json();
}

export class HttpMapProvider implements MapProvider {
  constructor(private readonly mapUrl: string, private readonly target: string = "laravel") {}

  async getMap(): Promise<BoundedContextMap> {
    const url = new URL(`${this.mapUrl}.json`, window.location.origin);
    url.searchParams.set("target", this.target);

    return readJson(await fetch(url.toString(), { headers: { Accept: "application/json" } }), "No se pudo cargar el mapa");
  }

  async saveMap(map: BoundedContextMap): Promise<BoundedContextMap> {
    const url = new URL(this.mapUrl, window.location.origin);
    url.searchParams.set("target", this.target);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(map),
    });

    return readJson(response, "No se pudo guardar el mapa");
  }
}
