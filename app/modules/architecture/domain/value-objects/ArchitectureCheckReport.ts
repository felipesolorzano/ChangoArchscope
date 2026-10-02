import type { ImportCycle } from "../services/importCycles.js";

export type ArchitectureIssue = {
  module: string;
  layer: string | null;
  file: string;
  line: number;
  import: string;
  message: string;
  suggestion?: string;
  target_module?: string;
  assessment?: string;
  recommendation?: string;
  action?: string;
};

export type ModuleCheckReport = {
  module: string;
  module_path: string;
  passed: boolean;
  files_scanned: number;
  violations_count: number;
  couplings_count: number;
  violations: ArchitectureIssue[];
  couplings: ArchitectureIssue[];
};

export type ArchitectureCheckSummary = {
  modules: number;
  files_scanned: number;
  violations_count: number;
  couplings_count: number;
};

/** Ciclo de imports con la ruta absoluta de su primer archivo (ancla del hallazgo de auditoria). */
export type CheckedImportCycle = ImportCycle & { file: string };

export type ArchitectureCheckResult = {
  checked_at: string;
  target: string;
  module: string | null;
  fail_on_coupling: boolean;
  passed: boolean;
  summary: ArchitectureCheckSummary;
  reports: ModuleCheckReport[];
  cycles?: CheckedImportCycle[];
};
