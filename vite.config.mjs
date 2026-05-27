import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/ui",
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
