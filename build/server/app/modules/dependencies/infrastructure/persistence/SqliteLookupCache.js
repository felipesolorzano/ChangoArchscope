import { and, eq } from "drizzle-orm";
import { dependencyLookupCache } from "./dependencyLookupCacheSchema.js";
export class SqliteLookupCache {
    db;
    source;
    constructor(db, source) {
        this.db = db;
        this.source = source;
    }
    get(key) {
        const row = this.db
            .select()
            .from(dependencyLookupCache)
            .where(and(eq(dependencyLookupCache.source, this.source), eq(dependencyLookupCache.key, key)))
            .get();
        return row ? { value: JSON.parse(row.payload), fetchedAt: row.fetchedAt } : null;
    }
    set(key, value, fetchedAt) {
        const payload = JSON.stringify(value);
        this.db
            .insert(dependencyLookupCache)
            .values({ source: this.source, key, payload, fetchedAt })
            .onConflictDoUpdate({ target: [dependencyLookupCache.source, dependencyLookupCache.key], set: { payload, fetchedAt } })
            .run();
    }
}
