import { and, eq } from "drizzle-orm";
import { packageRegistryCache } from "./packageRegistryCacheSchema.js";
export class SqlitePackageInfoCache {
    db;
    constructor(db) {
        this.db = db;
    }
    get(ecosystem, name) {
        const row = this.db
            .select()
            .from(packageRegistryCache)
            .where(and(eq(packageRegistryCache.ecosystem, ecosystem), eq(packageRegistryCache.name, name)))
            .get();
        return row ? { info: JSON.parse(row.info), fetchedAt: row.fetchedAt } : null;
    }
    set(ecosystem, name, info, fetchedAt) {
        const serialized = JSON.stringify(info);
        this.db
            .insert(packageRegistryCache)
            .values({ ecosystem, name, info: serialized, fetchedAt })
            .onConflictDoUpdate({
            target: [packageRegistryCache.ecosystem, packageRegistryCache.name],
            set: { info: serialized, fetchedAt },
        })
            .run();
    }
}
