export interface ArchitectureCheckIssue {
  module: string;
  layer: string;
  file: string;
  line: number;
  import: string;
  message: string;
  suggestion: string;
  target_module?: string;
  assessment?: string;
  recommendation?: string;
  action?: string;
}

export interface ArchitectureCheckReport {
  module: string;
  module_path: string;
  passed: boolean;
  files_scanned: number;
  violations_count: number;
  couplings_count: number;
  violations: ArchitectureCheckIssue[];
  couplings: ArchitectureCheckIssue[];
}

export interface ArchitectureCheck {
  checked_at: string;
  target?: "laravel" | "react";
  module: string | null;
  fail_on_coupling: boolean;
  passed: boolean;
  summary: {
    modules: number;
    files_scanned: number;
    violations_count: number;
    couplings_count: number;
  };
  reports: ArchitectureCheckReport[];
}
