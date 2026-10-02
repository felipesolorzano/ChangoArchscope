import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { BoundedContextMapRepository } from "../../application/contracts/BoundedContextMapRepository.js";
import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap.js";
import { boundedContextMaps } from "./boundedContextMapSchema.js";

export class SqliteBoundedContextMapRepository implements BoundedContextMapRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  getMap(target: string, project: string): BoundedContextMap | null {
    const [row] = this.db
      .select()
      .from(boundedContextMaps)
      .where(and(eq(boundedContextMaps.target, target), eq(boundedContextMaps.project, project)))
      .all();

    return row === undefined ? null : (JSON.parse(row.document) as BoundedContextMap);
  }

  saveMap(target: string, project: string, map: BoundedContextMap): void {
    const document = JSON.stringify(map);
    const updatedAt = new Date().toISOString();

    this.db
      .insert(boundedContextMaps)
      .values({ target, project, document, updatedAt })
      .onConflictDoUpdate({ target: [boundedContextMaps.target, boundedContextMaps.project], set: { document, updatedAt } })
      .run();
  }
}
