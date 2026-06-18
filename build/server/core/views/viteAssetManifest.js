import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const defaultManifestPath = resolve(process.cwd(), "public/build/.vite/manifest.json");
const reactEntryName = "modules/app/presentation/main.tsx";
export function getReactAssetReferences(manifestPath = defaultManifestPath) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = manifest[reactEntryName];
    if (entry === undefined) {
        throw new Error(`React entry "${reactEntryName}" was not found in the Vite manifest.`);
    }
    return {
        entry: `/build/${entry.file}`,
        styles: (entry.css ?? []).map((style) => `/build/${style}`),
    };
}
