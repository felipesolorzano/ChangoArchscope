import express from "express";
import { resolve } from "node:path";
import { formatHttpError } from "../../app/modules/shared/presentation/http/formatHttpError.js";
import { viewMiddleware } from "./middleware/viewMiddleware.js";
export function createHttpApp(routes) {
    const app = express();
    app.use(express.json());
    app.use(express.static(resolve(process.cwd(), "public")));
    app.use(viewMiddleware());
    app.use(routes.web);
    app.use("/api", routes.api);
    app.use((error, _request, response, _next) => {
        response.status(400).json({
            error: formatHttpError(error),
        });
    });
    return app;
}
