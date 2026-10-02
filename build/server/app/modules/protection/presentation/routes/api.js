import { Router } from "express";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { ProtectionController } from "../http/ProtectionController.js";
export function protectionApiRoutes() {
    const router = Router();
    const controller = new ProtectionController({ getConfig: getArchitectureConfig, reader: new NodeFsSourceTreeReader() });
    router.get("/protection.json", controller.show);
    return router;
}
