import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { PlanTaskStateRepository } from "../../application/contracts/PlanTaskStateRepository.js";
import type { PlanTaskState } from "../../domain/value-objects/Plan.js";
import { planTaskStates } from "./planTaskStatesSchema.js";

export class SqlitePlanTaskStateRepository implements PlanTaskStateRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  getStates(target: string): Record<string, PlanTaskState> {
    const rows = this.db.select().from(planTaskStates).where(eq(planTaskStates.target, target)).all();
    const states: Record<string, PlanTaskState> = {};

    for (const row of rows) {
      states[row.taskKey] = row.state as PlanTaskState;
    }

    return states;
  }

  setState(target: string, taskKey: string, state: PlanTaskState): void {
    const updatedAt = new Date().toISOString();

    this.db
      .insert(planTaskStates)
      .values({ target, taskKey, state, updatedAt })
      .onConflictDoUpdate({ target: [planTaskStates.target, planTaskStates.taskKey], set: { state, updatedAt } })
      .run();
  }
}
