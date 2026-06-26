import { Router } from "express";

import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { getAuditDeps } from "../../../audit/presentation/http/createAuditDeps.js";
import { resolveAuditSnapshot } from "../../../audit/presentation/http/auditRequest.js";
import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import { SqlitePlanTaskStateRepository } from "../../infrastructure/persistence/SqlitePlanTaskStateRepository.js";
import { PlanController } from "../http/PlanController.js";

export function planApiRoutes(): Router {
  const router = Router();

  // Reusa las deps singleton del audit (mismo snapshot cache + scanners incrementales).
  // Plan consulta con module=null y sin php => comparte la entrada `laravel||` del cache,
  // asi que si el audit ya la cargo, el plan responde al instante (y viceversa).
  const auditDeps = getAuditDeps();

  const snapshots: AuditSnapshotProvider = {
    getSnapshot: (target) => resolveAuditSnapshot(auditDeps, target, null),
  };

  const controller = new PlanController({
    snapshots,
    repository: new SqlitePlanTaskStateRepository(createDrizzleDatabase(getSqliteDatabaseConnection())),
  });

  router.get("/plan.json", controller.show);
  router.get("/plan/tasks/:key/findings", controller.findings);
  router.post("/plan/tasks/:key", controller.update);

  return router;
}
