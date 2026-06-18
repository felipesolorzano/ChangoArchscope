import type { ViewData, ViewOptions } from "../../views/view.js";

declare module "express-serve-static-core" {
  interface Response {
    view(name: string, data?: ViewData, options?: ViewOptions): Promise<void>;
  }
}
