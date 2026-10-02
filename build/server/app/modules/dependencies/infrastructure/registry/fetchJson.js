const TIMEOUT_MS = 20_000;
// I/O de red real (fuera de mutation): el resto del adaptador se prueba con un fetchJson falso.
export const fetchJson = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
    const ok = response.status >= 200 && response.status < 300;
    return { status: response.status, body: ok ? await response.json() : null };
};
