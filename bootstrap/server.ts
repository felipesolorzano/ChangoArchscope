import type { Server } from "node:http";
import path from "node:path";

import { createHttpApp } from "../core/http/createHttpApp.js";
import { setArchitectureConfig } from "../app/modules/architecture/infrastructure/config/architectureConfigStore.js";
import type { ArchitectureConfig } from "../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { runSqliteMigrations } from "../app/modules/shared/infrastructure/persistence/sqlite/runSqliteMigrations.js";
import { createSqliteConnection } from "../app/modules/shared/infrastructure/persistence/sqlite/createSqliteConnection.js";
import { setSqliteDatabaseConnection } from "../app/modules/shared/infrastructure/persistence/sqlite/sqliteDatabaseConnection.js";
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
  initSqliteDatabase();

  const app = createHttpApp({
    api: apiRoutes(),
    web: webRoutes(),
  });

  app.disable("x-powered-by");

  return app;
}

function initSqliteDatabase(): void {
  const databasePath = path.resolve(process.cwd(), "database/architecture-toolkit.sqlite");

  runSqliteMigrations({
    databasePath,
    migrationsDirectory: path.resolve(process.cwd(), "database/migrations"),
  });

  setSqliteDatabaseConnection(createSqliteConnection({ databasePath }));
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
