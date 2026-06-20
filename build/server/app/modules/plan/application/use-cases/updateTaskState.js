import { PLAN_TASK_STATES } from "../../domain/value-objects/Plan.js";
export function updateTaskState(repository, taskKey, state) {
    if (!isPlanTaskState(state)) {
        throw new Error(`Invalid task state "${state}". Use one of: ${PLAN_TASK_STATES.join(", ")}.`);
    }
    if (taskKey.length === 0) {
        throw new Error("taskKey is required.");
    }
    repository.setState(taskKey, state);
    return state;
}
function isPlanTaskState(value) {
    return PLAN_TASK_STATES.includes(value);
}
