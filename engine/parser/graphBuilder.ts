import { DependencyEdge, FileNode, RawRepoFile, RepositoryGraph } from '@/types/graph.types';
import { computeComplexityAndLoc, detectLanguage } from './complexityScanner';
import { extractRawImports } from './multiLangTokenizer';
import { getParentDir, normalizeFilePath, resolveImportToFileId } from './pathResolver';
import { computeGraphPageRank } from '../math/pageRank';
import { findCircularDependencies } from '../math/tarjanSCC';
import { detectDeadFiles } from '../math/deadCodeFinder';

export function buildRepositoryGraphFromFiles(repoName: string, rawFiles: RawRepoFile[]): RepositoryGraph {
  const nodes: Record<string, FileNode> = {};
  const allFileList = Array.from(new Set(rawFiles.map(f => normalizeFilePath(f.path))));
  const allFileSet = new Set(allFileList);

  let totalLoc = 0;

  for (const f of rawFiles) {
    const id = normalizeFilePath(f.path);
    const lang = detectLanguage(id);
    const { loc, cyclomaticComplexity } = computeComplexityAndLoc(f.content, lang);
    totalLoc += loc;

    nodes[id] = {
      id,
      name: id.split('/').pop() || id,
      directory: getParentDir(id),
      extension: id.slice(id.lastIndexOf('.')),
      language: lang,
      content: f.content,
      loc,
      cyclomaticComplexity,
      imports: [],
      importedBy: [],
      rawImports: extractRawImports(f.content, lang),
      inDegree: 0,
      outDegree: 0,
      pageRank: 0,
      isDeadCode: false,
      isEntryPoint: false,
      circularGroupId: null
    };
  }

  const edgeMap = new Map<string, DependencyEdge>();

  for (const id of allFileList) {
    const node = nodes[id];
    for (const raw of node.rawImports) {
      const target = resolveImportToFileId(id, raw, node.language, allFileSet, allFileList);
      if (target && target !== id && nodes[target]) {
        if (!node.imports.includes(target)) node.imports.push(target);
        if (!nodes[target].importedBy.includes(id)) nodes[target].importedBy.push(id);
        const edgeId = `${id}->${target}`;
        edgeMap.set(edgeId, { id: edgeId, source: id, target, isCircular: false });
      }
    }
    node.outDegree = node.imports.length;
  }

  for (const id of allFileList) {
    nodes[id].inDegree = nodes[id].importedBy.length;
  }

  const pageRanks = computeGraphPageRank(nodes);
  allFileList.forEach(id => (nodes[id].pageRank = pageRanks[id] ?? 0));

  const circularGroups = findCircularDependencies(nodes);
  circularGroups.forEach((group, idx) => {
    const gSet = new Set(group);
    group.forEach(fid => { if (nodes[fid]) nodes[fid].circularGroupId = idx; });
    edgeMap.forEach(e => {
      if (gSet.has(e.source) && gSet.has(e.target)) e.isCircular = true;
    });
  });

  const deadFiles = detectDeadFiles(nodes);

  const godFiles = [...allFileList]
    .sort((a, b) => (nodes[b].pageRank * 50 + nodes[b].inDegree * 3) - (nodes[a].pageRank * 50 + nodes[a].inDegree * 3))
    .slice(0, 5);

  return {
    repoName,
    scannedAt: Date.now(),
    totalFiles: allFileList.length,
    totalEdges: edgeMap.size,
    totalLoc,
    nodes,
    edges: Array.from(edgeMap.values()),
    circularGroups,
    deadFiles,
    godFiles
  };
}
