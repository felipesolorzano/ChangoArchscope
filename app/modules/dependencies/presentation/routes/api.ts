import { Router } from "express";

import { DependenciesController } from "../http/DependenciesController.js";
import { getDependencyReportDeps } from "../http/createDependencyReportDeps.js";

export function dependenciesApiRoutes(): Router {
  const router = Router();
  const controller = new DependenciesController(getDependencyReportDeps());

  router.get("/dependencies.json", controller.show);

  return router;
}
