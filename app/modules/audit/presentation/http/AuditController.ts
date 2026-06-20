import type { NextFunction, Request, Response } from "express";

import {
  type AuditControllerDeps,
  moduleFromQuery,
  resolveAuditSnapshot,
  targetFromQuery,
} from "./auditRequest.js";

export type { AuditControllerDeps } from "./auditRequest.js";

export class AuditController {
  constructor(private readonly deps: AuditControllerDeps) {}

  show = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const target = targetFromQuery(request.query.target);
      const module = moduleFromQuery(request.query.module);
      const snapshot = resolveAuditSnapshot(this.deps, target, module);

      response.status(200).json(snapshot);
    } catch (error) {
      next(error);
    }
  };
}
