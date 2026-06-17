import { useState } from "react";
import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import { runArchitectureCheck } from "../../application/use-cases/runArchitectureCheck";
import type { ArchitectureCheck } from "../../domain/value-objects/ArchitectureCheck";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";

export function useArchitectureCheckController(dependencies: ArchitectureProviders) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArchitectureCheck | null>(null);

  async function run(module: string, target: ArchitectureTarget) {
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setResult(await runArchitectureCheck(dependencies.checkProvider, module || undefined, target));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ejecutar el check");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return {
    open,
    loading,
    error,
    result,
    run,
    close,
    reset,
  };
}
