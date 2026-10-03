import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";

export type CodemodTarget = "laravel" | "react";

/** De donde salen los datos: snapshot cacheado del audit y raiz del stack. */
export type CodemodSources = {
  snapshots: { getSnapshot(target: CodemodTarget): Promise<AuditSnapshot> };
  rootOf: (target: CodemodTarget) => string;
};
