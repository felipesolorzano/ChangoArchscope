import { Router } from "express";

import { buildArchitectureGraph } from "../../../architecture/application/buildArchitectureGraph.js";
import { resolveAuditSnapshot } from "../../../audit/presentation/http/auditRequest.js";
import { getAuditDeps } from "../../../audit/presentation/http/createAuditDeps.js";
import { CharacterizationController } from "../http/CharacterizationController.js";

export function characterizationApiRoutes(): Router {
  const router = Router();
  // Reusa las deps del audit: mismo snapshot cacheado que Auditoria y Plan.
  const auditDeps = getAuditDeps();
  const controller = new CharacterizationController({
    snapshots: { getSnapshot: (target) => resolveAuditSnapshot(auditDeps, target, null) },
    graphOf: (target) => buildArchitectureGraph(auditDeps.getConfig(), auditDeps.reader, { target }),
    rootOf: (target) => auditDeps.getConfig()[target].modulesPath,
  });

  router.get("/characterization.json", controller.show);

  return router;
}
