import { renderAppLayout } from "./renderAppLayout.js";
export function renderView(name, data = {}, options = {}) {
    return renderAppLayout({
        title: options.title,
        view: normalizeViewName(name),
        viewData: data,
        includeReactAssets: options.includeReactAssets ?? false,
    });
}
function normalizeViewName(name) {
    return name.replace("::", "/");
}
