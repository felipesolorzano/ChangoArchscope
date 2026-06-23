import { Router } from "express";

import { coreWebRoutes } from "../core/routes/web.js";
import { architectureWebRoutes } from "../app/modules/architecture/presentation/routes/web.js";
import { auditApiRoutes } from "../app/modules/audit/presentation/routes/api.js";
import { planApiRoutes } from "../app/modules/plan/presentation/routes/api.js";
import { migrationApiRoutes } from "../app/modules/migration/presentation/routes/api.js";

export function webRoutes(): Router {
  const router = Router();

  router.use(architectureWebRoutes());
  // Las rutas JSON del proyecto (/graph.json, /check.json, /audit.json, /audit-graph.json,
  // /plan.json, /migration.json) responden en la raiz, no bajo /api, para consistencia con la UI.
  router.use(auditApiRoutes());
  router.use(planApiRoutes());
  router.use(migrationApiRoutes());
  router.use(coreWebRoutes());

  return router;
}
