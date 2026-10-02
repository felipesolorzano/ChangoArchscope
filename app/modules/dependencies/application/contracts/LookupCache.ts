/** Cache de respuestas externas por llave (con su fecha) para no repetir consultas. */
export type LookupCache<T> = {
  get(key: string): { value: T; fetchedAt: string } | null;
  set(key: string, value: T, fetchedAt: string): void;
};
