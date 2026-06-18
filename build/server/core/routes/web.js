import { Router } from "express";
import { renderAppLayout } from "../views/renderAppLayout.js";
export function coreWebRoutes() {
    const router = Router();
    router.get("/", async (_request, response, next) => {
        try {
            response.type("html").send(await renderAppLayout());
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
