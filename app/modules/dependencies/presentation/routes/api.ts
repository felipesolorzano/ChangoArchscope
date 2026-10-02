import { Router } from "express";

import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { LocalRuntimeProbe } from "../../infrastructure/runtime/LocalRuntimeProbe.js";
import { DependenciesController } from "../http/DependenciesController.js";

export function dependenciesApiRoutes(): Router {
  const router = Router();
  const controller = new DependenciesController({
    getConfig: getArchitectureConfig,
    reader: new NodeFsSourceTreeReader(),
    probe: new LocalRuntimeProbe(),
  });

  router.get("/dependencies.json", controller.show);

  return router;
}
