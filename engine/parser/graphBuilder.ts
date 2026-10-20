import { RawRepoFile, RepositoryGraph, FileNode, GraphEdge } from '@/types/graph.types';
import { parseModuleSymbols, ModuleSymbolTable } from './symbolResolver';

export function buildRepositoryGraphFromFiles(
  repoName: string,
  rawFiles: RawRepoFile[]
): RepositoryGraph {
  const nodes: Record<string, FileNode> = {};
  const edges: GraphEdge[] = [];
  const fileSet = new Set<string>();

  // Filter noise & binary artifacts
  const validFiles = rawFiles.filter((f) => {
    const p = f.path.toLowerCase();
    return (
      !p.includes('.git/') &&
      !p.includes('node_modules/') &&
      !p.includes('__pycache__/') &&
      !p.endsWith('.lock') &&
      !p.endsWith('.min.js') &&
      !p.endsWith('.png') &&
      !p.endsWith('.jpg') &&
      !p.endsWith('.svg')
    );
  });

  validFiles.forEach((f) => {
    fileSet.add(f.path);
  });

  // 1. Initialize Node Registry
  validFiles.forEach((file) => {
    const loc = Math.max(1, (file.content.match(/\n/g) || []).length);
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

  // 2. Parse Modules with Deterministic Symbol Lexer
  const moduleTables = new Map<string, ModuleSymbolTable>();
  validFiles.forEach((file) => {
    const table = parseModuleSymbols(file.path, file.content);
    moduleTables.set(file.path, table);
  });

  // Canonical Target Path Resolver
  function resolveTargetFile(sourcePath: string, rawDep: string): string | null {
    if (fileSet.has(rawDep)) return rawDep;

    const cleanDep = rawDep.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
    if (fileSet.has(cleanDep)) return cleanDep;

    const exts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.cpp', '.h', '.go', '.rs', '.java'];
    for (const ext of exts) {
      if (fileSet.has(cleanDep + ext)) return cleanDep + ext;
      if (fileSet.has(rawDep + ext)) return rawDep + ext;
    }

    for (const ext of exts) {
      const idxPath = `${cleanDep}/index${ext}`;
      if (fileSet.has(idxPath)) return idxPath;
      const pyInit = `${cleanDep}/__init__.py`;
      if (fileSet.has(pyInit)) return pyInit;
    }

    return null;
  }

  // 3. Connect Graph Edges using Lexical Symbol Tracking
  validFiles.forEach((file) => {
    const table = moduleTables.get(file.path);
    if (!table) return;

    const resolvedTargets = new Set<string>();

    table.directDependencies.forEach((dep) => {
      const target = resolveTargetFile(file.path, dep);
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

  // 4. In/Out Degree & True Dead Code Classification
  Object.values(nodes).forEach((node) => {
    node.inDegree = node.importedBy.length;
    node.outDegree = node.imports.length;
    if (node.inDegree === 0 && node.outDegree === 0) {
      node.isDeadCode = true;
    }
  });

  // 5. Mathematical PageRank Kernel (R = d*M*R + (1-d)/N)
  const N = Object.keys(nodes).length || 1;
  const damping = 0.85;
  const iterations = 20;

  for (let it = 0; it < iterations; it++) {
    const nextRanks: Record<string, number> = {};
    Object.values(nodes).forEach((node) => {
      let rankSum = 0;
      node.importedBy.forEach((callerId) => {
        const caller = nodes[callerId];
        if (caller && caller.outDegree > 0) {
          rankSum += caller.pageRank / caller.outDegree;
        }
      });
      nextRanks[node.id] = (1 - damping) / N + damping * rankSum;
    });
    Object.values(nodes).forEach((node) => { node.pageRank = nextRanks[node.id]; });
  }

  const maxRank = Math.max(...Object.values(nodes).map((n) => n.pageRank), 0.0001);
  Object.values(nodes).forEach((n) => {
    n.pageRank = Math.min(1.0, Math.max(0.05, n.pageRank / maxRank));
  });

  const godFiles = Object.values(nodes)
    .filter((n) => n.inDegree >= 2)
    .sort((a, b) => b.pageRank * 2 + b.inDegree - (a.pageRank * 2 + a.inDegree))
    .slice(0, Math.min(8, Math.max(1, Math.ceil(N * 0.1))))
    .map((n) => n.id);

  const deadFiles = Object.values(nodes)
    .filter((n) => n.isDeadCode)
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
