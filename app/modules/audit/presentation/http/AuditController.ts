import type { NextFunction, Request, Response } from "express";

import {
  type AuditControllerDeps,
  moduleFromQuery,
  phpVersionFromQuery,
  resolveAuditSnapshot,
  targetFromQuery,
} from "./auditRequest.js";

export type { AuditControllerDeps } from "./auditRequest.js";

export class AuditController {
  constructor(private readonly deps: AuditControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = targetFromQuery(request.query.target);
      const module = moduleFromQuery(request.query.module);
      const phpVersion = phpVersionFromQuery(request.query.php);
      const snapshot = await resolveAuditSnapshot(this.deps, target, module, phpVersion);

      response.status(200).json(snapshot);
    } catch (error) {
      next(error);
    }
  };
}
