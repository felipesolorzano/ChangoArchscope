import { Router } from "express";

import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { reactSourceExtensions } from "../../../architecture/application/analyzers/tsImports.js";
import type { ProjectSource, SourceProvider } from "../../application/contracts/SourceProvider.js";
import { resolveProjectSource } from "../../application/use-cases/resolveProjectSource.js";
import { SqliteBoundedContextMapRepository } from "../../infrastructure/persistence/SqliteBoundedContextMapRepository.js";
import { BoundedContextMapController } from "../http/BoundedContextMapController.js";

export function migrationApiRoutes(): Router {
  const router = Router();

  const reader = new NodeFsSourceTreeReader();

  const source: SourceProvider = {
    getSource: (target): ProjectSource => {
      const { laravel, react } = getArchitectureConfig();
      return resolveProjectSource(
        target,
        {
          laravel: { root: laravel.modulesPath, extensions: laravel.phpExtensions, ignoredPaths: laravel.ignoredPaths },
          react: { root: react.modulesPath, extensions: reactSourceExtensions, ignoredPaths: react.ignoredPaths },
        },
        (root, extensions, ignoredPaths) => reader.walkFiles(root, extensions, ignoredPaths),
      );
    },
  };

  const controller = new BoundedContextMapController({
    repository: new SqliteBoundedContextMapRepository(createDrizzleDatabase(getSqliteDatabaseConnection())),
    source,
  });

  router.get("/bounded-context-map.json", controller.show);
  router.get("/bounded-context-source.json", controller.source);
  router.put("/bounded-context-map", controller.save);

  return router;
}
