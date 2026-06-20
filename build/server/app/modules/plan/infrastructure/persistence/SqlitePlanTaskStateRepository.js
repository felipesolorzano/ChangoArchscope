import { planTaskStates } from "./planTaskStatesSchema.js";
export class SqlitePlanTaskStateRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getStates() {
        const rows = this.db.select().from(planTaskStates).all();
        const states = {};
        for (const row of rows) {
            states[row.taskKey] = row.state;
        }
        return states;
    }
    setState(taskKey, state) {
        const updatedAt = new Date().toISOString();
        this.db
            .insert(planTaskStates)
            .values({ taskKey, state, updatedAt })
            .onConflictDoUpdate({ target: planTaskStates.taskKey, set: { state, updatedAt } })
            .run();
    }
}
