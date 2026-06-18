import express from "express";
import { resolve } from "node:path";
import type { Router } from "express";

import { formatHttpError } from "../../app/modules/shared/presentation/http/formatHttpError.js";
import { viewMiddleware } from "./middleware/viewMiddleware.js";

type HttpAppRoutes = {
  api: Router;
  web: Router;
};

export function createHttpApp(routes: HttpAppRoutes) {
  const app = express();

  app.use(express.json());
  app.use(express.static(resolve(process.cwd(), "public")));
  app.use(viewMiddleware());
  app.use(routes.web);
  app.use("/api", routes.api);
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      response.status(400).json({
        error: formatHttpError(error),
      });
    },
  );

  return app;
}
