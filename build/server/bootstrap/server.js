import { createHttpApp } from "../core/http/createHttpApp.js";
import { setArchitectureConfig } from "../app/modules/architecture/infrastructure/config/architectureConfigStore.js";
import { apiRoutes } from "../routes/api.js";
import { webRoutes } from "../routes/web.js";
export function createChangoArchscopeServer(config) {
    setArchitectureConfig(config);
    const app = createHttpApp({
        api: apiRoutes(),
        web: webRoutes(),
    });
    app.disable("x-powered-by");
    return app;
}
export function listenChangoArchscopeServer(config) {
    const app = createChangoArchscopeServer(config);
    const host = config.server.host ?? "127.0.0.1";
    const port = Number(config.server.port ?? 4590);
    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
            resolve({ server, host, port });
        });
        server.once("error", reject);
    });
}
