import { Router } from "express";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { OsvAdvisoryDatabase } from "../../infrastructure/advisories/OsvAdvisoryDatabase.js";
import { SqliteLookupCache } from "../../infrastructure/persistence/SqliteLookupCache.js";
import { SqlitePackageInfoCache } from "../../infrastructure/persistence/SqlitePackageInfoCache.js";
import { EndOfLifeCalendar } from "../../infrastructure/support/EndOfLifeCalendar.js";
import { HttpPackageRegistry } from "../../infrastructure/registry/HttpPackageRegistry.js";
import { LocalRuntimeProbe } from "../../infrastructure/runtime/LocalRuntimeProbe.js";
import { DependenciesController } from "../http/DependenciesController.js";
export function dependenciesApiRoutes() {
    const router = Router();
    const db = createDrizzleDatabase(getSqliteDatabaseConnection());
    const controller = new DependenciesController({
        getConfig: getArchitectureConfig,
        reader: new NodeFsSourceTreeReader(),
        probe: new LocalRuntimeProbe(),
        registry: new HttpPackageRegistry(),
        cache: new SqlitePackageInfoCache(db),
        advisories: new OsvAdvisoryDatabase(),
        advisoryCache: new SqliteLookupCache(db, "osv"),
        calendar: new EndOfLifeCalendar(),
        calendarCache: new SqliteLookupCache(db, "endoflife"),
        now: () => new Date(),
    });
    router.get("/dependencies.json", controller.show);
    return router;
}
