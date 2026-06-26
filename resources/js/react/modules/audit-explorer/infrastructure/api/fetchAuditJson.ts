export async function fetchAuditJson<T>(url: URL, errorMessage: string): Promise<T> {
  const response = await fetch(url.toString(), {
    // Endpoint de datos vivos: nunca servir una respuesta cacheada por el navegador, asi un
    // refresco tras editar archivos siempre trae el snapshot recalculado.
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${errorMessage} (${response.status})`);
  }

  return response.json();
}
