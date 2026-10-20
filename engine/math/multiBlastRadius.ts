import { BlastWave, FileNode } from '@/types/graph.types';

export interface MultiFileBlastReport {
  selectedFileIds: string[];
  totalImpactedCount: number;
  blastPercentage: number;
  waves: BlastWave[];
  impactedFileMap: Record<string, number>;
  crossfireFiles: string[];
  causalPaths: Record<string, string[]>;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  qualityGate: {
    manyImpactedFiles: boolean;
    highCentralityRisk: boolean;
    circularDependencyImpact: boolean;
    testFileNameHeuristicRatio: number;
    lowTopologyRisk: boolean;
  };
}

export function calculateMultiFileBlastRadius(
  targetFileIds: string[],
  nodes: Record<string, FileNode>
): MultiFileBlastReport {
  const uniqueTargets = Array.from(new Set(targetFileIds)).filter((id) => Boolean(nodes[id]));
  const emptyReport = (): MultiFileBlastReport => ({
    selectedFileIds: uniqueTargets,
    totalImpactedCount: 0,
    blastPercentage: 0,
    waves: [],
    impactedFileMap: {},
    crossfireFiles: [],
    causalPaths: {},
    severity: 'LOW',
    qualityGate: {
      manyImpactedFiles: false,
      highCentralityRisk: false,
      circularDependencyImpact: false,
      testFileNameHeuristicRatio: 0,
      lowTopologyRisk: true,
    },
  });

  if (!uniqueTargets.length || Object.keys(nodes).length <= uniqueTargets.length) return emptyReport();

  // Count each selected source's reachable consumers to find true multi-source overlap.
  const sourceHitCount: Record<string, number> = {};
  for (const sourceId of uniqueTargets) {
    const sourceVisited = new Set<string>([sourceId]);
    const queue = [sourceId];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const consumerId of nodes[queue[cursor]]?.importedBy || []) {
        if (!nodes[consumerId] || sourceVisited.has(consumerId)) continue;
        sourceVisited.add(consumerId);
        queue.push(consumerId);
        sourceHitCount[consumerId] = (sourceHitCount[consumerId] || 0) + 1;
      }
    }
  }

  const visited = new Set<string>(uniqueTargets);
  const impactedFileMap: Record<string, number> = {};
  const causalParentMap: Record<string, string> = {};
  const waves: BlastWave[] = [];
  let currentFrontier = [...uniqueTargets];
  let depth = 1;

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const fileId of currentFrontier) {
      for (const consumerId of nodes[fileId]?.importedBy || []) {
        if (!nodes[consumerId] || visited.has(consumerId)) continue;
        visited.add(consumerId);
        nextFrontier.push(consumerId);
        impactedFileMap[consumerId] = depth;
        if (!causalParentMap[consumerId]) causalParentMap[consumerId] = fileId;
      }
    }
    if (nextFrontier.length > 0) {
      waves.push({ waveIndex: depth, fileIds: nextFrontier });
      depth++;
    }
    currentFrontier = nextFrontier;
  }

  const causalPaths: Record<string, string[]> = {};
  for (const impactedId of Object.keys(impactedFileMap)) {
    const path = [impactedId];
    let current = impactedId;
    while (causalParentMap[current]) {
      current = causalParentMap[current];
      path.unshift(current);
    }
    causalPaths[impactedId] = path;
  }

  const crossfireFiles = Object.keys(sourceHitCount).filter((id) => sourceHitCount[id] > 1);
  const totalImpacted = Object.keys(impactedFileMap).length;
  const denominator = Math.max(1, Object.keys(nodes).length - uniqueTargets.length);
  const blastPercentage = Number(((totalImpacted / denominator) * 100).toFixed(1));
  const highCentralityRisk = uniqueTargets.some((id) => (nodes[id]?.pageRank || 0) >= 0.55);
  const circularDependencyImpact = uniqueTargets.some((id) => {
    const groupId = nodes[id]?.circularGroupId;
    return groupId !== undefined && groupId !== null;
  });
  const testLikeCount = Object.keys(impactedFileMap).filter((id) => /\.(test|spec)\.[^.]+$/i.test(id)).length;
  const testFileNameHeuristicRatio = totalImpacted > 0 ? Number((testLikeCount / totalImpacted).toFixed(2)) : 0;

  let severity: MultiFileBlastReport['severity'] = 'LOW';
  if (blastPercentage >= 35 || crossfireFiles.length >= 3) severity = 'CRITICAL';
  else if (blastPercentage >= 18) severity = 'HIGH';
  else if (blastPercentage >= 6) severity = 'MODERATE';

  return {
    selectedFileIds: uniqueTargets,
    totalImpactedCount: totalImpacted,
    blastPercentage,
    waves,
    impactedFileMap,
    crossfireFiles,
    causalPaths,
    severity,
    qualityGate: {
      manyImpactedFiles: totalImpacted > 5,
      highCentralityRisk,
      circularDependencyImpact,
      testFileNameHeuristicRatio,
      lowTopologyRisk: severity === 'LOW' && !highCentralityRisk && !circularDependencyImpact,
    },
  };
}