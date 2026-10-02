import type { NextFunction, Request, Response } from "express";

import { generateDependencyReport, type DependencyReportDeps } from "../../application/use-cases/generateDependencyReport.js";
import type { RuntimeKind } from "../../domain/value-objects/Dependency.js";

export type DependenciesControllerDeps = DependencyReportDeps;

const RUNTIME_KINDS: RuntimeKind[] = ["php", "node", "npm"];

// /dependencies.json?target=&php=&node=&npm=&refresh=1: reporte del stack con el runtime pedido.
export class DependenciesController {
  constructor(private readonly deps: DependenciesControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await generateDependencyReport(this.deps, {
        target: request.query.target === "react" ? "react" : "laravel",
        requested: requestedRuntimes(request.query),
        refresh: request.query.refresh === "1",
        offline: false,
      });

      response.status(200).json(report);
    } catch (error) {
      next(error);
    }
  };
}

function requestedRuntimes(query: Request["query"]): Partial<Record<RuntimeKind, string>> {
  return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind] as string]));
}
