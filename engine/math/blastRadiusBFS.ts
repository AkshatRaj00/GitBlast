import { BlastRadiusReport, BlastWave, FileNode } from '@/types/graph.types';

export function calculateBlastRadius(
  targetFileId: string,
  nodes: Record<string, FileNode>
): BlastRadiusReport {
  const totalFiles = Object.keys(nodes).length;
  const targetNode = nodes[targetFileId];

  if (!targetNode || totalFiles <= 1) {
    return {
      targetFileId, totalImpactedCount: 0, blastPercentage: 0,
      waves: [], impactedFileMap: {}, severity: 'LOW'
    };
  }

  const visited = new Set<string>([targetFileId]);
  const impactedFileMap: Record<string, number> = {};
  const waves: BlastWave[] = [];

  let currentFrontier = [targetFileId];
  let depth = 1;

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const fid of currentFrontier) {
      const node = nodes[fid];
      if (!node) continue;
      // Reverse Graph G^T traversal: who imports fid?
      for (const depId of node.importedBy) {
        if (!visited.has(depId) && nodes[depId]) {
          visited.add(depId);
          nextFrontier.push(depId);
          impactedFileMap[depId] = depth;
        }
      }
    }
    if (nextFrontier.length > 0) {
      waves.push({ waveIndex: depth, fileIds: nextFrontier });
      depth++;
    }
    currentFrontier = nextFrontier;
  }

  const totalImpacted = Object.keys(impactedFileMap).length;
  const blastPct = Number(((totalImpacted / Math.max(1, totalFiles - 1)) * 100).toFixed(1));

  let severity: BlastRadiusReport['severity'] = 'LOW';
  if (blastPct >= 30) severity = 'CRITICAL';
  else if (blastPct >= 15) severity = 'HIGH';
  else if (blastPct >= 5) severity = 'MODERATE';

  return {
    targetFileId, totalImpactedCount: totalImpacted, blastPercentage: blastPct,
    waves, impactedFileMap, severity
  };
}
