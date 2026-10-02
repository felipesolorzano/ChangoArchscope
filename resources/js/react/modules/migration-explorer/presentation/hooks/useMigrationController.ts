import { useCallback, useEffect, useState } from "react";

import type { MigrationExplorerDependencies } from "../../infrastructure/factory/createMigrationExplorerDependencies";
import type { BoundedContextMap, LayerKey } from "../../domain/value-objects/BoundedContextMap";
import type { MigrationView } from "../../infrastructure/react-flow/mapToFlow";

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

// Mapa cargado del backend, con guardado optimista.
function useBoundedContextMap(dependencies: MigrationExplorerDependencies) {
  const [map, setMap] = useState<BoundedContextMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    dependencies.mapProvider
      .getMap()
      .then((loaded) => active && setMap(loaded))
      .catch((caught) => active && setError(errorMessage(caught, "Error inesperado")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dependencies.mapProvider]);

  const persist = useCallback(
    async (next: BoundedContextMap) => {
      setMap(next); // optimista
      try {
        setMap(await dependencies.mapProvider.saveMap(next));
      } catch (caught) {
        setError(errorMessage(caught, "No se pudo guardar"));
      }
    },
    [dependencies.mapProvider],
  );

  return { map, loading, error, persist };
}

// Navegacion entre la vista general y la de un modulo.
function useMigrationNavigation() {
  const [view, setView] = useState<MigrationView>("overview");
  const [focus, setFocus] = useState<string | null>(null);

  const drillTo = useCallback((key: string) => {
    setView("module");
    setFocus(key);
  }, []);

  const back = useCallback(() => {
    setView("overview");
    setFocus(null);
  }, []);

  return { view, focus, drillTo, back };
}

export function useMigrationController(dependencies: MigrationExplorerDependencies) {
  const { map, loading, error, persist } = useBoundedContextMap(dependencies);
  const navigation = useMigrationNavigation();

  const moveFile = useCallback(
    (moduleKey: string, fromLayer: LayerKey, path: string, toLayer: LayerKey) => {
      if (map !== null && fromLayer !== toLayer) {
        void persist(applyMoveFile(map, moduleKey, fromLayer, path, toLayer));
      }
    },
    [map, persist],
  );

  const toggleValidated = useCallback(
    (moduleKey: string) => {
      if (map !== null) {
        void persist(toggleModuleValidated(map, moduleKey));
      }
    },
    [map, persist],
  );

  return { map, loading, error, ...navigation, moveFile, toggleValidated };
}

export function toggleModuleValidated(map: BoundedContextMap, moduleKey: string): BoundedContextMap {
  return {
    ...map,
    modules: map.modules.map((module) => (module.key === moduleKey ? { ...module, validated: !module.validated } : module)),
  };
}

export function applyMoveFile(
  map: BoundedContextMap,
  moduleKey: string,
  fromLayer: LayerKey,
  path: string,
  toLayer: LayerKey,
): BoundedContextMap {
  return {
    ...map,
    modules: map.modules.map((module) => {
      const moved = module.key === moduleKey ? module.layers[fromLayer].find((file) => file.path === path) : undefined;
      if (moved === undefined) {
        return module;
      }
      return {
        ...module,
        layers: {
          ...module.layers,
          [fromLayer]: module.layers[fromLayer].filter((file) => file.path !== path),
          [toLayer]: [...module.layers[toLayer], moved],
        },
      };
    }),
  };
}
