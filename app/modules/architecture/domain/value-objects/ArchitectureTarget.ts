export type ArchitectureTarget = "laravel" | "react";

export type AnalyzeOptions = {
  target?: ArchitectureTarget;
  module?: string | null;
};

export type CheckOptions = AnalyzeOptions & {
  failOnCoupling?: boolean;
};
