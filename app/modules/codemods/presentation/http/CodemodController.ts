import type { NextFunction, Request, Response } from "express";

import type { CodemodSources } from "../../application/contracts/CodemodSources.js";
import { buildCodemodPlan } from "../../application/use-cases/buildCodemodPlan.js";

// /codemods.json?target=: APIs legacy agrupadas por patron con su herramienta (XRay X5).
export class CodemodController {
  constructor(private readonly sources: CodemodSources) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = request.query.target === "react" ? "react" : "laravel";
      const snapshot = await this.sources.snapshots.getSnapshot(target);

      response.status(200).json(buildCodemodPlan({ snapshot, sourceRoot: this.sources.rootOf(target), stack: target }));
    } catch (error) {
      next(error);
    }
  };
}
