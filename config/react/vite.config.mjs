import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(configDirectory, "../..");
const reactRoot = resolve(projectRoot, "resources/js/react");

export default defineConfig({
  plugins: [react()],
  root: reactRoot,
  cacheDir: resolve(projectRoot, "node_modules/.vite/chango-archscope-react"),
  build: {
    outDir: resolve(projectRoot, "public/build"),
    emptyOutDir: true,
  },
  server: {
    port: 4591,
    proxy: {
      "/graph.json": "http://localhost:4590",
      "/check.json": "http://localhost:4590",
    },
  },
});
