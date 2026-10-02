import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { LookupCache } from "../../application/contracts/LookupCache.js";
import { dependencyLookupCache } from "./dependencyLookupCacheSchema.js";

export class SqliteLookupCache<T> implements LookupCache<T> {
  constructor(
    private readonly db: BetterSQLite3Database,
    private readonly source: string,
  ) {}

  get(key: string): { value: T; fetchedAt: string } | null {
    const row = this.db
      .select()
      .from(dependencyLookupCache)
      .where(and(eq(dependencyLookupCache.source, this.source), eq(dependencyLookupCache.key, key)))
      .get();

    return row ? { value: JSON.parse(row.payload) as T, fetchedAt: row.fetchedAt } : null;
  }

  set(key: string, value: T, fetchedAt: string): void {
    const payload = JSON.stringify(value);

    this.db
      .insert(dependencyLookupCache)
      .values({ source: this.source, key, payload, fetchedAt })
      .onConflictDoUpdate({ target: [dependencyLookupCache.source, dependencyLookupCache.key], set: { payload, fetchedAt } })
      .run();
  }
}
