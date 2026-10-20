import JSZip from 'jszip';
import { RepositoryGraph } from '@/types/graph.types';

export interface PrunerOptions {
  rawFileBuffer?: Record<string, string>;
}

function isSafeToPrune(filePath: string): boolean {
  const path = filePath.toLowerCase();
  const protectedPatterns = [
    'package.json', 'tsconfig', 'dockerfile', 'readme', 'license',
    'next.config', 'vite.config', 'webpack.config', '.env',
    'requirements.txt', 'setup.py', 'go.mod', 'cargo.toml',
  ];
  return !protectedPatterns.some((pattern) => path.includes(pattern));
}

function calculateInstability(ca: number, ce: number): number {
  if (ca + ce === 0) return 0;
  return Number((ce / (ca + ce)).toFixed(3));
}

export async function generatePrunedRepoZip(
  graph: RepositoryGraph,
  options: PrunerOptions = {},
  onProg?: (msg: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const buffer = options.rawFileBuffer || {};
  const sourceFiles = Object.keys(buffer);
  if (sourceFiles.length === 0) {
    throw new Error('Source content is unavailable. Scan the repository again before exporting.');
  }

  const candidateSet = new Set((graph.deadFiles || []).filter(isSafeToPrune));
  const omittedFiles = sourceFiles.filter((path) => candidateSet.has(path));
  const includedFiles = sourceFiles.filter((path) => !candidateSet.has(path));

  for (let i = 0; i < includedFiles.length; i++) {
    const path = includedFiles[i];
    const content = buffer[path];
    if (typeof content !== 'string') throw new Error('Missing original source content for ' + path);
    if (i % 20 === 0) onProg?.('Packaging source files (' + (i + 1) + '/' + includedFiles.length + ')...');
    zip.file(path, content);
  }

  const auditReport = '# GitBlast Source Archive Review\n' +
    '**Generated:** ' + new Date().toISOString() + '\n' +
    '**Analysis:** Static import-graph heuristic\n\n' +
    '## Summary\n' +
    '- Imported source files: ' + sourceFiles.length + '\n' +
    '- Isolated-module candidates omitted: ' + omittedFiles.length + '\n' +
    '- Source files included: ' + includedFiles.length + '\n' +
    '- Detected dependency cycles: ' + graph.circularGroups.length + '\n\n' +
    '## Limitations\n' +
    '- Candidate detection is heuristic; this archive is not proven safe to run or deploy.\n' +
    '- Only file types accepted by the importer are included; unsupported files and static assets may be absent.\n' +
    '- Review the archive and run the project tests before using it.\n\n' +
    (omittedFiles.length ? '## Omitted isolated-module candidates\n' + omittedFiles.map((path) => '- ' + path).join('\n') : 'No isolated-module candidates were omitted.');

  zip.file('GITBLAST_ARCHIVE_REVIEW.md', auditReport);
  onProg?.('Compressing source archive...');
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
/**
 * Generates an Enterprise Architectural Specification document (Markdown format).
 */
export function generateArchitectureMarkdown(graph: RepositoryGraph): string {
  // 1. Architectural Pillars with Coupling & Instability Index
  const topCoreFiles = (graph.godFiles || [])
    .map((fid) => {
      const node = graph.nodes[fid];
      if (!node) return `- \`${fid}\` (Unresolved)`;
      const ca = node.inDegree || 0;
      const ce = node.outDegree || 0;
      const instability = calculateInstability(ca, ce);
      const pr = typeof node.pageRank === 'number' ? (node.pageRank * 100).toFixed(1) : '0.0';
      return `| \`${fid}\` | ${ca} \vert{}${ce} | ${instability} \vert{}${pr}% |`;
    })
    .join('\n');

  // 2. Circular Loop Risk Analysis
  const circularInfo =
    graph.circularGroups.length === 0
      ? 'Clean Directed Acyclic Graph. Zero circular dependencies detected.'
      : graph.circularGroups
          .map((g, idx) => `### Cycle Group #${idx + 1} (${g.length} Files)\n` + g.map((f) => `- \`${f}\``).join('\n'))
          .join('\n\n');

  // 3. Modularity Health Metrics
  const avgLOC = Math.round(graph.totalLoc / Math.max(1, graph.totalFiles));
  const density = (graph.totalEdges / Math.max(1, graph.totalFiles * (graph.totalFiles - 1))).toFixed(4);

  return `# Software Architecture & System Telemetry
**Target Repository:** \`${graph.repoName}\`
**Analysis Engine:** GitBlast Client-Side Compiler Kernel

## 1. System Topology Overview
| Metric | Value | Description |
| :--- | :--- | :--- |
| **Total Modules** | \`${graph.totalFiles}\` | Active compilation units analyzed in memory. |
| **Dependency Edges** | \`${graph.totalEdges}\` | Syntactic connections (imports, includes, requires). |
| **Codebase LOC** | \`${graph.totalLoc.toLocaleString()}\` | Total non-empty lines of code scanned. |
| **Average Module LOC** | \`${avgLOC}\` | Mean complexity density per file. |
| **Graph Density** | \`${density}\` | Ratio of actual edges to maximum theoretical connectivity. |
| **Unreferenced Modules** | \`${graph.deadFiles.length}\` | Zero-caller orphan files flagged for pruning. |

---

## 2. Core Architectural Pillars (Centrality Matrix)
*Components with highest incoming gravity ($C_a$) and PageRank centrality.*

| Component Path | Afferent ($C_a$) | Efferent ($C_e$) | Instability ($I$) | PageRank |
| :--- | :---: | :---: | :---: | :---: |
${topCoreFiles || '| _No god nodes identified_ | - | - | - | - |'}

*Note: Instability ($I = \\frac{C_e}{C_a + C_e}$) evaluates architectural compliance with the Stable Dependencies Principle (SDP). Components near $0.0$ are foundational and must resist structural signature mutations.*

---

## 3. Circular Dependency & SCC Audit (Tarjan's DAG)
${circularInfo}

---

## 4. Architectural Quality Gate Policies
1. **Signature Stability:** Foundational nodes with $I < 0.2$ must undergo rigorous downstream regression audits before merging changes.
2. **Blast Radius Threshold:** Any single commit triggering a downstream shockwave exceeding $15\%$ requires architectural review.
3. **Acyclic Invariance:** Merges introducing new Strongly Connected Components (SCCs) are strictly blocked.
`;
}

/**
 * Generates a minimal workflow that runs the checks this repository defines.
 */
export function generateGitHubActionYaml(): string {
  return [
    'name: GitBlast CI',
    '',
    'on:',
    '  pull_request:',
    '    branches: [main, master]',
    '  push:',
    '    branches: [main, master]',
    '',
    'permissions:',
    '  contents: read',
    '',
    'concurrency:',
    '  group: ' + '$' + '{{ github.workflow }}-' + '$' + '{{ github.ref }}',
    '  cancel-in-progress: true',
    '',
    'jobs:',
    '  verify:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 15',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 22',
    '          cache: npm',
    '      - run: npm ci',
    '      - run: npm run lint',
    '      - run: npm run build',
    '',
  ].join('\n');
}
