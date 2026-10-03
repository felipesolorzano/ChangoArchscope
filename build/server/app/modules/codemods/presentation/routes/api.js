import { Router } from "express";
import { resolveAuditSnapshot } from "../../../audit/presentation/http/auditRequest.js";
import { getAuditDeps } from "../../../audit/presentation/http/createAuditDeps.js";
import { CodemodController } from "../http/CodemodController.js";
export function codemodApiRoutes() {
    const router = Router();
    // Reusa las deps del audit: mismo snapshot cacheado que Auditoria y Plan.
    const auditDeps = getAuditDeps();
    const controller = new CodemodController({
        snapshots: { getSnapshot: (target) => resolveAuditSnapshot(auditDeps, target, null) },
        rootOf: (target) => auditDeps.getConfig()[target].modulesPath,
    });
    router.get("/codemods.json", controller.show);
    return router;
}
