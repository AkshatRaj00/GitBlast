import { FileNode } from '@/types/graph.types';

const ENTRY_PATTERNS = [
  /(^|\/)(index|main|app|page|layout|route|server|cli|lib|manage|wsgi|asgi|worker|background)\.(ts|tsx|js|jsx|py|go|cpp|c|rs|java|kt|cs)$/i,
  /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|kt|cs)$/i,
  /(^|\/)[^/]+\.config\.(ts|tsx|js|mjs|cjs|json)$/i,
  /(^|\/)(package|tsconfig|jsconfig|vite|next|webpack|rollup|jest|vitest|eslint|postcss|tailwind)\.config\./i,
  /(^|\/)(package|tsconfig|jsconfig|composer|cargo|go|pyproject|requirements|makefile|dockerfile|procfile)(\.[^/]*)?$/i,
  /(^|\/)(\.github\/workflows|\.gitlab|\.circleci|\.buildkite)(\/|$)/i,
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
