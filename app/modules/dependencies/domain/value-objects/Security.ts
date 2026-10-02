export type Severity = "critical" | "high" | "moderate" | "low" | "unknown";

/** Tramo afectado: desde `introduced` ("0" = el inicio) hasta antes de `fixed` o hasta `lastAffected`. */
export type AffectedRange = { introduced: string; fixed: string | null; lastAffected: string | null };

/** Advisory de OSV ya reducido al paquete consultado. */
export type Advisory = {
  id: string;
  aliases: string[];
  summary: string;
  severity: Severity;
  ranges: AffectedRange[];
  versions: string[];
};

/** Ciclo de vida de un producto segun endoflife.date. `eol`/`support`: fecha o booleano. */
export type SupportCycle = {
  cycle: string;
  latest: string | null;
  releaseDate: string | null;
  eol: string | boolean;
  support: string | boolean | null;
};

export type Vulnerability = { id: string; cve: string | null; summary: string; severity: Severity; fixedIn: string | null };

export type SecurityAssessment = { vulnerabilities: Vulnerability[]; maxSeverity: Severity | null; recommendedAffected: boolean };

export type SupportStatus = { product: string; cycle: string; eol: string | boolean; isEol: boolean; latestInCycle: string | null };
