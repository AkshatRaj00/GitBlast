import { buildRepositoryGraphFromFiles } from '../engine/parser/graphBuilder';
self.onmessage = (e) => {
  const { repoName, files } = e.data;
  const graph = buildRepositoryGraphFromFiles(repoName, files);
  self.postMessage({ type: 'GRAPH_READY', graph });
};
