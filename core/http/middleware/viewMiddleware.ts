import type { NextFunction, Request, Response } from "express";

import { renderView, type ViewData, type ViewOptions } from "../../views/view.js";

export function viewMiddleware() {
  return (_request: Request, response: Response, next: NextFunction) => {
    response.view = async (name: string, data: ViewData = {}, options: ViewOptions = {}) => {
      response.type("html").send(await renderView(name, data, options));
    };

    next();
  };
}
