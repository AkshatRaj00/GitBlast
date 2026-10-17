import { RawRepoFile } from '@/types/graph.types';
import { normalizeFilePath } from '../parser/pathResolver';

const ALLOWED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.ipynb',
  '.cpp', '.h', '.hpp', '.c', '.go', '.rs', '.java'
]);

export async function fetchRepoViaGraphQL(
  repoUrl: string,
  token?: string,
  onProg?: (s: string) => void
): Promise<{ repoName: string; files: RawRepoFile[] }> {
  const cleaned = repoUrl.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const [owner, repo] = cleaned.split('/');

  if (!owner || !repo) throw new Error('Invalid repo URL: owner/repo required');

  onProg?.('Opening high-throughput streaming channel...');

  // Fallback direct Git Tree with chunked parallel prefetching
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `Bearer ${token.trim()}`;

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, { headers });
  if (!treeRes.ok) {
    const masterRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, { headers });
    if (!masterRes.ok) throw new Error(`Repository access error (HTTP ${treeRes.status})`);
  }

  const treeJson = await (treeRes.ok ? treeRes : await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, { headers })).json();
  const rawBlobs = (treeJson.tree || []).filter((item: any) => {
    if (item.type !== 'blob') return false;
    const lower = item.path.toLowerCase();
    if (lower.includes('node_modules/') || lower.includes('.git/') || lower.includes('.next/')) return false;
    const dot = lower.lastIndexOf('.');
    return dot !== -1 && ALLOWED_EXTS.has(lower.slice(dot));
  }).slice(0, 500);

  const files: RawRepoFile[] = [];
  const chunkSize = 40;

  for (let i = 0; i < rawBlobs.length; i += chunkSize) {
    const slice = rawBlobs.slice(i, i + chunkSize);
    onProg?.(`Parallel streaming source AST (${Math.min(i + chunkSize, rawBlobs.length)}/${rawBlobs.length})...`);

    const batch = await Promise.all(
      slice.map(async (b: any) => {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${b.path}`);
          if (!res.ok) return null;
          const content = await res.text();
          return { path: normalizeFilePath(b.path), content, size: content.length };
        } catch {
          return null;
        }
      })
    );

    batch.forEach((f) => { if (f) files.push(f); });
  }

  return { repoName: `${owner}/${repo}`, files };
}
