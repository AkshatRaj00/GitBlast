import { FileNode } from '@/types/graph.types';

export function computeGraphPageRank(
  nodes: Record<string, FileNode>,
  damping: number = 0.85,
  iterations: number = 40
): Record<string, number> {
  const ids = Object.keys(nodes);
  const N = ids.length;
  if (N === 0) return {};

  let ranks: Record<string, number> = {};
  ids.forEach(id => (ranks[id] = 1 / N));

  for (let it = 0; it < iterations; it++) {
    const nextRanks: Record<string, number> = {};
    let danglingMass = 0;

    for (const id of ids) {
      if (nodes[id].imports.length === 0) danglingMass += ranks[id];
      nextRanks[id] = (1 - damping) / N;
    }

    const shareDangling = (damping * danglingMass) / N;

    for (const id of ids) {
      nextRanks[id] += shareDangling;
      const outDeg = nodes[id].imports.length;
      if (outDeg > 0) {
        const share = (damping * ranks[id]) / outDeg;
        for (const target of nodes[id].imports) {
          if (nextRanks[target] !== undefined) nextRanks[target] += share;
        }
      }
    }
    ranks = nextRanks;
  }

  let maxR = 0;
  ids.forEach(id => { if (ranks[id] > maxR) maxR = ranks[id]; });
  const normalized: Record<string, number> = {};
  ids.forEach(id => {
    normalized[id] = maxR > 0 ? Number((ranks[id] / maxR).toFixed(4)) : 0;
  });
  return normalized;
}
