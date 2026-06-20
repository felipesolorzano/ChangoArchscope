import { Router } from "express";

import { checkArchitecture } from "../../../architecture/application/checkArchitecture.js";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { PhpAstParser } from "../../../audit/infrastructure/parser/PhpAstParser.js";
import { resolveAuditSnapshot, type AuditControllerDeps } from "../../../audit/presentation/http/auditRequest.js";
import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import { SqlitePlanTaskStateRepository } from "../../infrastructure/persistence/SqlitePlanTaskStateRepository.js";
import { PlanController } from "../http/PlanController.js";

export function planApiRoutes(): Router {
  const router = Router();

  const auditDeps: AuditControllerDeps = {
    getConfig: getArchitectureConfig,
    reader: new NodeFsSourceTreeReader(),
    parser: new PhpAstParser(),
    check: checkArchitecture,
  };

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
