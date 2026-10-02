// "page.checkout" → "PageCheckout" (nombre de componente para un `export default` anonimo).
export function pascalCase(stem: string): string {
  return stem
    .split(/[^A-Za-z0-9]/)
    .filter((part) => part !== "")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}
