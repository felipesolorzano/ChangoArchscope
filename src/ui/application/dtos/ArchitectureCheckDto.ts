import type { ArchitectureCheck } from "../../domain/value-objects/ArchitectureCheck";

export interface ArchitectureCheckIssueDto {
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

export interface ArchitectureCheckReportDto {
  module: string;
  module_path: string;
  passed: boolean;
  files_scanned: number;
  violations_count: number;
  couplings_count: number;
  violations: ArchitectureCheckIssueDto[];
  couplings: ArchitectureCheckIssueDto[];
}

export interface ArchitectureCheckDto {
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
  reports: ArchitectureCheckReportDto[];
}

export function toArchitectureCheck(dto: ArchitectureCheckDto): ArchitectureCheck {
  return {
    checked_at: dto.checked_at,
    target: dto.target,
    module: dto.module,
    fail_on_coupling: dto.fail_on_coupling,
    passed: dto.passed,
    summary: {
      modules: dto.summary.modules,
      files_scanned: dto.summary.files_scanned,
      violations_count: dto.summary.violations_count,
      couplings_count: dto.summary.couplings_count,
    },
    reports: dto.reports.map((report) => ({
      module: report.module,
      module_path: report.module_path,
      passed: report.passed,
      files_scanned: report.files_scanned,
      violations_count: report.violations_count,
      couplings_count: report.couplings_count,
      violations: report.violations.map((issue) => ({ ...issue })),
      couplings: report.couplings.map((issue) => ({ ...issue })),
    })),
  };
}
