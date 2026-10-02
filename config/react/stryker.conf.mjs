export default {
  packageManager: "npm",
  testRunner: "vitest",
  coverageAnalysis: "off",
  mutate: [
    "resources/js/react/modules/architecture-explorer/presentation/utils/filterArchitectureGraph.ts",
    "resources/js/react/modules/app/domain/projectTarget.ts",
    "resources/js/react/modules/audit-explorer/presentation/constants/auditCategories.ts",
    "resources/js/react/modules/migration-explorer/infrastructure/react-flow/fileCardHeight.ts",
    "resources/js/react/modules/architecture-explorer/infrastructure/react-flow/architectureFlowMapping.ts",
    "resources/js/react/modules/architecture-explorer/infrastructure/react-flow/architectureFlowLayout.ts",
    "resources/js/react/modules/architecture-explorer/presentation/utils/selectedNodeFor.ts",
    "resources/js/react/modules/dependencies-explorer/presentation/utils/dependencyView.ts",
    "!resources/js/react/tests/**/*.test.{ts,tsx}",
  ],
  vitest: {
    configFile: "config/react/vitest.config.mjs",
  },
  reporters: ["progress", "clear-text", "html"],
  thresholds: {
    high: 80,
    low: 70,
    break: 70,
  },
  htmlReporter: {
    fileName: "resources/js/react/reports/mutation/index.html",
  },
};
