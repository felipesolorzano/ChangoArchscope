import type { NextFunction, Request, Response } from "express";

import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { RuntimeProbe } from "../../application/contracts/RuntimeProbe.js";
import { detectDependencies } from "../../application/use-cases/detectDependencies.js";

export type DependenciesControllerDeps = {
  getConfig: () => ArchitectureConfig;
  reader: SourceTreeReader;
  probe: RuntimeProbe;
};

// Inventario de dependencias del stack pedido (raiz = modulesPath, con sus ignoredPaths).
export class DependenciesController {
  constructor(private readonly deps: DependenciesControllerDeps) {}

  show = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const target = request.query.target === "react" ? "react" : "laravel";
      const stack = this.deps.getConfig()[target];

      response.status(200).json(
        detectDependencies({ target, root: stack.modulesPath, ignoredPaths: stack.ignoredPaths, reader: this.deps.reader, probe: this.deps.probe }),
      );
    } catch (error) {
      next(error);
    }
  };
}
