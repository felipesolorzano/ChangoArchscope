import { Router } from "express";
import { buildArchitectureGraph } from "../../application/buildArchitectureGraph.js";
import { checkArchitecture } from "../../application/checkArchitecture.js";
import { getArchitectureConfig } from "../../infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../infrastructure/filesystem/NodeFsSourceTreeReader.js";
function targetFromQuery(value) {
    return value === "react" ? "react" : "laravel";
}
function moduleFromQuery(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
export function architectureWebRoutes() {
    const router = Router();
    const reader = new NodeFsSourceTreeReader();
    router.get("/graph.json", (request, response, next) => {
        try {
            response.status(200).json(buildArchitectureGraph(getArchitectureConfig(), reader, {
                target: targetFromQuery(request.query.target),
                module: moduleFromQuery(request.query.module),
            }));
        }
        catch (error) {
            next(error);
        }
    });
    router.get("/check.json", (request, response, next) => {
        try {
            response.status(200).json(checkArchitecture(getArchitectureConfig(), reader, {
                target: targetFromQuery(request.query.target),
                module: moduleFromQuery(request.query.module),
                failOnCoupling: request.query.fail_on_coupling !== "false",
            }));
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
