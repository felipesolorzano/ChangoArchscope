import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import type { AuditSnapshotProvider } from "../../../../../app/modules/plan/application/contracts/AuditSnapshotProvider.js";
import type { PlanTaskStateRepository } from "../../../../../app/modules/plan/application/contracts/PlanTaskStateRepository.js";
import { PlanController } from "../../../../../app/modules/plan/presentation/http/PlanController.js";

function snapshot(): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    summary: { files_scanned: 1, files_skipped: 0, modules: 0, findings_count: 1, by_category: { security: 1 }, by_severity: { high: 1 } },
    findings: [
      { category: "security", rule: "sql-concatenation", severity: "high", source: "native", module: "", class: null, file: "/r/X.php", line: 1, message: "", details: {} },
    ],
    riskScore: { value: 3, breakdown: {} },
    riskBreakdown: { byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] },
    skippedFiles: [],
    scannedFiles: [],
    testedBy: {},
  };
}

const snapshots: AuditSnapshotProvider = { getSnapshot: async () => snapshot() };

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json, response: { status } as unknown as Response };
}

const projectOf = (target: string) => (target === "react" ? "/react" : "/php");

function repository(): PlanTaskStateRepository {
  return { getStates: vi.fn(() => ({})), setState: vi.fn() };
}

describe("PlanController", async () => {
  it("show responde 200 con el grafo del plan y usa target laravel por defecto", async () => {
    const getSnapshot = vi.fn(async (_target: "laravel" | "react") => snapshot());
    const controller = new PlanController({ snapshots: { getSnapshot }, repository: repository(), projectOf });
    const { status, json, response } = fakeResponse();

    await controller.show({ query: {} } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(getSnapshot).toHaveBeenCalledWith("laravel");
    expect(status).toHaveBeenCalledWith(200);
    const graph = json.mock.calls[0][0] as { nodes: Array<{ id: string }> };
    expect(graph.nodes.some((node) => node.id === "close-sql-injections")).toBe(true);
  });

  it("update persiste el estado y responde el plan actualizado", async () => {
    const repo = repository();
    const controller = new PlanController({ snapshots, repository: repo, projectOf });
    const { status, response } = fakeResponse();

    await controller.update(
      { params: { key: "close-sql-injections" }, body: { state: "done" }, query: {} } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(repo.setState).toHaveBeenCalledWith("laravel", "/php", "close-sql-injections", "done");
    expect(status).toHaveBeenCalledWith(200);
  });

  it("show pasa el target del query al provider (react)", async () => {
    const getSnapshot = vi.fn(async (_target: "laravel" | "react") => snapshot());
    const controller = new PlanController({ snapshots: { getSnapshot }, repository: repository(), projectOf });
    const { response } = fakeResponse();

    await controller.show({ query: { target: "react" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(getSnapshot).toHaveBeenCalledWith("react");
  });

  it("show lee los estados del proyecto del target", async () => {
    const repo = repository();
    const controller = new PlanController({ snapshots, repository: repo, projectOf });

    await controller.show({ query: { target: "react" } } as unknown as Request, fakeResponse().response, vi.fn() as unknown as NextFunction);

    expect(repo.getStates).toHaveBeenCalledWith("laravel", "/react");
  });

  it("show delega a next si el provider lanza", async () => {
    const boom = new Error("sin snapshot");
    const controller = new PlanController({ snapshots: { getSnapshot: async () => { throw boom; } }, repository: repository(), projectOf });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(boom);
    expect(status).not.toHaveBeenCalled();
  });

  it("update usa el target del query (react) al persistir y al reconstruir el plan", async () => {
    const getSnapshot = vi.fn(async (_target: "laravel" | "react") => snapshot());
    const repo = repository();
    const controller = new PlanController({ snapshots: { getSnapshot }, repository: repo, projectOf });
    const { response } = fakeResponse();

    await controller.update(
      { params: { key: "close-sql-injections" }, body: { state: "done" }, query: { target: "react" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(getSnapshot).toHaveBeenCalledWith("react");
    expect(repo.setState).toHaveBeenCalledWith("react", "/react", "close-sql-injections", "done");
  });

  it("update sin state en el body delega a next sin persistir", async () => {
    const repo = repository();
    const controller = new PlanController({ snapshots, repository: repo, projectOf });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.update(
      { params: { key: "close-sql-injections" }, body: {}, query: {} } as unknown as Request,
      response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(repo.setState).not.toHaveBeenCalled();
    expect((next.mock.calls[0][0] as Error).message).toBe('Invalid task state "". Use one of: pending, in_progress, done, blocked.');
  });

  it("update sin body (ni state) responde el mismo error de validacion", async () => {
    const repo = repository();
    const controller = new PlanController({ snapshots, repository: repo, projectOf });
    const next = vi.fn();

    await controller.update(
      { params: { key: "close-sql-injections" }, query: {} } as unknown as Request,
      fakeResponse().response,
      next as unknown as NextFunction,
    );

    expect((next.mock.calls[0][0] as Error).message).toBe('Invalid task state "". Use one of: pending, in_progress, done, blocked.');
    expect(repo.setState).not.toHaveBeenCalled();
  });

  it("update con un state que no es string lo trata como vacio", async () => {
    const next = vi.fn();
    const controller = new PlanController({ snapshots, repository: repository(), projectOf });

    await controller.update(
      { params: { key: "close-sql-injections" }, body: { state: ["done"] }, query: {} } as unknown as Request,
      fakeResponse().response,
      next as unknown as NextFunction,
    );

    expect((next.mock.calls[0][0] as Error).message).toMatch(/^Invalid task state ""/);
  });

  it("findings responde 200 con los hallazgos concretos de la tarea", async () => {
    const controller = new PlanController({ snapshots, repository: repository(), projectOf });
    const { status, json, response } = fakeResponse();

    await controller.findings(
      { params: { key: "close-sql-injections" }, query: {} } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(status).toHaveBeenCalledWith(200);
    const payload = json.mock.calls[0][0] as { taskKey: string; items: Array<{ rule: string }> };
    expect(payload.taskKey).toBe("close-sql-injections");
    expect(payload.items[0]?.rule).toBe("sql-concatenation");
  });

  it("findings delega a next si el provider lanza", async () => {
    const controller = new PlanController({ snapshots: { getSnapshot: async () => { throw new Error("x"); } }, repository: repository(), projectOf });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.findings({ params: { key: "x" }, query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("update con estado invalido delega a next sin responder", async () => {
    const repo = repository();
    const controller = new PlanController({ snapshots, repository: repo, projectOf });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.update(
      { params: { key: "x" }, body: { state: "nope" }, query: {} } as unknown as Request,
      response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(repo.setState).not.toHaveBeenCalled();
  });

  it("con proveedor de dependencias: show y update agregan sus tareas; findings devuelve sus items", async () => {
    const dependencies = { counts: { "remove-unused-packages": 2 }, items: { "remove-unused-packages": [{ file: "/p/package.json", line: 0, rule: "dependency-unused", severity: "low", message: "write" }] } };
    const getSignals = vi.fn(async (_target: "laravel" | "react") => dependencies);
    const controller = new PlanController({ snapshots, repository: repository(), projectOf, dependencySignals: { getSignals } });

    const shown = fakeResponse();
    await controller.show({ query: { target: "react" } } as unknown as Request, shown.response, vi.fn() as unknown as NextFunction);
    expect(getSignals).toHaveBeenCalledWith("react");
    expect((shown.json.mock.calls[0][0] as { nodes: Array<{ id: string }> }).nodes.some((node) => node.id === "remove-unused-packages")).toBe(true);

    const updated = fakeResponse();
    await controller.update({ params: { key: "remove-unused-packages" }, body: { state: "done" }, query: {} } as unknown as Request, updated.response, vi.fn() as unknown as NextFunction);
    expect((updated.json.mock.calls[0][0] as { nodes: Array<{ id: string }> }).nodes.some((node) => node.id === "remove-unused-packages")).toBe(true);

    const found = fakeResponse();
    await controller.findings({ params: { key: "remove-unused-packages" }, query: {} } as unknown as Request, found.response, vi.fn() as unknown as NextFunction);
    expect(found.json.mock.calls[0][0]).toMatchObject({ total: 1, items: [{ message: "write" }] });
  });

  it("si el proveedor de dependencias falla, el plan sale sin sus tareas", async () => {
    const controller = new PlanController({ snapshots, repository: repository(), projectOf, dependencySignals: { getSignals: async () => { throw new Error("sin red"); } } });
    const { status, json, response } = fakeResponse();
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
    expect((json.mock.calls[0][0] as { nodes: Array<{ id: string }> }).nodes.some((node) => node.id === "close-sql-injections")).toBe(true);
  });

  it("fases: pide el nivel de proteccion del target; si falla, sin datos (XRay X6)", async () => {
    const getLevel = vi.fn(async (_target: "laravel" | "react") => "high" as const);
    const { json, response } = fakeResponse();

    await new PlanController({ snapshots, repository: repository(), projectOf, protection: { getLevel } }).show({ query: { target: "react" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(getLevel).toHaveBeenCalledWith("react");
    expect(json.mock.calls[0][0].phases[3].gates[0]).toMatchObject({ value: 3, status: "passed" });

    const failing = fakeResponse();
    const broken = { getLevel: vi.fn(async () => Promise.reject(new Error("boom"))) };
    await new PlanController({ snapshots, repository: repository(), projectOf, protection: broken }).update(
      { params: { key: "close-sql-injections" }, body: { state: "done" }, query: {} } as unknown as Request,
      failing.response,
      vi.fn() as unknown as NextFunction,
    );
    expect(failing.json.mock.calls[0][0].phases[3].gates[0]).toMatchObject({ value: null, status: "unknown" });
  });
});
