import { Router } from "express";

import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { getAuditDeps } from "../../../audit/presentation/http/createAuditDeps.js";
import { generateDependencyReport } from "../../../dependencies/application/use-cases/generateDependencyReport.js";
import { getDependencyReportDeps } from "../../../dependencies/presentation/http/createDependencyReportDeps.js";
import { dependencyReportToSignals } from "../../application/services/dependencyReportToSignals.js";
import { resolveAuditSnapshot } from "../../../audit/presentation/http/auditRequest.js";
import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import { SqlitePlanTaskStateRepository } from "../../infrastructure/persistence/SqlitePlanTaskStateRepository.js";
import { PlanController } from "../http/PlanController.js";
import { buildProtectionBaseline } from "../../../protection/application/use-cases/buildProtectionBaseline.js";
import { protectionStackOf } from "../../../protection/presentation/http/ProtectionController.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";

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
    // Proyecto = raiz del stack del target (misma clave que los mapas de migracion).
    projectOf: (target) => {
      const config = auditDeps.getConfig();
      return target === "react" ? config.react.modulesPath : config.laravel.modulesPath;
    },
    // Sin red: el Plan usa lo que la pestaña Dependencias ya dejo en cache (nunca espera a npm/OSV).
    dependencySignals: {
      getSignals: async (target) =>
        dependencyReportToSignals(await generateDependencyReport(getDependencyReportDeps(), { target, requested: {}, refresh: false, offline: true })),
    },
    // Fase 3 (XRay X6): el mismo nivel que muestra la franja "Red de seguridad".
    protection: {
      getLevel: async (target) => buildProtectionBaseline({ reader: new NodeFsSourceTreeReader(), ...protectionStackOf(auditDeps.getConfig(), target) }).level,
    },
  });

  router.get("/plan.json", controller.show);
  router.get("/plan/tasks/:key/findings", controller.findings);
  router.post("/plan/tasks/:key", controller.update);

  return router;
}
