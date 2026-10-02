import { and, eq } from "drizzle-orm";
import { planTaskStates } from "./planTaskStatesSchema.js";
export class SqlitePlanTaskStateRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getStates(target, project) {
        const rows = this.db
            .select()
            .from(planTaskStates)
            .where(and(eq(planTaskStates.target, target), eq(planTaskStates.project, project)))
            .all();
        const states = {};
        for (const row of rows) {
            states[row.taskKey] = row.state;
        }
        return states;
    }
    setState(target, project, taskKey, state) {
        const updatedAt = new Date().toISOString();
        this.db
            .insert(planTaskStates)
            .values({ target, project, taskKey, state, updatedAt })
            .onConflictDoUpdate({
            target: [planTaskStates.target, planTaskStates.project, planTaskStates.taskKey],
            set: { state, updatedAt },
        })
            .run();
    }
}
