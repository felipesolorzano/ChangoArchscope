export type ForbiddenImportRule = {
  pattern: string;
  message: string;
  suggestion?: string;
};

export type CouplingRules = {
  enabled: boolean;
  ignoredModules?: string[];
  allowedDependencies?: Record<string, string[]>;
  message: string;
  suggestion: string;
  defaultAssessment: string;
  defaultRecommendation: string;
  defaultAction: string;
};

export type LaravelArchitectureConfig = {
  modulesPath: string;
  namespaceRoot: string;
  layers: string[];
  ignoredPaths: string[];
  forbiddenImports: Record<string, ForbiddenImportRule[]>;
  coupling: CouplingRules;
};

export type ReactArchitectureConfig = {
  modulesPath: string;
  alias: string;
  layers: Record<string, string>;
  forbiddenImports: Record<string, ForbiddenImportRule[]>;
  coupling: CouplingRules;
};

export type ArchitectureServerConfig = {
  host: string;
  port: number;
};

export type ArchitectureConfig = {
  laravel: LaravelArchitectureConfig;
  react: ReactArchitectureConfig;
  server: ArchitectureServerConfig;
};
