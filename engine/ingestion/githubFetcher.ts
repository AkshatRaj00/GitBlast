import { RawRepoFile } from '@/types/graph.types';
import { normalizeFilePath } from '../parser/pathResolver';

const ALLOWED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs',
  '.py', '.ipynb',
  '.cpp', '.cc', '.cxx', '.h', '.hpp', '.c',
  '.go', '.rs', '.java',
  '.json', '.yaml', '.yml'
]);

const IGNORE_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'coverage/', '__pycache__/', '.venv/', 'venv/', 'target/'
];

function extractPythonFromJupyter(ipynbContent: string): string {
  try {
    const json = JSON.parse(ipynbContent);
    const codeCells = (json.cells || [])
      .filter((c: any) => c.cell_type === 'code')
      .map((c: any) => (Array.isArray(c.source) ? c.source.join('') : c.source || ''));
    return codeCells.join('\n\n# --- JUPYTER CELL BREAK ---\n\n');
  } catch {
    return ipynbContent;
  }
}

export async function fetchGitHubRepositoryToRam(
  repoUrl: string,
  token?: string,
  onProg?: (s: string) => void
): Promise<{ repoName: string; files: RawRepoFile[] }> {
  const cleaned = repoUrl.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const parts = cleaned.split('/');
  if (parts.length < 2) throw new Error('Invalid GitHub format: owner/repo');

  const [owner, repo] = parts;
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token && token.trim()) headers.Authorization = `Bearer ${token.trim()}`;

  onProg?.(`Resolving metadata for ${owner}/${repo}...`);
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    throw new Error(`GitHub Repo Error (${metaRes.status}): Rate limit or repo not found`);
  }
  const meta = await metaRes.json();
  const defaultBranch = meta.default_branch || 'main';

  onProg?.(`Fetching tree entries for ${defaultBranch}...`);
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) throw new Error(`Failed to load Git tree (HTTP ${treeRes.status})`);
  const treeData = await treeRes.json();

  const blobs = (treeData.tree || []).filter((item: any) => {
    if (item.type !== 'blob') return false;
    const lower = item.path.toLowerCase();
    if (IGNORE_PATTERNS.some(p => lower.includes(p))) return false;
    const dot = lower.lastIndexOf('.');
    return dot !== -1 && ALLOWED_EXTS.has(lower.slice(dot));
  });

  if (blobs.length === 0) {
    throw new Error('No supported code files found in this repository.');
  }

  // Increased capacity: stream up to 1,000 files in fast chunks of 35
  const targetBlobs = blobs.slice(0, 1000);
  const files: RawRepoFile[] = [];
  const batchSize = 35;

  for (let i = 0; i < targetBlobs.length; i += batchSize) {
    const chunk = targetBlobs.slice(i, i + batchSize);
    onProg?.(`Ingesting files into CSR buffer (${Math.min(i + batchSize, targetBlobs.length)}/${targetBlobs.length})...`);

    const results = await Promise.all(
      chunk.map(async (b: any) => {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${b.path}`);
          if (!res.ok) return null;
          let text = await res.text();
          if (b.path.endsWith('.ipynb')) {
            text = extractPythonFromJupyter(text);
          }
          return { path: normalizeFilePath(b.path), content: text, size: text.length };
        } catch { return null; }
      })
    );
    results.forEach(r => { if (r) files.push(r); });
  }

  return { repoName: `${owner}/${repo}`, files };
}
