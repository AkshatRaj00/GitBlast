/**
 * GitBlast Enterprise Compilation & Graph Kernel Web Worker
 * Runs 100% off-main-thread:
 * 1. Multi-Language Static Import Extraction & PageRank Centrality
 * 2. In-Memory Dual-CSR Typed Buffer Generation (G and G^T)
 * 3. Vectorized Multi-Source BFS Shockwave Engine
 * 4. Transitive Causal Path Extraction & Real-Time Telemetry
 */

import { buildRepositoryGraphFromFiles } from '../engine/parser/graphBuilder';
import { buildCSRFromEdges, executeVectorizedBFS, backtrackCausalPath, DualCSRBuffer } from '../engine/csr/csrBuffer';
import { RawRepoFile, RepositoryGraph } from '../types/graph.types';

let cachedCSR: DualCSRBuffer | null = null;
let cachedGraph: RepositoryGraph | null = null;

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, repoName, files, targetFileIds } = event.data;

  // =========================================================================
  // TASK 1: FULL REPOSITORY COMPILATION & DUAL-CSR ALLOCATION
  // =========================================================================
  if (type === 'BUILD_GRAPH') {
    try {
      const startTime = performance.now();

      // 1. Build the static import graph and structural metrics.
      const graph = buildRepositoryGraphFromFiles(repoName, files as RawRepoFile[]);
      cachedGraph = graph;

      // 2. Build In-Memory Linear Typed Dual-CSR Matrices (Forward G & Transposed G^T)
      const fileIds = Object.keys(graph.nodes);
      const edgePairs = graph.edges.map((e) => ({ source: e.source, target: e.target }));

      const csrBuffer = buildCSRFromEdges(fileIds, edgePairs);
      cachedCSR = csrBuffer;

      const durationMs = Math.round(performance.now() - startTime);

      // Return both compiled high-level graph and low-level CSR metrics
      self.postMessage({
        type: 'BUILD_SUCCESS',
        graph,
        csrMetadata: {
          numNodes: csrBuffer.numNodes,
          numEdges: csrBuffer.numEdges,
          bytesAllocated: (csrBuffer.rowPtrT.byteLength * 2 + csrBuffer.colIdxT.byteLength * 2),
        },
        durationMs,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'BUILD_ERROR',
        error: err.message || 'Worker thread graph analysis encountered an unhandled exception',
      });
    }
  }

  // =========================================================================
  // TASK 2: OFF-THREAD VECTORIZED SHOCKWAVE / BLAST RADIUS TRAVERSAL
  // =========================================================================
  else if (type === 'EXECUTE_BLAST') {
    try {
      const startTime = performance.now();

      if (!cachedCSR || !cachedGraph) {
        throw new Error('CSR graph buffer not allocated in worker memory.');
      }

      const targets: string[] = targetFileIds || [];
      const startIndices: number[] = [];

      targets.forEach((fid) => {
        const idx = cachedCSR!.fileToIndex.get(fid);
        if (idx !== undefined) startIndices.push(idx);
      });

      if (startIndices.length === 0) {
        self.postMessage({
          type: 'BLAST_SUCCESS',
          impactedCount: 0,
          blastPercentage: 0,
          waves: [],
          causalPaths: {},
          crossfireCount: 0,
          durationMs: 0,
        });
        return;
      }

      // Execute Vectorized Bitmasked Parallel BFS in linear RAM
      const bfsResult = executeVectorizedBFS(cachedCSR, startIndices);

      const waveBuckets = new Map<number, string[]>();
      const causalPaths: Record<string, string[]> = {};
      let maxWave = 0;

      for (let i = 0; i < bfsResult.impactedIndices.length; i++) {
        const nodeIdx = bfsResult.impactedIndices[i];
        const filePath = cachedCSR.indexToFile[nodeIdx];
        const depth = bfsResult.waveDepths[nodeIdx];

        if (depth > 0) {
          if (depth > maxWave) maxWave = depth;

          if (!waveBuckets.has(depth)) {
            waveBuckets.set(depth, []);
          }
          waveBuckets.get(depth)!.push(filePath);

          // Causal chain backtracking
          causalPaths[filePath] = backtrackCausalPath(cachedCSR, bfsResult.predecessors, nodeIdx);
        }
      }

      const waves: Array<{ waveIndex: number; fileIds: string[] }> = [];
      for (let d = 1; d <= maxWave; d++) {
        if (waveBuckets.has(d)) {
          waves.push({
            waveIndex: d,
            fileIds: waveBuckets.get(d)!,
          });
        }
      }

      const totalAvailable = Math.max(1, cachedCSR.numNodes - startIndices.length);
      const blastPercentage = Number(((bfsResult.impactedCount / totalAvailable) * 100).toFixed(1));
      const durationMs = Number((performance.now() - startTime).toFixed(3));

      self.postMessage({
        type: 'BLAST_SUCCESS',
        impactedCount: bfsResult.impactedCount,
        blastPercentage,
        waves,
        causalPaths,
        crossfireCount: bfsResult.crossfireCount,
        durationMs,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'BLAST_ERROR',
        error: err.message || 'Worker thread blast execution failed',
      });
    }
  }
});
