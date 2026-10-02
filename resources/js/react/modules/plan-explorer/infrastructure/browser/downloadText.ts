// Adaptador de navegador: guarda un texto como archivo (nombre = ultima parte de la ruta).
export function downloadText(path: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = path.split("/").pop() ?? path;
  anchor.click();
  URL.revokeObjectURL(url);
}
