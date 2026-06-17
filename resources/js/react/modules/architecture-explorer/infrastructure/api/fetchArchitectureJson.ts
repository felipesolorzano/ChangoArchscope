export async function fetchArchitectureJson<T>(url: URL, errorMessage: string): Promise<T> {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${errorMessage} (${response.status})`);
  }

  return response.json();
}
