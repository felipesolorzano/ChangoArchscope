import { useCallback, useEffect, useState } from "react";

import type { MigrationExplorerDependencies } from "../../infrastructure/factory/createMigrationExplorerDependencies";
import type { BoundedContextMap, LayerKey } from "../../domain/value-objects/BoundedContextMap";
import type { MigrationView } from "../../infrastructure/react-flow/mapToFlow";

export function useMigrationController(dependencies: MigrationExplorerDependencies) {
  const [map, setMap] = useState<BoundedContextMap | null>(null);
  const [view, setView] = useState<MigrationView>("overview");
  const [focus, setFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await dependencies.mapProvider.getMap();
        if (active) {
          setMap(loaded);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Error inesperado");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
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
        setError(caught instanceof Error ? caught.message : "No se pudo guardar");
      }
    },
    [dependencies.mapProvider],
  );

  const drillTo = useCallback((key: string) => {
    setView("module");
    setFocus(key);
  }, []);

  const back = useCallback(() => {
    setView("overview");
    setFocus(null);
  }, []);

  const moveFile = useCallback(
    (moduleKey: string, fromLayer: LayerKey, path: string, toLayer: LayerKey) => {
      if (map === null || fromLayer === toLayer) {
        return;
      }
      void persist(applyMoveFile(map, moduleKey, fromLayer, path, toLayer));
    },
    [map, persist],
  );

  const toggleValidated = useCallback(
    (moduleKey: string) => {
      if (map === null) {
        return;
      }
      void persist({
        ...map,
        modules: map.modules.map((module) =>
          module.key === moduleKey ? { ...module, validated: !module.validated } : module,
        ),
      });
    },
    [map, persist],
  );

  return { map, view, focus, loading, error, drillTo, back, moveFile, toggleValidated };
}

function applyMoveFile(
  map: BoundedContextMap,
  moduleKey: string,
  fromLayer: LayerKey,
  path: string,
  toLayer: LayerKey,
): BoundedContextMap {
  return {
    ...map,
    modules: map.modules.map((module) => {
      if (module.key !== moduleKey) {
        return module;
      }
      const moved = module.layers[fromLayer].find((file) => file.path === path);
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
