import type { ProtectionBaseline } from "../../domain/value-objects/Protection";
import { useCharacterizationStore } from "../store/characterizationStore";
import { protectionLevelColor, protectionLevelLabel, protectionParts } from "../constants/protectionView";

// XRay X3: cuanta red de seguridad hay antes de refactorizar.
export function ProtectionStrip({ protection }: { protection: ProtectionBaseline | null }) {
  const setOpen = useCharacterizationStore((state) => state.setOpen);

  if (protection === null) {
    return null;
  }

  return (
    <div className="plan-protection">
      <span>
        Red de seguridad: <strong style={{ color: protectionLevelColor(protection.level) }}>{protectionLevelLabel(protection.level)}</strong>
      </span>
      {protectionParts(protection).map((part) => (
        <span key={part} className="plan-protection__part">
          {part}
        </span>
      ))}
      <button type="button" className="plan-protection__action" onClick={() => setOpen(true)}>
        Que proteger primero
      </button>
      {protection.level === "none" && <span className="plan-protection__hint">Sin red de seguridad: empezar por tests de caracterizacion</span>}
    </div>
  );
}
