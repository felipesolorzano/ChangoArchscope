import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { CachedPackageInfo, PackageInfoCache } from "../../application/contracts/PackageInfoCache.js";
import type { Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";
import { packageRegistryCache } from "./packageRegistryCacheSchema.js";

export class SqlitePackageInfoCache implements PackageInfoCache {
  constructor(private readonly db: BetterSQLite3Database) {}

  get(ecosystem: Ecosystem, name: string): CachedPackageInfo | null {
    const row = this.db
      .select()
      .from(packageRegistryCache)
      .where(and(eq(packageRegistryCache.ecosystem, ecosystem), eq(packageRegistryCache.name, name)))
      .get();

    return row ? { info: JSON.parse(row.info) as PackageInfo | null, fetchedAt: row.fetchedAt } : null;
  }

  set(ecosystem: Ecosystem, name: string, info: PackageInfo | null, fetchedAt: string): void {
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
