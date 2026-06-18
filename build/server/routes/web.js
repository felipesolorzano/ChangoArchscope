import { Router } from "express";
import { coreWebRoutes } from "../core/routes/web.js";
import { architectureWebRoutes } from "../app/modules/architecture/presentation/routes/web.js";
export function webRoutes() {
    const router = Router();
    router.use(architectureWebRoutes());
    router.use(coreWebRoutes());
    return router;
}
