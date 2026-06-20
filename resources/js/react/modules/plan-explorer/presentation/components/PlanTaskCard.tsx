import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { PlanGraphNode } from "../../domain/value-objects/PlanGraph";
import { PLAN_STATE_OPTIONS, stateColor } from "../constants/planView";
import { usePlanInteractionsStore } from "../store/planInteractionsStore";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function PlanTaskCard({ data }: NodeProps) {
  const task = data as unknown as PlanGraphNode;
  const color = stateColor(task.state);
  const setTaskState = usePlanInteractionsStore((state) => state.setTaskState);

  return (
    <div className="plan-task" style={{ borderColor: color }}>
      <Handle type="target" position={Position.Left} className="plan-task__handle" />

      <div className="plan-task__head">
        <span className="plan-task__category">{task.category}</span>
        {task.metric > 0 && <span className="plan-task__metric">{formatNumber(task.metric)}</span>}
      </div>
      <div className="plan-task__title">{task.title}</div>
      <p className="plan-task__desc">{task.description}</p>

      <div className="plan-task__states">
        {PLAN_STATE_OPTIONS.map((option) => (
          <button
            key={option.state}
            type="button"
            className={`plan-task__state${task.state === option.state ? " plan-task__state--active" : ""}`}
            style={task.state === option.state ? { background: stateColor(option.state), borderColor: stateColor(option.state) } : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setTaskState(task.id, option.state);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Handle type="source" position={Position.Right} className="plan-task__handle" />
    </div>
  );
}
