import type { Server } from "node:http";

import { createHttpApp } from "../core/http/createHttpApp.js";
import { setArchitectureConfig } from "../app/modules/architecture/infrastructure/config/architectureConfigStore.js";
import type { ArchitectureConfig } from "../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { apiRoutes } from "../routes/api.js";
import { webRoutes } from "../routes/web.js";

export type ChangoArchscopeServerConfig = ArchitectureConfig;

export type ListenChangoArchscopeServerResult = {
  server: Server;
  host: string;
  port: number;
};

export function createChangoArchscopeServer(config: ChangoArchscopeServerConfig) {
  setArchitectureConfig(config);

  const app = createHttpApp({
    api: apiRoutes(),
    web: webRoutes(),
  });

  app.disable("x-powered-by");

  return app;
}

export function listenChangoArchscopeServer(
  config: ChangoArchscopeServerConfig,
): Promise<ListenChangoArchscopeServerResult> {
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
