export type PhpCompatibilityIssue = {
  file: string;
  line: number;
  rule: string;
  severityRaw: "error" | "warning";
  message: string;
};
