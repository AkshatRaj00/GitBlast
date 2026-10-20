/**
 * GitBlast static import graph worker.
 * Executes source import extraction, dependency resolution,
 * PageRank centrality computation, and topological sort off the main browser thread.
 */

import { buildRepositoryGraphFromFiles } from '../engine/parser/graphBuilder';
import { buildCSRFromEdges } from '../engine/csr/csrBuffer';
import { RawRepoFile, RepositoryGraph } from '../types/graph.types';

self.onmessage = async (e: MessageEvent) => {
  const { type = 'BUILD_GRAPH', repoName, files, options = {} } = e.data;

  // 1. Static import graph compilation
  if (type === 'BUILD_GRAPH') {
    try {
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('Graph worker received an empty or invalid files payload.');
      }

      const startTime = performance.now();

      // Extract statically discoverable imports across supported languages.
      const graph: RepositoryGraph = buildRepositoryGraphFromFiles(repoName, files as RawRepoFile[]);

      // Generate in-memory linear Dual-CSR matrix (Forward G and Reverse G^T)
      const fileIds = Object.keys(graph.nodes);
      const edgePairs = graph.edges.map((edge) => ({ source: edge.source, target: edge.target }));
      const csrBuffer = buildCSRFromEdges(fileIds, edgePairs);

      const durationMs = Math.round(performance.now() - startTime);

      self.postMessage({
        type: 'GRAPH_READY',
        graph,
        csrBufferMetrics: {
          numNodes: csrBuffer.numNodes,
          numEdges: csrBuffer.numEdges,
          allocatedBytes: csrBuffer.rowPtrT.byteLength * 2 + csrBuffer.colIdxT.byteLength * 2,
        },
        durationMs,
        totalFiles: graph.totalFiles,
        totalEdges: graph.totalEdges,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'GRAPH_ERROR',
        error: err.message || 'Static graph analysis failed in the background worker.',
      });
    }
  }

  // 2. Focused Module Symbol Inspection
  else if (type === 'INSPECT_MODULE') {
    try {
      const { targetFileId } = e.data;
      self.postMessage({
        type: 'MODULE_INSPECTED',
        targetFileId,
        status: 'READY',
      });
    } catch (err: any) {
      self.postMessage({
        type: 'GRAPH_ERROR',
        error: err.message || 'Module inspection failed in the graph worker.',
      });
    }
  }
};
