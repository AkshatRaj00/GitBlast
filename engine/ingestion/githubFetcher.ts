import JSZip from 'jszip';
import { RawRepoFile } from '@/types/graph.types';
import { normalizeFilePath } from '../parser/pathResolver';

const ALLOWED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.ipynb',
  '.cpp', '.cc', '.cxx', '.h', '.hpp', '.c',
  '.go', '.rs', '.java', '.kt', '.cs',
  '.json', '.yaml', '.yml'
]);

const IGNORE_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'coverage/',
  '__pycache__/', '.venv/', 'venv/', 'target/', 'vendor/', '.vscode/',
  '.idea/', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
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

function isValidCodeFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (IGNORE_PATTERNS.some((p) => lower.includes(p))) return false;
  const dot = lower.lastIndexOf('.');
  return dot !== -1 && ALLOWED_EXTS.has(lower.slice(dot));
}

/**
 * Strategy 1: High-Speed Direct In-Memory Zipball Streaming (10x faster, zero rate-limit drops)
 */
async function fetchViaZipball(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>,
  onProg?: (s: string) => void
): Promise<RawRepoFile[] | null> {
  try {
    onProg?.(`Opening ultra-speed zipball stream for ${owner}/${repo}...`);
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
    const zipRes = await fetch(zipUrl, { headers });

    if (!zipRes.ok) return null;

    const arrayBuffer = await zipRes.arrayBuffer();
    onProg?.('Decompressing repository archive directly in RAM...');

    const zip = await JSZip.loadAsync(arrayBuffer);
    const files: RawRepoFile[] = [];

    const fileEntries = Object.keys(zip.files).filter((relativePath) => {
      const entry = zip.files[relativePath];
      return !entry.dir && isValidCodeFile(relativePath);
    });

    const targetEntries = fileEntries.slice(0, 1500);

    for (let i = 0; i < targetEntries.length; i++) {
      const rawPath = targetEntries[i];
      // Strip GitHub zipball root directory prefix (e.g. owner-repo-commitHash/...)
      const slashIndex = rawPath.indexOf('/');
      const cleanPath = slashIndex !== -1 ? rawPath.substring(slashIndex + 1) : rawPath;

      let content = await zip.files[rawPath].async('string');
      if (cleanPath.endsWith('.ipynb')) {
        content = extractPythonFromJupyter(content);
      }

      files.push({
        path: normalizeFilePath(cleanPath),
        content,
        size: content.length,
      });

      if (i % 80 === 0) {
        onProg?.(`Unpacking in-memory AST units (${i + 1}/${targetEntries.length})...`);
      }
    }

    return files.length > 0 ? files : null;
  } catch (err) {
    console.warn('[GitHubFetcher] Zipball direct stream fell back to tree API:', err);
    return null;
  }
}

/**
 * Strategy 2: Resilient Concurrent Tree & Raw Stream Fallback
 */
async function fetchViaTreeApi(
  owner: string,
  repo: string,
  defaultBranch: string,
  headers: Record<string, string>,
  onProg?: (s: string) => void
): Promise<RawRepoFile[]> {
  onProg?.(`Fetching Git tree structure for branch: ${defaultBranch}...`);
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    throw new Error(`GitHub Tree API Error (HTTP ${treeRes.status}). Check rate limits or token.`);
  }

  const treeData = await treeRes.json();
  const blobs = (treeData.tree || []).filter((item: any) => {
    return item.type === 'blob' && isValidCodeFile(item.path);
  });

  if (blobs.length === 0) {
    throw new Error('No supported source code files identified in repository.');
  }

  const targetBlobs = blobs.slice(0, 1000);
  const files: RawRepoFile[] = [];
  const batchSize = 45;

  for (let i = 0; i < targetBlobs.length; i += batchSize) {
    const chunk = targetBlobs.slice(i, i + batchSize);
    onProg?.(`Concurrent ingestion in progress (${Math.min(i + batchSize, targetBlobs.length)}/${targetBlobs.length})...`);

    const results = await Promise.all(
      chunk.map(async (b: any) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${b.path}`;
          const res = await fetch(rawUrl);
          if (!res.ok) return null;
          let text = await res.text();
          if (b.path.endsWith('.ipynb')) {
            text = extractPythonFromJupyter(text);
          }
          return {
            path: normalizeFilePath(b.path),
            content: text,
            size: text.length,
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) files.push(r);
    }
  }

  return files;
}

/**
 * Universal GitHub Ingestion Engine with Dual-Engine Fallback
 */
export async function fetchGitHubRepositoryToRam(
  repoUrl: string,
  token?: string,
  onProg?: (s: string) => void
): Promise<{ repoName: string; files: RawRepoFile[] }> {
  const cleaned = repoUrl.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const parts = cleaned.split('/');
  if (parts.length < 2) throw new Error('Invalid repository specification: expected owner/repo');

  const [owner, repo] = parts;
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  onProg?.(`Establishing connection to GitHub API for ${owner}/${repo}...`);
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    throw new Error(`Repository resolution failed (HTTP ${metaRes.status}). Verify repository existence or API rate limit.`);
  }

  const meta = await metaRes.json();
  const defaultBranch = meta.default_branch || 'main';

  // Attempt ultra-fast direct Zipball extraction first
  const zipballFiles = await fetchViaZipball(owner, repo, defaultBranch, headers, onProg);
  if (zipballFiles && zipballFiles.length > 0) {
    return { repoName: `${owner}/${repo}`, files: zipballFiles };
  }

  // Fallback to Tree API
  const treeFiles = await fetchViaTreeApi(owner, repo, defaultBranch, headers, onProg);
  return { repoName: `${owner}/${repo}`, files: treeFiles };
}