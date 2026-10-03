import { codemodCandidates } from "../../domain/services/codemodCandidates.js";
// Candidatos a codemod del snapshot (un snapshot cacheado antes de X5 no trae testedBy).
export function buildCodemodPlan({ snapshot, sourceRoot, stack }) {
    return { candidates: codemodCandidates({ stack, sourceRoot, findings: snapshot.findings, testedBy: snapshot.testedBy ?? {} }) };
}
