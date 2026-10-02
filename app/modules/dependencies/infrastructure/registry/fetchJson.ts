export type FetchInit = { method: "POST"; body: unknown };

export type FetchJson = (url: string, init?: FetchInit) => Promise<{ status: number; body: unknown }>;

const TIMEOUT_MS = 20_000;

// I/O de red real (fuera de mutation): el resto de los adaptadores se prueba con un fetchJson falso.
export const fetchJson: FetchJson = async (url, init) => {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", ...(init ? { "content-type": "application/json" } : {}) },
  });
  const ok = response.status >= 200 && response.status < 300;

  return { status: response.status, body: ok ? await response.json() : null };
};
