// Adaptador de navegador: copia un texto al portapapeles.
export function copyText(text: string): void {
  void navigator.clipboard.writeText(text);
}
