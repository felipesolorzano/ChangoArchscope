import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mismo runtime de JSX que la app (tsconfig "jsx": "react-jsx"): los componentes no importan React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["resources/js/react/tests/**/*.test.{ts,tsx}"],
  },
});
