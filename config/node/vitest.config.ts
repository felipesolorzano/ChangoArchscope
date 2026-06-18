import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(configDirectory, "../..");
const appRoot = resolve(projectRoot, "app");

export default defineConfig({
  root: appRoot,
  cacheDir: resolve(projectRoot, "node_modules/.vite/chango-archscope-node-test"),
  test: {
    include: ["../tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.stryker-tmp/**",
      "../../.stryker-tmp/**",
    ],
  },
});
