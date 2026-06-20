import { Router } from "express";
import { checkArchitecture } from "../../../architecture/application/checkArchitecture.js";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { PhpAstParser } from "../../infrastructure/parser/PhpAstParser.js";
import { AuditController } from "../http/AuditController.js";
import { AuditGraphController } from "../http/AuditGraphController.js";
export function auditApiRoutes() {
    const router = Router();
    const deps = {
        getConfig: getArchitectureConfig,
        reader: new NodeFsSourceTreeReader(),
        parser: new PhpAstParser(),
        check: checkArchitecture,
    };
    const controller = new AuditController(deps);
    const graphController = new AuditGraphController(deps);
    router.get("/audit.json", controller.show);
    router.get("/audit-graph.json", graphController.show);
    return router;
}
