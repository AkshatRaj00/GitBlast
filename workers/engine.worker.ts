import { buildCSRFromEdges, executeTypedBFS, CSRGraphBuffer } from '../engine/csr/csrBuffer';
import { computeGraphPageRank } from '../engine/math/pageRank';
import { findCircularDependencies } from '../engine/math/tarjanSCC';
import { detectDeadFiles } from '../engine/math/deadCodeFinder';
import { buildRepositoryGraphFromFiles } from '../engine/parser/graphBuilder';

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'BUILD_GRAPH') {
    const { repoName, files } = payload;
    try {
      const graph = buildRepositoryGraphFromFiles(repoName, files);
      const fileIds = Object.keys(graph.nodes);
      const edges = graph.edges.map((edge) => ({ source: edge.source, target: edge.target }));

      // Generate low-level linear CSR buffer in worker thread
      const csr = buildCSRFromEdges(fileIds, edges);

      self.postMessage({
        type: 'GRAPH_READY',
        graph,
        csrSummary: { numNodes: csr.numNodes, numEdges: csr.numEdges },
      });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message || 'Worker graph build failure' });
    }
  }

  if (type === 'RUN_CSR_BFS') {
    const { csr, startNodeIndex } = payload;
    try {
      const result = executeTypedBFS(csr, startNodeIndex);
      self.postMessage({ type: 'BFS_COMPLETE', result });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
