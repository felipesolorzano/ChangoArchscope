import { type NodeProps } from "@xyflow/react";
import { Check, Layers } from "lucide-react";

import type { ModuleNodeData } from "../../infrastructure/react-flow/mapToFlow";
import { useMigrationStore } from "../store/migrationStore";

export function BcModuleCard({ data }: NodeProps) {
  const { module, fileCount } = data as unknown as ModuleNodeData;
  const drill = useMigrationStore((state) => state.drill);
  const toggleValidated = useMigrationStore((state) => state.toggleValidated);

  return (
    <div className={`bc-module${module.validated ? " bc-module--ok" : ""}`}>
      <button type="button" className="bc-module__body" onClick={() => drill(module.key)} title="Ver capas y archivos">
        <span className="bc-module__name">{module.name}</span>
        {module.description && <span className="bc-module__desc">{module.description}</span>}
        <span className="bc-module__count">
          <Layers size={13} /> {fileCount} archivos
        </span>
      </button>
      <button
        type="button"
        className={`bc-module__validate${module.validated ? " bc-module__validate--on" : ""}`}
        onClick={() => toggleValidated(module.key)}
      >
        <Check size={12} /> {module.validated ? "Validado" : "Validar"}
      </button>
    </div>
  );
}
