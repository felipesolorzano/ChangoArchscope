import type { PhpCompatibilityIssue } from "../value-objects/PhpCompatibilityIssue.js";

export type PhpCompatibilityScanResult =
  | { status: "ok"; targetPhp: string; issues: PhpCompatibilityIssue[] }
  | { status: "unavailable"; reason: string };

export type PhpCompatibilityScanner = {
  scan(repoPath: string, targetPhp: string, extensions: string[]): Promise<PhpCompatibilityScanResult>;
};
