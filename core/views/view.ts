import { renderAppLayout } from "./renderAppLayout.js";

export type ViewData = Record<string, unknown>;

export type ViewOptions = {
  title?: string;
  includeReactAssets?: boolean;
};

export function renderView(
  name: string,
  data: ViewData = {},
  options: ViewOptions = {},
) {
  return renderAppLayout({
    title: options.title,
    view: normalizeViewName(name),
    viewData: data,
    includeReactAssets: options.includeReactAssets ?? false,
  });
}

function normalizeViewName(name: string) {
  return name.replace("::", "/");
}
