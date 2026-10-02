import { Router } from "express";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { reactSourceExtensions } from "../../../architecture/application/analyzers/tsImports.js";
import { projectRootFor, resolveProjectSource } from "../../application/use-cases/resolveProjectSource.js";
import { SqliteBoundedContextMapRepository } from "../../infrastructure/persistence/SqliteBoundedContextMapRepository.js";
import { BoundedContextMapController } from "../http/BoundedContextMapController.js";
export function migrationApiRoutes() {
    const router = Router();
    const reader = new NodeFsSourceTreeReader();
    // Se leen en cada request: la config puede cambiar de proyecto entre reinicios del server.
    const stacks = () => {
        const { laravel, react } = getArchitectureConfig();
        return {
            laravel: { root: laravel.modulesPath, extensions: laravel.phpExtensions, ignoredPaths: laravel.ignoredPaths },
            react: { root: react.modulesPath, extensions: reactSourceExtensions, ignoredPaths: react.ignoredPaths },
        };
    };
    const source = {
        getSource: (target) => resolveProjectSource(target, stacks(), (root, extensions, ignoredPaths) => reader.walkFiles(root, extensions, ignoredPaths)),
    };
    const controller = new BoundedContextMapController({
        repository: new SqliteBoundedContextMapRepository(createDrizzleDatabase(getSqliteDatabaseConnection())),
        source,
        projectOf: (target) => projectRootFor(target, stacks()),
    });
    router.get("/bounded-context-map.json", controller.show);
    router.get("/bounded-context-source.json", controller.source);
    router.put("/bounded-context-map", controller.save);
    return router;
}
