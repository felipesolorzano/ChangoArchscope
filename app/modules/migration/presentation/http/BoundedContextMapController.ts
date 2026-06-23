import type { NextFunction, Request, Response } from "express";

import type { BoundedContextMapRepository } from "../../application/contracts/BoundedContextMapRepository.js";
import type { SourceProvider } from "../../application/contracts/SourceProvider.js";
import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap.js";
import { normalizeBoundedContextMap } from "../../domain/services/normalizeBoundedContextMap.js";

export type BoundedContextMapControllerDeps = {
  repository: BoundedContextMapRepository;
  source: SourceProvider;
};

export class BoundedContextMapController {
  constructor(private readonly deps: BoundedContextMapControllerDeps) {}

  show = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const map = this.deps.repository.getMap(targetFromRequest(request)) ?? emptyMap();
      response.status(200).json(map);
    } catch (error) {
      next(error);
    }
  };

  save = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const map = normalizeBoundedContextMap(request.body);
      this.deps.repository.saveMap(targetFromRequest(request), map);
      response.status(200).json(map);
    } catch (error) {
      next(error);
    }
  };

  // Le indica al agente la raiz del proyecto y los archivos en alcance para analizarlos.
  source = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.status(200).json(this.deps.source.getSource(targetFromRequest(request)));
    } catch (error) {
      next(error);
    }
  };
}

function targetFromRequest(request: Request): string {
  return typeof request.query.target === "string" && request.query.target.length > 0 ? request.query.target : "laravel";
}

function emptyMap(): BoundedContextMap {
  return { generatedAt: new Date().toISOString(), modules: [] };
}
