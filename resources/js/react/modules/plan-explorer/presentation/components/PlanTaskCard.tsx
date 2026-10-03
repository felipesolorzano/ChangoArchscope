import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { PlanGraphNode, PlanTaskState } from "../../domain/value-objects/PlanGraph";
import { PLAN_STATE_OPTIONS, isStartingState, stateColor } from "../constants/planView";
import { usePlanInteractionsStore } from "../store/planInteractionsStore";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function PlanTaskCard({ data }: NodeProps) {
  const task = data as unknown as PlanGraphNode;
  const color = stateColor(task.state);
  const setTaskState = usePlanInteractionsStore((state) => state.setTaskState);
  const openTask = usePlanInteractionsStore((state) => state.openTask);

  return (
    <div className={taskCardClass(task)} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Left} className="plan-task__handle" />

      <button type="button" className="plan-task__body" onClick={() => openTask(task.id)}>
        {task.next && <span className="plan-task__next">▶ Siguiente paso</span>}
        <div className="plan-task__head">
          <span className="plan-task__category">{task.category}</span>
          {task.metric > 0 && <span className="plan-task__metric">{formatNumber(task.metric)}</span>}
        </div>
        <div className="plan-task__title">{task.title}</div>
        <p className="plan-task__desc">{task.description}</p>
        {task.metric > 0 && <span className="plan-task__link">Ver hallazgos →</span>}
        {task.lockReason && <span className="plan-task__lock">{`🔒 ${task.lockReason}`}</span>}
      </button>

      <TaskStateButtons task={task} onSelect={(state) => setTaskState(task.id, state)} />

      <Handle type="source" position={Position.Right} className="plan-task__handle" />
    </div>
  );
}

// Un boton por estado; si la tarea esta bloqueada (XRay X6), no se puede empezar ni dar por hecha.
function TaskStateButtons({ task, onSelect }: { task: PlanGraphNode; onSelect: (state: PlanTaskState) => void }) {
  return (
    <div className="plan-task__states">
      {PLAN_STATE_OPTIONS.map((option) => {
        const disabled = isStartingState(option.state) && Boolean(task.lockReason);

        return (
          <button
            key={option.state}
            type="button"
            className={`plan-task__state${task.state === option.state ? " plan-task__state--active" : ""}`}
            style={task.state === option.state ? { background: stateColor(option.state), borderColor: stateColor(option.state) } : undefined}
            disabled={disabled}
            title={disabled ? task.lockReason! : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(option.state);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// La recomendada se resalta; una bloqueada se atenua (XRay X6).
function taskCardClass(task: PlanGraphNode): string {
  if (task.next) return "plan-task plan-task--next";
  return task.lockReason ? "plan-task plan-task--locked" : "plan-task";
}
