// Ciclos de imports entre archivos: componentes fuertemente conexos (Tarjan iterativo, sin
// recursion) con mas de un archivo, o un archivo que se importa a si mismo.
export function findImportCycles(nodes, edges) {
    const graph = fileGraph(nodes, edges);
    return stronglyConnected(graph)
        .filter((component) => component.length > 1 || targetsOf(graph.adjacency, component[0]).includes(component[0]))
        .map((component) => toCycle(component, graph))
        .sort((a, b) => b.files.length - a.files.length || a.files[0].localeCompare(b.files[0]));
}
function fileGraph(nodes, edges) {
    const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.id, node]));
    const adjacency = new Map([...files.keys()].map((id) => [id, []]));
    const lines = new Map();
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
    const pathOf = (id) => files.get(id).path;
    for (const targets of adjacency.values()) {
        targets.sort((a, b) => pathOf(a).localeCompare(pathOf(b)));
    }
    return { nodes: files, adjacency, lines };
}
// Todo archivo tiene su lista (vacia si no importa nada).
function targetsOf(adjacency, id) {
    return adjacency.get(id);
}
function stronglyConnected({ nodes, adjacency }) {
    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    // Stryker disable next-line ArrayDeclaration: el fondo de la pila nunca se alcanza (cada componente se saca hasta su raiz), mutante equivalente.
    const stack = [];
    const components = [];
    let counter = 0;
    for (const root of nodes.keys()) {
        if (index.has(root)) {
            continue;
        }
        // Pila de trabajo: [nodo, siguiente vecino a visitar].
        const work = [[root, 0]];
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
                }
                else if (onStack.has(target)) {
                    low.set(node, Math.min(low.get(node), index.get(target)));
                }
                continue;
            }
            work.pop();
            if (work.length > 0) {
                const parent = work[work.length - 1][0];
                low.set(parent, Math.min(low.get(parent), low.get(node)));
            }
            if (low.get(node) === index.get(node)) {
                const component = [];
                let member;
                do {
                    member = stack.pop();
                    onStack.delete(member);
                    component.push(member);
                } while (member !== node);
                components.push(component);
            }
        }
    }
    return components;
}
function toCycle(component, graph) {
    const node = (id) => graph.nodes.get(id);
    const ordered = [...component].sort((a, b) => node(a).path.localeCompare(node(b).path));
    const ids = shortestLoop(ordered[0], graph.adjacency);
    const modules = [...new Set(component.map((id) => node(id).module))].sort();
    return {
        files: ordered.map((id) => node(id).path),
        path: ids.map((id) => node(id).path),
        modules,
        crossModule: modules.length > 1,
        line: graph.lines.get(`${ids[0]}|${ids[1]}`),
    };
}
// Recorrido mas corto de `start` de vuelta a `start` (BFS). Todo camino de vuelta ya esta dentro del
// componente, y `start` esta en un ciclo: el BFS siempre lo encuentra.
function shortestLoop(start, adjacency) {
    const parent = new Map();
    const queue = [];
    for (let current = start;; current = queue.shift()) {
        for (const target of targetsOf(adjacency, current)) {
            if (target === start) {
                const chain = [];
                for (let step = current; step !== start; step = parent.get(step)) {
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
