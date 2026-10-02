import type { NextFunction, Request, Response } from "express";

import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import type { PlanTaskStateRepository } from "../../application/contracts/PlanTaskStateRepository.js";
import { buildPlan } from "../../application/use-cases/buildPlan.js";
import { findingsForTask } from "../../application/use-cases/findingsForTask.js";
import { updateTaskState } from "../../application/use-cases/updateTaskState.js";

export type PlanControllerDeps = {
  snapshots: AuditSnapshotProvider;
  repository: PlanTaskStateRepository;
  /** Proyecto (raiz del stack) del target: el estado del plan se guarda por proyecto. */
  projectOf: (target: string) => string;
};

export class PlanController {
  constructor(private readonly deps: PlanControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = targetFromRequest(request);
      const snapshot = await this.deps.snapshots.getSnapshot(target);

      response.status(200).json(buildPlan(snapshot, this.deps.repository, this.deps.projectOf(target)));
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
      updateTaskState(this.deps.repository, target, project, String(request.params.key), state);

      const snapshot = await this.deps.snapshots.getSnapshot(target);
      response.status(200).json(buildPlan(snapshot, this.deps.repository, project));
    } catch (error) {
      next(error);
    }
  };

  findings = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshot = await this.deps.snapshots.getSnapshot(targetFromRequest(request));

      response.status(200).json(findingsForTask(snapshot, String(request.params.key)));
    } catch (error) {
      next(error);
    }
  };
}

function targetFromRequest(request: Request): "laravel" | "react" {
  return request.query.target === "react" ? "react" : "laravel";
}
