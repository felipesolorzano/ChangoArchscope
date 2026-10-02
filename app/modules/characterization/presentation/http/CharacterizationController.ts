import type { NextFunction, Request, Response } from "express";

import type { CharacterizationSources } from "../../application/contracts/CharacterizationSources.js";
import { buildCharacterizationPlan } from "../../application/use-cases/buildCharacterizationPlan.js";

// /characterization.json?target=: que proteger primero y esqueletos de tests (XRay X4).
export class CharacterizationController {
  constructor(private readonly sources: CharacterizationSources) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = request.query.target === "react" ? "react" : "laravel";
      const snapshot = await this.sources.snapshots.getSnapshot(target);

      response.status(200).json(buildCharacterizationPlan({ snapshot, graph: this.sources.graphOf(target), sourceRoot: this.sources.rootOf(target), stack: target }));
    } catch (error) {
      next(error);
    }
  };
}
