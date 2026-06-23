import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { BoundedContextMapRepository } from "../../application/contracts/BoundedContextMapRepository.js";
import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap.js";
import { boundedContextMaps } from "./boundedContextMapSchema.js";

export class SqliteBoundedContextMapRepository implements BoundedContextMapRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  getMap(target: string): BoundedContextMap | null {
    const [row] = this.db.select().from(boundedContextMaps).where(eq(boundedContextMaps.target, target)).all();

    return row === undefined ? null : (JSON.parse(row.document) as BoundedContextMap);
  }

  saveMap(target: string, map: BoundedContextMap): void {
    const document = JSON.stringify(map);
    const updatedAt = new Date().toISOString();

    this.db
      .insert(boundedContextMaps)
      .values({ target, document, updatedAt })
      .onConflictDoUpdate({ target: boundedContextMaps.target, set: { document, updatedAt } })
      .run();
  }
}
