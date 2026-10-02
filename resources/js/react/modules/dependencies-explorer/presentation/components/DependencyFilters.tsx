import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";

export function DependencyFilters() {
  const { query, hideDev, setQuery, setHideDev } = useDependenciesExplorerStore();

  return (
    <div className="deps-filters">
      <input className="deps-filters__search" type="search" placeholder="Buscar paquete…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <label className="deps-filters__dev">
        <input type="checkbox" checked={hideDev} onChange={(event) => setHideDev(event.target.checked)} />
        Ocultar dev
      </label>
    </div>
  );
}
