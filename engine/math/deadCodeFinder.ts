import { FileNode } from '@/types/graph.types';

const ENTRY_PATTERNS = [
  /(^|\/)(index|main|app|page|layout|route|server|cli|lib)\.(ts|tsx|js|jsx|py|go|cpp|c|rs|java|kt|cs)$/i,
  /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|kt|cs)$/i,
  /\.config\.(ts|js|mjs|cjs)$/i,
  /(^|\/)(package|vite|next|webpack|rollup|jest|vitest)\.config\./i,
];

export function detectDeadFiles(nodes: Record<string, FileNode>): string[] {
  const isolatedCandidates: string[] = [];
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    const isEntry = ENTRY_PATTERNS.some((pattern) => pattern.test(id));
    node.isEntryPoint = isEntry;
    // Only fully isolated modules are candidates; lack of importers alone is not proof of dead code.
    node.isDeadCode = node.inDegree === 0 && node.outDegree === 0 && !isEntry;
    if (node.isDeadCode) isolatedCandidates.push(id);
  }
  return isolatedCandidates;
}