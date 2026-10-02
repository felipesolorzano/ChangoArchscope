import { eq } from "drizzle-orm";
import { planTaskStates } from "./planTaskStatesSchema.js";
export class SqlitePlanTaskStateRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getStates(target) {
        const rows = this.db.select().from(planTaskStates).where(eq(planTaskStates.target, target)).all();
        const states = {};
        for (const row of rows) {
            states[row.taskKey] = row.state;
        }
        return states;
    }
    setState(target, taskKey, state) {
        const updatedAt = new Date().toISOString();
        this.db
            .insert(planTaskStates)
            .values({ target, taskKey, state, updatedAt })
            .onConflictDoUpdate({ target: [planTaskStates.target, planTaskStates.taskKey], set: { state, updatedAt } })
            .run();
    }
}
