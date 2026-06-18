import { Edge } from "edge.js";
import { resolve } from "node:path";
import { getReactAssetReferences } from "./viteAssetManifest.js";
const viewsDirectory = resolve(process.cwd(), "resources/views");
const edge = Edge.create();
edge.mount(viewsDirectory);
export async function renderAppLayout(options = {}) {
    const includeReactAssets = options.includeReactAssets ?? true;
    const reactAssets = includeReactAssets
        ? getReactAssetReferences()
        : { entry: undefined, styles: [] };
    const pageContent = options.view === undefined
        ? undefined
        : await edge.render(options.view, options.viewData ?? {});
    return edge.render("layout/app", {
        title: options.title ?? "Architecture Toolkit",
        pageContent,
        reactEntry: reactAssets.entry,
        reactStyles: reactAssets.styles,
    });
}
