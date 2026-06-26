import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";

// El plan consume un AuditSnapshot sin saber como se construye. La composition root inyecta
// una implementacion que reusa la maquinaria de `audit`.
export interface AuditSnapshotProvider {
  getSnapshot(target: "laravel" | "react"): Promise<AuditSnapshot>;
}
