import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";
import { codemodCandidates } from "../../domain/services/codemodCandidates.js";
import type { CodemodCandidate, CodemodStack } from "../../domain/value-objects/Codemod.js";

export type CodemodPlan = { candidates: CodemodCandidate[] };

export type BuildCodemodInput = { snapshot: AuditSnapshot; sourceRoot: string; stack: CodemodStack };

// Candidatos a codemod del snapshot (un snapshot cacheado antes de X5 no trae testedBy).
export function buildCodemodPlan({ snapshot, sourceRoot, stack }: BuildCodemodInput): CodemodPlan {
  return { candidates: codemodCandidates({ stack, sourceRoot, findings: snapshot.findings, testedBy: snapshot.testedBy ?? {} }) };
}
