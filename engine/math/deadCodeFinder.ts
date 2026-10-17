import { FileNode } from '@/types/graph.types';

const ENTRY_PATTERNS = [
  /(^|\/)(index|main|app|page|layout|route|server)\.(ts|tsx|js|jsx|py|go|cpp)$/i,
  /\.(test|spec)\.(ts|tsx|js|jsx|py)$/i,
  /\.config\.(ts|js|mjs)$/i
];

export function detectDeadFiles(nodes: Record<string, FileNode>): string[] {
  const dead: string[] = [];
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    const isEntry = ENTRY_PATTERNS.some(r => r.test(id));
    node.isEntryPoint = isEntry;
    if (node.inDegree === 0 && !isEntry) {
      node.isDeadCode = true;
      dead.push(id);
    } else {
      node.isDeadCode = false;
    }
  }
  return dead;
}
