import type { ArchitectureEdge, ArchitectureNode } from "../value-objects/ArchitectureGraph.js";

export type ImportCycle = { files: string[]; path: string[]; modules: string[]; crossModule: boolean; line: number };

type FileGraph = { nodes: Map<string, ArchitectureNode>; adjacency: Map<string, string[]>; lines: Map<string, number> };

// Ciclos de imports entre archivos: componentes fuertemente conexos (Tarjan iterativo, sin
// recursion) con mas de un archivo, o un archivo que se importa a si mismo.
export function findImportCycles(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): ImportCycle[] {
  const graph = fileGraph(nodes, edges);

  return stronglyConnected(graph)
    .filter((component) => component.length > 1 || targetsOf(graph.adjacency, component[0]).includes(component[0]))
    .map((component) => toCycle(component, graph))
    .sort((a, b) => b.files.length - a.files.length || a.files[0].localeCompare(b.files[0]));
}

function fileGraph(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): FileGraph {
  const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>([...files.keys()].map((id) => [id, []]));
  const lines = new Map<string, number>();

  for (const edge of edges) {
    if (edge.type !== "import" || !files.has(edge.source) || !files.has(edge.target)) {
      continue;
    }
    const targets = targetsOf(adjacency, edge.source);
    if (!targets.includes(edge.target)) {
      targets.push(edge.target);
      lines.set(`${edge.source}|${edge.target}`, edge.line ?? 1);
    }
  }

  // Vecinos por path: el recorrido elegido es deterministico.
  const pathOf = (id: string) => (files.get(id) as ArchitectureNode).path;
  for (const targets of adjacency.values()) {
    targets.sort((a, b) => pathOf(a).localeCompare(pathOf(b)));
  }

  return { nodes: files, adjacency, lines };
}

// Todo archivo tiene su lista (vacia si no importa nada).
function targetsOf(adjacency: Map<string, string[]>, id: string): string[] {
  return adjacency.get(id) as string[];
}

function stronglyConnected({ nodes, adjacency }: FileGraph): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  // Stryker disable next-line ArrayDeclaration: el fondo de la pila nunca se alcanza (cada componente se saca hasta su raiz), mutante equivalente.
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  for (const root of nodes.keys()) {
    if (index.has(root)) {
      continue;
    }
    // Pila de trabajo: [nodo, siguiente vecino a visitar].
    const work: Array<[string, number]> = [[root, 0]];
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const [node, next] = frame;
      if (next === 0) {
        index.set(node, counter);
        low.set(node, counter);
        counter += 1;
        stack.push(node);
        onStack.add(node);
      }
      const targets = targetsOf(adjacency, node);
      if (next < targets.length) {
        frame[1] += 1;
        const target = targets[next];
        if (!index.has(target)) {
          work.push([target, 0]);
        } else if (onStack.has(target)) {
          low.set(node, Math.min(low.get(node) as number, index.get(target) as number));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(low.get(parent) as number, low.get(node) as number));
      }
      if (low.get(node) === index.get(node)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop() as string;
          onStack.delete(member);
          component.push(member);
        } while (member !== node);
        components.push(component);
      }
    }
  }

  return components;
}

function toCycle(component: string[], graph: FileGraph): ImportCycle {
  const node = (id: string) => graph.nodes.get(id) as ArchitectureNode;
  const ordered = [...component].sort((a, b) => node(a).path.localeCompare(node(b).path));
  const ids = shortestLoop(ordered[0], graph.adjacency);
  const modules = [...new Set(component.map((id) => node(id).module))].sort();

  return {
    files: ordered.map((id) => node(id).path),
    path: ids.map((id) => node(id).path),
    modules,
    crossModule: modules.length > 1,
    line: graph.lines.get(`${ids[0]}|${ids[1]}`) as number,
  };
}

// Recorrido mas corto de `start` de vuelta a `start` (BFS). Todo camino de vuelta ya esta dentro del
// componente, y `start` esta en un ciclo: el BFS siempre lo encuentra.
function shortestLoop(start: string, adjacency: Map<string, string[]>): string[] {
  const parent = new Map<string, string>();
  const queue: string[] = [];

  for (let current = start; ; current = queue.shift() as string) {
    for (const target of targetsOf(adjacency, current)) {
      if (target === start) {
        const chain: string[] = [];
        for (let step = current; step !== start; step = parent.get(step) as string) {
          chain.unshift(step);
        }
        return [start, ...chain, start];
      }
      if (!parent.has(target)) {
        parent.set(target, current);
        queue.push(target);
      }
    }
  }
}
