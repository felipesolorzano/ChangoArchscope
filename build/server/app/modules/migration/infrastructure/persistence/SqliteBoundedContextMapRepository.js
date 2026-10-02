import { and, eq } from "drizzle-orm";
import { boundedContextMaps } from "./boundedContextMapSchema.js";
export class SqliteBoundedContextMapRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getMap(target, project) {
        const [row] = this.db
            .select()
            .from(boundedContextMaps)
            .where(and(eq(boundedContextMaps.target, target), eq(boundedContextMaps.project, project)))
            .all();
        return row === undefined ? null : JSON.parse(row.document);
    }
    saveMap(target, project, map) {
        const document = JSON.stringify(map);
        const updatedAt = new Date().toISOString();
        this.db
            .insert(boundedContextMaps)
            .values({ target, project, document, updatedAt })
            .onConflictDoUpdate({ target: [boundedContextMaps.target, boundedContextMaps.project], set: { document, updatedAt } })
            .run();
    }
}
