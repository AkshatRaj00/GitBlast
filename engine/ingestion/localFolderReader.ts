import { RawRepoFile } from '@/types/graph.types';
import { normalizeFilePath } from '../parser/pathResolver';

const ALLOWED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.cpp', '.go', '.h']);

export async function readLocalFolderFilesToRam(
  fileList: FileList,
  onProg?: (s: string) => void
): Promise<{ repoName: string; files: RawRepoFile[] }> {
  const rawArray = Array.from(fileList);
  const root = rawArray[0]?.webkitRelativePath?.split('/')[0] || 'local-repo';
  const files: RawRepoFile[] = [];

  for (let i = 0; i < rawArray.length; i++) {
    const f = rawArray[i];
    const path = f.webkitRelativePath || f.name;
    const lower = path.toLowerCase();
    if (lower.includes('node_modules/') || lower.includes('.git/') || lower.includes('.next/')) continue;

    const dot = lower.lastIndexOf('.');
    if (dot !== -1 && ALLOWED_EXTS.has(lower.slice(dot))) {
      const text = await f.text();
      // Remove root directory name from relative path
      const stripped = path.includes('/') ? path.slice(path.indexOf('/') + 1) : path;
      files.push({ path: normalizeFilePath(stripped), content: text, size: text.length });
    }
  }
  return { repoName: root, files };
}
