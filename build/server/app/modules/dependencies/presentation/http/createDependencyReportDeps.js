import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createDrizzleDatabase } from "../../../shared/infrastructure/persistence/sqlite/createDrizzleDatabase.js";
import { getSqliteDatabaseConnection } from "../../../shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
import { OsvAdvisoryDatabase } from "../../infrastructure/advisories/OsvAdvisoryDatabase.js";
import { SqliteLookupCache } from "../../infrastructure/persistence/SqliteLookupCache.js";
import { SqlitePackageInfoCache } from "../../infrastructure/persistence/SqlitePackageInfoCache.js";
import { HttpPackageRegistry } from "../../infrastructure/registry/HttpPackageRegistry.js";
import { LocalRuntimeProbe } from "../../infrastructure/runtime/LocalRuntimeProbe.js";
import { EndOfLifeCalendar } from "../../infrastructure/support/EndOfLifeCalendar.js";
let deps = null;
// Adaptadores reales del reporte de dependencias (singleton: los comparten /dependencies.json y el Plan).
export function getDependencyReportDeps() {
    if (deps === null) {
        const db = createDrizzleDatabase(getSqliteDatabaseConnection());
        deps = {
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
        };
    }
    return deps;
}
