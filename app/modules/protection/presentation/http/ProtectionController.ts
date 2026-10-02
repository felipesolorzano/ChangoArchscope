import type { NextFunction, Request, Response } from "express";

import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { buildProtectionBaseline } from "../../application/use-cases/buildProtectionBaseline.js";

export type ProtectionControllerDeps = { getConfig: () => ArchitectureConfig; reader: SourceTreeReader };

const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

// /protection.json?target=: linea base de proteccion del stack (XRay X3).
export class ProtectionController {
  constructor(private readonly deps: ProtectionControllerDeps) {}

  show = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const config = this.deps.getConfig();
      const stack =
        request.query.target === "react"
          ? // Stryker disable next-line ArrayDeclaration: una carpeta de tests inventada no existe, mutante equivalente.
            { stackRoot: config.react.modulesPath, testPaths: config.react.testPaths ?? [], extensions: JS_EXTENSIONS, ignoredPaths: config.react.ignoredPaths }
          : // Stryker disable next-line ArrayDeclaration: una carpeta de tests inventada no existe, mutante equivalente.
            { stackRoot: config.laravel.modulesPath, testPaths: [], extensions: config.laravel.phpExtensions, ignoredPaths: config.laravel.ignoredPaths };

      response.status(200).json(buildProtectionBaseline({ reader: this.deps.reader, ...stack }));
    } catch (error) {
      next(error);
    }
  };
}
