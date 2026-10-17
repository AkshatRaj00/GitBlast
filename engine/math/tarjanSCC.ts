import { FileNode } from '@/types/graph.types';

export function findCircularDependencies(nodes: Record<string, FileNode>): string[][] {
  let index = 0;
  const indices: Record<string, number> = {};
  const lowlink: Record<string, number> = {};
  const onStack = new Set<string>();
  const stack: string[] = [];
  const circularGroups: string[][] = [];

  function strongConnect(u: string) {
    indices[u] = index;
    lowlink[u] = index;
    index++;
    stack.push(u);
    onStack.add(u);

    const node = nodes[u];
    if (node) {
      for (const v of node.imports) {
        if (!nodes[v]) continue;
        if (indices[v] === undefined) {
          strongConnect(v);
          lowlink[u] = Math.min(lowlink[u], lowlink[v]);
        } else if (onStack.has(v)) {
          lowlink[u] = Math.min(lowlink[u], indices[v]);
        }
      }
    }

    if (lowlink[u] === indices[u]) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== u);

      if (scc.length > 1) {
        circularGroups.push(scc);
      }
    }
  }

  for (const id of Object.keys(nodes)) {
    if (indices[id] === undefined) strongConnect(id);
  }
  return circularGroups;
}
