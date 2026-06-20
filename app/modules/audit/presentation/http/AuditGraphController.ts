import type { NextFunction, Request, Response } from "express";

import type { AuditGraphView } from "../../domain/value-objects/AuditGraph.js";
import { buildAuditGraph } from "../../application/use-cases/BuildAuditGraph.js";
import {
  type AuditControllerDeps,
  moduleFromQuery,
  resolveAuditSnapshot,
  targetFromQuery,
} from "./auditRequest.js";

export class AuditGraphController {
  constructor(private readonly deps: AuditControllerDeps) {}

  show = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const target = targetFromQuery(request.query.target);
      const module = moduleFromQuery(request.query.module);
      const config = this.deps.getConfig();
      const snapshot = resolveAuditSnapshot(this.deps, target, module);
      const graph = buildAuditGraph(snapshot, {
        view: viewFromQuery(request.query.view),
        focus: moduleFromQuery(request.query.focus),
        phpRoot: target === "laravel" ? config.laravel.modulesPath : null,
      });

      response.status(200).json(graph);
    } catch (error) {
      next(error);
    }
  };
}

function viewFromQuery(value: unknown): AuditGraphView {
  return value === "app" || value === "file" || value === "heatmap" ? value : "overview";
}
