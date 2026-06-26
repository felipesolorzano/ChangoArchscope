import type { AuditSnapshot } from "../../domain/value-objects/AuditSnapshot.js";

export type AuditSnapshotCache = {
  resolve(key: string, fingerprint: string, compute: () => Promise<AuditSnapshot>): Promise<AuditSnapshot>;
};

type CacheEntry = { fingerprint: string; pending: Promise<AuditSnapshot> };

/**
 * Cache en memoria del AuditSnapshot completo, invalidado por fingerprint del repo.
 * Puro (sin I/O): la clave es la identidad logica de la consulta y el fingerprint decide
 * si lo guardado sigue vigente. Guarda el Promise en vuelo (no el valor) para que requests
 * concurrentes compartan un solo computo, y no cachea rechazos.
 */
export function createAuditSnapshotCache(): AuditSnapshotCache {
  const entries = new Map<string, CacheEntry>();

  return {
    resolve(key, fingerprint, compute) {
      const existing = entries.get(key);
      if (existing !== undefined && existing.fingerprint === fingerprint) {
        return existing.pending;
      }

      const entry: CacheEntry = { fingerprint, pending: compute() };
      entries.set(key, entry);

      // Si el computo falla, no dejar el rechazo cacheado: el proximo request reintenta.
      // Se compara la identidad del entry para no borrar una entrada mas nueva que otro
      // request ya haya puesto bajo el mismo key mientras esta corria.
      entry.pending.catch(() => {
        if (entries.get(key) === entry) {
          entries.delete(key);
        }
      });

      return entry.pending;
    },
  };
}
