import { Router } from "express";
import { coreWebRoutes } from "../core/routes/web.js";
import { architectureWebRoutes } from "../app/modules/architecture/presentation/routes/web.js";
import { auditApiRoutes } from "../app/modules/audit/presentation/routes/api.js";
export function webRoutes() {
    const router = Router();
    router.use(architectureWebRoutes());
    // Las rutas JSON del proyecto (/graph.json, /check.json, /audit.json) responden en la
    // raiz, no bajo /api, para mantener consistencia con la UI React existente.
    router.use(auditApiRoutes());
    router.use(coreWebRoutes());
    return router;
}
