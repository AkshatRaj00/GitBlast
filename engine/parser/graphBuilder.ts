import { RawRepoFile, RepositoryGraph, FileNode, GraphEdge } from '@/types/graph.types';
import { detectDeadFiles } from '../math/deadCodeFinder';
import { extractRawImports } from './multiLangTokenizer';
import { detectLanguage } from './complexityScanner';
import { normalizeFilePath, resolveImportToFileId } from './pathResolver';

export function buildRepositoryGraphFromFiles(
  repoName: string,
  rawFiles: RawRepoFile[]
): RepositoryGraph {
  const nodes: Record<string, FileNode> = {};
  const edges: GraphEdge[] = [];
  const fileSet = new Set<string>();

  // Filter noise & binary artifacts
  const validFiles = rawFiles.map((file) => ({ ...file, path: normalizeFilePath(file.path) })).filter((f) => {
    const p = f.path.toLowerCase();
    return (
      !p.includes('.git/') &&
      !p.includes('node_modules/') &&
      !p.includes('__pycache__/') &&
      !p.endsWith('.lock') &&
      !p.endsWith('.min.js') &&
      !p.endsWith('.png') &&
      !p.endsWith('.jpg') &&
      !p.endsWith('.svg') &&
      !p.endsWith('.gif') &&
      !p.endsWith('.webp') &&
      !p.endsWith('.ico')
    );
  });

  validFiles.forEach((f) => {
    fileSet.add(f.path);
  });

  // 1. Initialize Node Registry
  validFiles.forEach((file) => {
    const loc = file.content.length === 0 ? 0 : file.content.split(/\r\n|\r|\n/).length;
    const dir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : 'root';

    nodes[file.path] = {
      id: file.path,
      name: file.path.split('/').pop() || file.path,
      directory: dir,
      loc,
      imports: [],
      importedBy: [],
      pageRank: 0,
      inDegree: 0,
      outDegree: 0,
      isDeadCode: false,
    };
  });

  // 2. Resolve statically discoverable imports to exact files in this checkout.
  const fileList = Array.from(fileSet);
  validFiles.forEach((file) => {
    const resolvedTargets = new Set<string>();
    const language = detectLanguage(file.path);
    extractRawImports(file.content, language).forEach((dep) => {
      const target = resolveImportToFileId(file.path, dep, language, fileSet, fileList);
      if (target && target !== file.path) {
        resolvedTargets.add(target);
      }
    });

    resolvedTargets.forEach((targetPath) => {
      nodes[file.path].imports.push(targetPath);
      nodes[targetPath].importedBy.push(file.path);

      edges.push({
        id: `${file.path}->${targetPath}`,
        source: file.path,
        target: targetPath,
        isCircular: false,
      });
    });
  });

  // 3. Degree metrics and conservative orphan candidates.
  Object.values(nodes).forEach((node) => {
    node.inDegree = node.importedBy.length;
    node.outDegree = node.imports.length;
  });
  const deadFiles = detectDeadFiles(nodes);

  // 4. PageRank with dangling-node redistribution; scores sum to 1.
  const N = Object.keys(nodes).length || 1;
  const damping = 0.85;
  const iterations = 60;
  const tolerance = 1e-8;
  Object.values(nodes).forEach((node) => { node.pageRank = 1 / N; });

  for (let it = 0; it < iterations; it++) {
    const nextRanks: Record<string, number> = {};
    const danglingMass = Object.values(nodes)
      .filter((node) => node.outDegree === 0)
      .reduce((sum, node) => sum + node.pageRank, 0);
    let rankDelta = 0;
    Object.values(nodes).forEach((node) => {
      let rankSum = 0;
      node.importedBy.forEach((callerId) => {
        const caller = nodes[callerId];
        if (caller && caller.outDegree > 0) {
          rankSum += caller.pageRank / caller.outDegree;
        }
      });
      nextRanks[node.id] = (1 - damping) / N + damping * (rankSum + danglingMass / N);
      rankDelta += Math.abs(nextRanks[node.id] - node.pageRank);
    });
    Object.values(nodes).forEach((node) => { node.pageRank = nextRanks[node.id]; });
    if (rankDelta < tolerance) break;
  }

  const godFiles = Object.values(nodes)
    .filter((n) => n.inDegree > 0)
    .sort((a, b) => b.pageRank - a.pageRank || b.inDegree - a.inDegree)
    .slice(0, Math.min(8, Math.max(1, Math.ceil(N * 0.1))))
    .map((n) => n.id);

  const totalLoc = Object.values(nodes).reduce((acc, n) => acc + n.loc, 0);

  const circularGroups: string[][] = [];
  let nextIndex = 0;
  const indexById = new Map<string, number>();
  const lowById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visit = (id: string) => {
    indexById.set(id, nextIndex); lowById.set(id, nextIndex++);
    stack.push(id); onStack.add(id);
    for (const target of nodes[id].imports) {
      if (!indexById.has(target)) {
        visit(target);
        lowById.set(id, Math.min(lowById.get(id)!, lowById.get(target)!));
      } else if (onStack.has(target)) {
        lowById.set(id, Math.min(lowById.get(id)!, indexById.get(target)!));
      }
    }
    if (lowById.get(id) === indexById.get(id)) {
      const component: string[] = [];
      let member: string;
      do { member = stack.pop()!; onStack.delete(member); component.push(member); } while (member !== id);
      if (component.length > 1 || nodes[id].imports.includes(id)) circularGroups.push(component);
    }
  };
  Object.keys(nodes).forEach((id) => { if (!indexById.has(id)) visit(id); });
  circularGroups.forEach((group, groupIndex) => {
    group.forEach((id) => { nodes[id].circularGroupId = groupIndex; });
  });
  const cycleIds = new Set(circularGroups.flat());
  edges.forEach((edge) => { edge.isCircular = cycleIds.has(edge.source) && cycleIds.has(edge.target); });

  return {
    repoName,
    totalFiles: Object.keys(nodes).length,
    totalEdges: edges.length,
    totalLoc,
    nodes,
    edges,
    godFiles,
    deadFiles,
    circularGroups,
  };
}
