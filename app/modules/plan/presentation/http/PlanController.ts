import type { NextFunction, Request, Response } from "express";

import type { AuditSnapshotProvider } from "../../application/contracts/AuditSnapshotProvider.js";
import type { PlanTaskStateRepository } from "../../application/contracts/PlanTaskStateRepository.js";
import { buildPlan } from "../../application/use-cases/buildPlan.js";
import { findingsForTask } from "../../application/use-cases/findingsForTask.js";
import { updateTaskState } from "../../application/use-cases/updateTaskState.js";

export type PlanControllerDeps = {
  snapshots: AuditSnapshotProvider;
  repository: PlanTaskStateRepository;
};

export class PlanController {
  constructor(private readonly deps: PlanControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshot = await this.deps.snapshots.getSnapshot(targetFromRequest(request));

      response.status(200).json(buildPlan(snapshot, this.deps.repository));
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      // La ruta /plan/tasks/:key garantiza `key`; el estado se valida en updateTaskState.
      const state = typeof request.body?.state === "string" ? request.body.state : "";
      updateTaskState(this.deps.repository, String(request.params.key), state);

      const snapshot = await this.deps.snapshots.getSnapshot(targetFromRequest(request));
      response.status(200).json(buildPlan(snapshot, this.deps.repository));
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
