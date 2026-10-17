import { BlastWave, FileNode } from '@/types/graph.types';

export interface CausalPathTrace {
  targetFileId: string;
  sourceFileId: string;
  path: string[]; // Chain: [source, dep1, dep2, target]
  depth: number;
}

export interface MultiFileBlastReport {
  selectedFileIds: string[];
  totalImpactedCount: number;
  blastPercentage: number;
  waves: BlastWave[];
  impactedFileMap: Record<string, number>;
  crossfireFiles: string[]; // Files broken by multiple modified files
  causalPaths: Record<string, string[]>; // targetId -> [source, intermediate, target]
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  qualityGate: {
    breakingApiSurface: boolean;
    highCentralityRisk: boolean;
    circularDependencyImpact: boolean;
    untestedFilesRatio: number;
    canMergeSafely: boolean;
  };
}

export function calculateMultiFileBlastRadius(
  targetFileIds: string[],
  nodes: Record<string, FileNode>
): MultiFileBlastReport {
  const totalFiles = Object.keys(nodes).length;
  if (!targetFileIds.length || totalFiles <= 1) {
    return {
      selectedFileIds: targetFileIds,
      totalImpactedCount: 0,
      blastPercentage: 0,
      waves: [],
      impactedFileMap: {},
      crossfireFiles: [],
      causalPaths: {},
      severity: 'LOW',
      qualityGate: {
        breakingApiSurface: false,
        highCentralityRisk: false,
        circularDependencyImpact: false,
        untestedFilesRatio: 0,
        canMergeSafely: true,
      },
    };
  }

  const visited = new Set<string>(targetFileIds);
  const impactedFileMap: Record<string, number> = {};
  const fileHitCount: Record<string, number> = {};
  const causalParentMap: Record<string, string> = {}; // child -> parent
  const waves: BlastWave[] = [];

  targetFileIds.forEach((id) => {
    const node = nodes[id];
    if (node) {
      node.importedBy.forEach((dep) => {
        fileHitCount[dep] = (fileHitCount[dep] || 0) + 1;
      });
    }
  });

  let currentFrontier = [...targetFileIds];
  let depth = 1;

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const fid of currentFrontier) {
      const node = nodes[fid];
      if (!node) continue;

      for (const depId of node.importedBy) {
        if (!visited.has(depId) && nodes[depId]) {
          visited.add(depId);
          nextFrontier.push(depId);
          impactedFileMap[depId] = depth;
          if (!causalParentMap[depId]) {
            causalParentMap[depId] = fid;
          }
        }
      }
    }
    if (nextFrontier.length > 0) {
      waves.push({ waveIndex: depth, fileIds: nextFrontier });
      depth++;
    }
    currentFrontier = nextFrontier;
  }

  // Reconstruct Causal Path chains: target -> source
  const causalPaths: Record<string, string[]> = {};
  Object.keys(impactedFileMap).forEach((impactedId) => {
    const chain: string[] = [impactedId];
    let curr = impactedId;
    while (causalParentMap[curr]) {
      const p = causalParentMap[curr];
      chain.unshift(p);
      curr = p;
    }
    causalPaths[impactedId] = chain;
  });

  const crossfireFiles = Object.keys(fileHitCount).filter((fid) => fileHitCount[fid] > 1);
  const totalImpacted = Object.keys(impactedFileMap).length;
  const denominator = Math.max(1, totalFiles - targetFileIds.length);
  const blastPct = Number(((totalImpacted / denominator) * 100).toFixed(1));

  // Enterprise Quality Gate Metrics
  const isHighCentrality = targetFileIds.some((id) => (nodes[id]?.pageRank || 0) >= 0.55);
  const isCircular = targetFileIds.some((id) => nodes[id]?.circularGroupId !== null);
  const testedCount = Object.keys(impactedFileMap).filter((id) => id.includes('.test.') || id.includes('.spec.')).length;
  const untestedRatio = totalImpacted > 0 ? Number((1 - testedCount / totalImpacted).toFixed(2)) : 0;

  let severity: MultiFileBlastReport['severity'] = 'LOW';
  if (blastPct >= 35 || crossfireFiles.length >= 3) severity = 'CRITICAL';
  else if (blastPct >= 18) severity = 'HIGH';
  else if (blastPct >= 6) severity = 'MODERATE';

  const canMergeSafely = severity === 'LOW' && !isHighCentrality && !isCircular;

  return {
    selectedFileIds: targetFileIds,
    totalImpactedCount: totalImpacted,
    blastPercentage: blastPct,
    waves,
    impactedFileMap,
    crossfireFiles,
    causalPaths,
    severity,
    qualityGate: {
      breakingApiSurface: totalImpacted > 5,
      highCentralityRisk: isHighCentrality,
      circularDependencyImpact: isCircular,
      untestedFilesRatio: untestedRatio,
      canMergeSafely,
    },
  };
}
