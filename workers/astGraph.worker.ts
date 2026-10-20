/**
 * GitBlast AST Compilation & Graph Worker Engine
 * Executes full Abstract Syntax Tree parsing, dependency resolution,
 * PageRank centrality computation, and topological sort off the main browser thread.
 */

import { buildRepositoryGraphFromFiles } from '../engine/parser/graphBuilder';
import { buildCSRFromEdges } from '../engine/csr/csrBuffer';
import { RawRepoFile, RepositoryGraph } from '../types/graph.types';

self.onmessage = async (e: MessageEvent) => {
  const { type = 'BUILD_GRAPH', repoName, files, options = {} } = e.data;

  // 1. Full AST Graph Compilation
  if (type === 'BUILD_GRAPH') {
    try {
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('AST Worker received empty or invalid files payload.');
      }

      const startTime = performance.now();

      // Compile AST graph across all supported languages (TS, JS, Python, C++, Go, Rust, Java)
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
        error: err.message || 'AST Compilation failed in background worker thread.',
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
        error: err.message || 'Module inspection failed in AST worker.',
      });
    }
  }
};