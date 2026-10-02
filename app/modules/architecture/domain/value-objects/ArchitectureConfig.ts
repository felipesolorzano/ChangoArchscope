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
  /** Ignora archivos/carpetas ocultos (nombre con `.`); default true. Ver normalizeConfig. */
  ignoreHidden?: boolean;
  phpExtensions: string[];
  forbiddenImports: Record<string, ForbiddenImportRule[]>;
  coupling: CouplingRules;
};

export type ReactArchitectureConfig = {
  modulesPath: string;
  alias: string;
  layers: Record<string, string>;
  /** Arbol plano legacy: carpetas de primer nivel de arriba hacia abajo (ver folderOrder.ts). */
  folderOrder?: Array<string | string[]>;
  /** Carpetas de tests fuera de modulesPath: el audit las usa solo como evidencia de testing. */
  testPaths?: string[];
  ignoredPaths: string[];
  /** Ignora archivos/carpetas ocultos (nombre con `.`); default true. Ver normalizeConfig. */
  ignoreHidden?: boolean;
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
