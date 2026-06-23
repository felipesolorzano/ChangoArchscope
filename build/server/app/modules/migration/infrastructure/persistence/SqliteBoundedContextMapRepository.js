import { eq } from "drizzle-orm";
import { boundedContextMaps } from "./boundedContextMapSchema.js";
export class SqliteBoundedContextMapRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getMap(target) {
        const [row] = this.db.select().from(boundedContextMaps).where(eq(boundedContextMaps.target, target)).all();
        return row === undefined ? null : JSON.parse(row.document);
    }
    saveMap(target, map) {
        const document = JSON.stringify(map);
        const updatedAt = new Date().toISOString();
        this.db
            .insert(boundedContextMaps)
            .values({ target, document, updatedAt })
            .onConflictDoUpdate({ target: boundedContextMaps.target, set: { document, updatedAt } })
            .run();
    }
}
