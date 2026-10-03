import { describe, expect, it, vi } from "vitest";

import type { PlanTaskStateRepository } from "../../../../../app/modules/plan/application/contracts/PlanTaskStateRepository.js";
import { assertTaskUnlocked, updateTaskState } from "../../../../../app/modules/plan/application/use-cases/updateTaskState.js";

function fakeRepository(): PlanTaskStateRepository {
  return { getStates: vi.fn(() => ({})), setState: vi.fn() };
}

describe("updateTaskState", () => {
  it("persiste un estado valido y lo devuelve", () => {
    const repository = fakeRepository();

    const result = updateTaskState(repository, "react", "/p", "close-sql-injections", "in_progress");

    expect(result).toBe("in_progress");
    expect(repository.setState).toHaveBeenCalledWith("react", "/p", "close-sql-injections", "in_progress");
  });

  it("rechaza un estado invalido sin tocar el repositorio", () => {
    const repository = fakeRepository();

    expect(() => updateTaskState(repository, "laravel", "/p", "x", "almost-done")).toThrow(/Invalid task state/);
    expect(repository.setState).not.toHaveBeenCalled();
  });

  it("rechaza un taskKey vacio", () => {
    const repository = fakeRepository();

    expect(() => updateTaskState(repository, "laravel", "/p", "", "done")).toThrow(/taskKey/);
    expect(repository.setState).not.toHaveBeenCalled();
  });
});

describe("assertTaskUnlocked (XRay X6)", () => {
  const graph = {
    nodes: [
      { id: "a", title: "Tests", lockReason: null },
      { id: "b", title: "Migrar versiones major", lockReason: "Espera a: Tests" },
    ],
  } as never;

  it("una tarea bloqueada no pasa a en progreso ni a hecho", () => {
    expect(() => assertTaskUnlocked(graph, "b", "in_progress")).toThrow('La tarea "Migrar versiones major" esta bloqueada. Espera a: Tests.');
    expect(() => assertTaskUnlocked(graph, "b", "done")).toThrow("esta bloqueada");
  });

  it("pendiente y bloqueado siempre; una tarea libre se puede empezar", () => {
    expect(() => assertTaskUnlocked(graph, "b", "pending")).not.toThrow();
    expect(() => assertTaskUnlocked(graph, "b", "blocked")).not.toThrow();
    expect(() => assertTaskUnlocked(graph, "a", "done")).not.toThrow();
    expect(() => assertTaskUnlocked(graph, "a", "in_progress")).not.toThrow();
  });

  it("una tarea fuera del plan actual no se empieza ni se da por hecha; pendiente y bloqueado si", () => {
    expect(() => assertTaskUnlocked(graph, "upgrade-major:jest", "done")).toThrow('La tarea "upgrade-major:jest" no esta en el plan actual: no se puede empezar ni dar por hecha.');
    expect(() => assertTaskUnlocked(graph, "upgrade-major:jest", "in_progress")).toThrow("no esta en el plan actual");
    expect(() => assertTaskUnlocked(graph, "upgrade-major:jest", "pending")).not.toThrow();
    expect(() => assertTaskUnlocked(graph, "upgrade-major:jest", "blocked")).not.toThrow();
  });
});

