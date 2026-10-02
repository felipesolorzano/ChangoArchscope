// Adaptador de la URL del navegador: el unico lugar del modulo `app` que toca window.location/history.
// Sin `window` (render en servidor o tests) la busqueda es vacia.
export const browserLocation = {
  search(): string {
    return typeof window === "undefined" ? "" : window.location.search;
  },
  replaceSearch(search: string): void {
    window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  },
};
