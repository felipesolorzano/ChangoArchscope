import { Router } from "express";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { SqliteBoundedContextMapRepository } from "../../infrastructure/persistence/SqliteBoundedContextMapRepository.js";
import { BoundedContextMapController } from "../http/BoundedContextMapController.js";
export function migrationApiRoutes() {
    const router = Router();
    const reader = new NodeFsSourceTreeReader();
    const source = {
        getSource: (target) => {
            const config = getArchitectureConfig();
            if (target === "react") {
                return { target, root: config.react.modulesPath, extensions: [], ignoredPaths: config.react.ignoredPaths, files: [] };
            }
            const { modulesPath, phpExtensions, ignoredPaths } = config.laravel;
            return {
                target,
                root: modulesPath,
                extensions: phpExtensions,
                ignoredPaths,
                files: reader.walkFiles(modulesPath, phpExtensions, ignoredPaths),
            };
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
