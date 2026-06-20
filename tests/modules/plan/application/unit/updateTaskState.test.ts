import { describe, expect, it, vi } from "vitest";

import type { PlanTaskStateRepository } from "../../../../../app/modules/plan/application/contracts/PlanTaskStateRepository.js";
import { updateTaskState } from "../../../../../app/modules/plan/application/use-cases/updateTaskState.js";

function fakeRepository(): PlanTaskStateRepository {
  return { getStates: vi.fn(() => ({})), setState: vi.fn() };
}

describe("updateTaskState", () => {
  it("persiste un estado valido y lo devuelve", () => {
    const repository = fakeRepository();

    const result = updateTaskState(repository, "close-sql-injections", "in_progress");

    expect(result).toBe("in_progress");
    expect(repository.setState).toHaveBeenCalledWith("close-sql-injections", "in_progress");
  });

  it("rechaza un estado invalido sin tocar el repositorio", () => {
    const repository = fakeRepository();

    expect(() => updateTaskState(repository, "x", "almost-done")).toThrow(/Invalid task state/);
    expect(repository.setState).not.toHaveBeenCalled();
  });

  it("rechaza un taskKey vacio", () => {
    const repository = fakeRepository();

    expect(() => updateTaskState(repository, "", "done")).toThrow(/taskKey/);
    expect(repository.setState).not.toHaveBeenCalled();
  });
});
