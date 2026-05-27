import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArchitectureGraph, checkArchitecture } from "../analyzers/index.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const uiDist = path.join(packageRoot, "dist/ui");

export function createArchitectureServer(config) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (url.pathname === "/graph.json") {
        sendJson(response, buildArchitectureGraph(config, {
          target: url.searchParams.get("target") ?? "laravel",
          module: url.searchParams.get("module") || null,
        }));
        return;
      }

      if (url.pathname === "/check.json") {
        sendJson(response, checkArchitecture(config, {
          target: url.searchParams.get("target") ?? "laravel",
          module: url.searchParams.get("module") || null,
          failOnCoupling: url.searchParams.get("fail_on_coupling") !== "false",
        }));
        return;
      }

      serveStaticUi(url.pathname, response);
    } catch (error) {
      sendJson(response, {
        error: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  });
}

export function listenArchitectureServer(config) {
  const server = createArchitectureServer(config);
  const host = config.server.host ?? "127.0.0.1";
  const port = Number(config.server.port ?? 4590);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve({ server, host, port });
    });
  });
}

function serveStaticUi(urlPath, response) {
  if (!existsSync(uiDist)) {
    sendHtml(response, missingBuildHtml());
    return;
  }

  const requestedPath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = requestedPath === "/" ? path.join(uiDist, "index.html") : path.join(uiDist, requestedPath);
  const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : path.join(uiDist, "index.html");

  if (!existsSync(file)) {
    sendHtml(response, missingBuildHtml());
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypeFor(file),
  });
  createReadStream(file).pipe(response);
}

function sendJson(response, payload, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, html, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function contentTypeFor(file) {
  const extension = path.extname(file);

  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
  }[extension] ?? "application/octet-stream";
}

function missingBuildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chango Architecture</title>
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #020617; color: #e2e8f0; display: grid; min-height: 100vh; place-items: center; }
      main { max-width: 680px; padding: 32px; }
      code { color: #93c5fd; }
    </style>
  </head>
  <body>
    <main>
      <h1>Chango Architecture</h1>
      <p>The API is running. Build the UI with <code>npm run build:ui</code> from the package directory, or use <code>npm run dev:ui</code> while editing React Flow components.</p>
    </main>
  </body>
</html>`;
}
