/**
 * GitBlast High-Throughput Local Ingestion Engine
 * Streams local folder trees directly into memory using concurrent batch workers.
 * Supports multi-language AST codebases, package manifests, and Jupyter extraction.
 */

import { RawRepoFile } from '@/types/graph.types';
import { normalizeFilePath } from '../parser/pathResolver';

const ALLOWED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.ipynb',
  '.cpp', '.cc', '.cxx', '.h', '.hpp', '.c',
  '.go', '.rs', '.java', '.kt', '.cs',
  '.json', '.yaml', '.yml'
]);

const IGNORED_DIRECTORIES = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'coverage/',
  '__pycache__/', '.venv/', 'venv/', 'target/', 'vendor/', '.vscode/',
  '.idea/', '.turbo/', 'out/'
];

const IGNORED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'cargo.lock', 'composer.lock'
]);

const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB safe limit for in-memory AST parsing

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

function isValidCodeFile(path: string, size: number): boolean {
  if (size > MAX_FILE_SIZE_BYTES) return false;

  const lower = path.toLowerCase().replace(/\\/g, '/');
  const fileName = lower.split('/').pop() || '';

  if (IGNORED_FILES.has(fileName)) return false;
  if (IGNORED_DIRECTORIES.some((dir) => lower.includes(dir))) return false;

  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx !== -1 && ALLOWED_EXTS.has(fileName.slice(dotIdx));
}

export async function readLocalFolderFilesToRam(
  fileList: FileList,
  onProg?: (status: string) => void
): Promise<{ repoName: string; files: RawRepoFile[] }> {
  const rawArray = Array.from(fileList);
  if (rawArray.length === 0) {
    throw new Error('Selected folder is empty.');
  }

  // Detect root folder container name
  const rootDirName = rawArray[0]?.webkitRelativePath?.split('/')[0] || 'local-workspace';

  onProg?.(`Filtering local workspace files for ${rootDirName}...`);

  // 1. Fast parallel scan for eligible files
  const candidateFiles = rawArray.filter((file) => {
    const relativePath = file.webkitRelativePath || file.name;
    return isValidCodeFile(relativePath, file.size);
  });

  if (candidateFiles.length === 0) {
    throw new Error('No supported source code files detected in this folder.');
  }

  onProg?.(`Queued ${candidateFiles.length} source modules for high-speed RAM ingestion...`);

  const files: RawRepoFile[] = [];
  const BATCH_SIZE = 40; // Concurrent streaming chunk size

  // 2. Parallel Chunked Read Loop
  for (let i = 0; i < candidateFiles.length; i += BATCH_SIZE) {
    const chunk = candidateFiles.slice(i, i + BATCH_SIZE);

    const chunkResults = await Promise.all(
      chunk.map(async (file) => {
        try {
          const rawPath = file.webkitRelativePath || file.name;
          const normalizedPath = rawPath.replace(/\\/g, '/');

          // Strip top-level directory wrapper
          const cleanPath = normalizedPath.includes('/')
            ? normalizedPath.substring(normalizedPath.indexOf('/') + 1)
            : normalizedPath;

          let content = await file.text();

          // Extract python executable cells from jupyter notebooks
          if (cleanPath.endsWith('.ipynb')) {
            content = extractPythonFromJupyter(content);
          }

          return {
            path: normalizeFilePath(cleanPath),
            content,
            size: content.length,
          };
        } catch (err) {
          console.warn(`[LocalReader] Skipping unreadable file ${file.name}:`, err);
          return null;
        }
      })
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const parsedFile = chunkResults[j];
      if (parsedFile) {
        files.push(parsedFile);
      }
    }

    if ((i + BATCH_SIZE) % 80 === 0 || i + BATCH_SIZE >= candidateFiles.length) {
      onProg?.(`Ingesting local files into AST memory buffer (${Math.min(i + BATCH_SIZE, candidateFiles.length)}/${candidateFiles.length})...`);
    }
  }

  return {
    repoName: rootDirName,
    files,
  };
}