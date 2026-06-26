import { Router } from "express";

import { AuditController } from "../http/AuditController.js";
import { AuditGraphController } from "../http/AuditGraphController.js";
import { getAuditDeps } from "../http/createAuditDeps.js";

export function auditApiRoutes(): Router {
  const router = Router();

  const deps = getAuditDeps();
  const controller = new AuditController(deps);
  const graphController = new AuditGraphController(deps);

  router.get("/audit.json", controller.show);
  router.get("/audit-graph.json", graphController.show);

  return router;
}
