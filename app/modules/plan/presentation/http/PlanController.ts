import type { NextFunction, Request, Response } from "express";

import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import type { DependencySignalsProvider } from "../../application/contracts/DependencySignalsProvider.js";
import type { PlanTaskStateRepository } from "../../application/contracts/PlanTaskStateRepository.js";
import type { ProtectionLevelProvider } from "../../application/contracts/ProtectionLevelProvider.js";
import { buildPlan } from "../../application/use-cases/buildPlan.js";
import { findingsForTask } from "../../application/use-cases/findingsForTask.js";
import { assertTaskUnlocked, updateTaskState } from "../../application/use-cases/updateTaskState.js";
import type { DependencySignals, PlanProtectionLevel } from "../../domain/value-objects/Plan.js";

export type PlanControllerDeps = {
  snapshots: AuditSnapshotProvider;
  repository: PlanTaskStateRepository;
  /** Proyecto (raiz del stack) del target: el estado del plan se guarda por proyecto. */
  projectOf: (target: string) => string;
  /** Tareas de actualizacion de paquetes; si falta o falla, el plan sale sin ellas. */
  dependencySignals?: DependencySignalsProvider;
  /** Nivel de proteccion para las fases (XRay X6); si falta o falla, el gate queda sin datos. */
  protection?: ProtectionLevelProvider;
};

export class PlanController {
  constructor(private readonly deps: PlanControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = targetFromRequest(request);
      const snapshot = await this.deps.snapshots.getSnapshot(target);

      response.status(200).json(buildPlan(snapshot, this.deps.repository, this.deps.projectOf(target), await this.dependencies(target), await this.protectionLevel(target)));
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      // La ruta /plan/tasks/:key garantiza `key`; el estado se valida en updateTaskState.
      const target = targetFromRequest(request);
      const state = typeof request.body?.state === "string" ? request.body.state : "";
      const project = this.deps.projectOf(target);
      const key = String(request.params.key);
      const snapshot = await this.deps.snapshots.getSnapshot(target);
      const dependencies = await this.dependencies(target);
      const level = await this.protectionLevel(target);

      // El flujo se hace cumplir: una tarea bloqueada no se empieza (XRay X6).
      assertTaskUnlocked(buildPlan(snapshot, this.deps.repository, project, dependencies, level), key, state);
      updateTaskState(this.deps.repository, target, project, key, state);

      response.status(200).json(buildPlan(snapshot, this.deps.repository, project, dependencies, level));
    } catch (error) {
      next(error);
    }
  };

  findings = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = targetFromRequest(request);
      const snapshot = await this.deps.snapshots.getSnapshot(target);

      response.status(200).json(findingsForTask(snapshot, String(request.params.key), await this.dependencies(target)));
    } catch (error) {
      next(error);
    }
  };

  // El reporte de dependencias es opcional: si no hay proveedor o falla, el plan sale sin esas tareas.
  private async dependencies(target: "laravel" | "react"): Promise<DependencySignals | undefined> {
    return this.deps.dependencySignals?.getSignals(target).catch(() => undefined);
  }

  private async protectionLevel(target: "laravel" | "react"): Promise<PlanProtectionLevel | null> {
    // Stryker disable next-line ArrowFunction: null y undefined son "sin datos" para las fases, mutante equivalente.
    return (await this.deps.protection?.getLevel(target).catch(() => null)) ?? null;
  }
}

function targetFromRequest(request: Request): "laravel" | "react" {
  return request.query.target === "react" ? "react" : "laravel";
}
