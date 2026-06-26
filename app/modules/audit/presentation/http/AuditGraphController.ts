import type { NextFunction, Request, Response } from "express";

import type { AuditGraphView } from "../../domain/value-objects/AuditGraph.js";
import { buildAuditGraph } from "../../application/use-cases/BuildAuditGraph.js";
import {
  type AuditControllerDeps,
  moduleFromQuery,
  phpVersionFromQuery,
  resolveAuditSnapshot,
  targetFromQuery,
} from "./auditRequest.js";

export class AuditGraphController {
  constructor(private readonly deps: AuditControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = targetFromQuery(request.query.target);
      const module = moduleFromQuery(request.query.module);
      const phpVersion = phpVersionFromQuery(request.query.php);
      const config = this.deps.getConfig();
      const snapshot = await resolveAuditSnapshot(this.deps, target, module, phpVersion);
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
