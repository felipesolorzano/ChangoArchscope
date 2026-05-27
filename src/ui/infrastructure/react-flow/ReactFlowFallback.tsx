import React from "react";

export enum MarkerType {
  ArrowClosed = "arrowclosed",
}

export enum Position {
  Left = "left",
  Right = "right",
  Top = "top",
  Bottom = "bottom",
}

export interface Node<T = Record<string, unknown>> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
  draggable?: boolean;
  selected?: boolean;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  markerEnd?: { type: MarkerType };
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

export interface NodeProps {
  data: unknown;
}

interface HandleProps {
  type: "source" | "target";
  position: Position;
  className?: string;
}

export function Handle({ className }: HandleProps) {
  return <span className={className} />;
}

interface ReactFlowProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes?: Record<string, React.ComponentType<NodeProps>>;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  children?: React.ReactNode;
}

export function ReactFlow({ nodes, edges, nodeTypes = {}, onNodeClick, children }: ReactFlowProps) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(1200, ...nodes.map((node) => node.position.x + 280));
  const height = Math.max(800, ...nodes.map((node) => node.position.y + 140));

  return (
    <div className="architecture-flow-fallback">
      <div className="architecture-flow-fallback__space" style={{ width, height }}>
        <svg className="architecture-flow-fallback__edges" width={width} height={height}>
          <defs>
            <marker id="architecture-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);

            if (!source || !target) {
              return null;
            }

            const x1 = source.position.x + 210;
            const y1 = source.position.y + 32;
            const x2 = target.position.x;
            const y2 = target.position.y + 32;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={edge.style?.stroke ?? "#64748b"}
                  strokeWidth={Number(edge.style?.strokeWidth ?? 1.2)}
                  markerEnd="url(#architecture-arrow)"
                />
                {edge.label && (
                  <text x={midX} y={midY - 6} fill={(edge.labelStyle?.fill as string) ?? "#cbd5e1"} fontSize="11">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const NodeComponent = nodeTypes[node.type ?? ""] ?? DefaultNode;

          return (
            <div
              className={`architecture-flow-fallback__node${node.selected ? " selected" : ""}`}
              key={node.id}
              onClick={(event) => onNodeClick?.(event, node)}
              style={{ left: node.position.x, top: node.position.y }}
            >
              <NodeComponent data={node.data} />
            </div>
          );
        })}

        {children}
      </div>
    </div>
  );
}

function DefaultNode({ data }: NodeProps) {
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

export function Background(_props: Record<string, unknown>) {
  return null;
}

export function Controls(_props: Record<string, unknown>) {
  return null;
}

export function MiniMap(_props: Record<string, unknown>) {
  return null;
}
