import type { PackageRegistry } from "../../application/contracts/PackageRegistry.js";
import type { Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";
import { fetchJson as defaultFetchJson, type FetchJson } from "./fetchJson.js";
import { mapNpmDocument } from "./npmDocument.js";
import { mapPackagistDocument } from "./packagistDocument.js";

// npm y Packagist por HTTP: 404 = el paquete no existe; otro status no exitoso es una falla.
export class HttpPackageRegistry implements PackageRegistry {
  constructor(private readonly fetchJson: FetchJson = defaultFetchJson) {}

  async fetch(ecosystem: Ecosystem, name: string): Promise<PackageInfo | null> {
    const url = urlFor(ecosystem, name);
    const { status, body } = await this.fetchJson(url);

    if (status === 404) {
      return null;
    }
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} en ${url}`);
    }

    return ecosystem === "npm" ? mapNpmDocument(name, body as object) : mapPackagistDocument(name.toLowerCase(), body as object);
  }
}

function urlFor(ecosystem: Ecosystem, name: string): string {
  return ecosystem === "npm"
    ? `https://registry.npmjs.org/${name.replace("/", "%2F")}`
    : `https://repo.packagist.org/p2/${name.toLowerCase()}.json`;
}
