import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultManifestPath = resolve(process.cwd(), "public/build/.vite/manifest.json");
const reactEntryName = "modules/app/presentation/main.tsx";

type ViteManifestEntry = {
  file: string;
  css?: string[];
};

type ViteManifest = Record<string, ViteManifestEntry>;

export type ReactAssetReferences = {
  entry: string;
  styles: string[];
};

export function getReactAssetReferences(manifestPath = defaultManifestPath): ReactAssetReferences {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ViteManifest;
  const entry = manifest[reactEntryName];

  if (entry === undefined) {
    throw new Error(`React entry "${reactEntryName}" was not found in the Vite manifest.`);
  }

  return {
    entry: `/build/${entry.file}`,
    styles: (entry.css ?? []).map((style) => `/build/${style}`),
  };
}
