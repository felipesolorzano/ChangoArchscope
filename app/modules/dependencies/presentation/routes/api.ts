import { Router } from "express";

import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { SqlitePackageInfoCache } from "../../infrastructure/persistence/SqlitePackageInfoCache.js";
import { HttpPackageRegistry } from "../../infrastructure/registry/HttpPackageRegistry.js";
import { LocalRuntimeProbe } from "../../infrastructure/runtime/LocalRuntimeProbe.js";
import { DependenciesController } from "../http/DependenciesController.js";

export function dependenciesApiRoutes(): Router {
  const router = Router();
  const controller = new DependenciesController({
    getConfig: getArchitectureConfig,
    reader: new NodeFsSourceTreeReader(),
    probe: new LocalRuntimeProbe(),
    registry: new HttpPackageRegistry(),
    cache: new SqlitePackageInfoCache(createDrizzleDatabase(getSqliteDatabaseConnection())),
    now: () => new Date(),
  });

  router.get("/dependencies.json", controller.show);

  return router;
}
