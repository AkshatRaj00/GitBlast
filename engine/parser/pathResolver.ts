import { SupportedLanguage } from '@/types/graph.types';

export function normalizeFilePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

export function getParentDir(p: string): string {
  const n = normalizeFilePath(p);
  const idx = n.lastIndexOf('/');
  return idx === -1 ? '' : n.slice(0, idx);
}

export function resolveImportToFileId(
  currentFile: string,
  rawImport: string,
  lang: SupportedLanguage,
  allFileSet: Set<string>,
  allFileList: string[]
): string | null {
  const currentDir = getParentDir(currentFile);

  // 1. JAVASCRIPT / TYPESCRIPT
  if (lang === 'typescript' || lang === 'javascript') {
    if (rawImport.startsWith('.')) {
      const baseParts = currentDir ? currentDir.split('/') : [];
      const specParts = rawImport.split('/');
      for (const p of specParts) {
        if (p === '.') continue;
        if (p === '..') baseParts.pop();
        else baseParts.push(p);
      }
      const candidate = normalizeFilePath(baseParts.join('/'));
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) {
        if (allFileSet.has(candidate + ext)) return candidate + ext;
      }
      if (allFileSet.has(candidate)) return candidate;
    }

    if (rawImport.startsWith('@/') || rawImport.startsWith('~/')) {
      const stripped = rawImport.replace(/^(@\/|~\/)/, '');
      const candidates = [stripped, `src/${stripped}`, `app/${stripped}`];
      for (const c of candidates) {
        for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
          if (allFileSet.has(c + ext)) return c + ext;
        }
      }
    }
  }

  // 2. PYTHON (Data Science & ML repos)
  if (lang === 'python') {
    // Relative imports: from . import helper or from ..utils import db
    const dotMatch = rawImport.match(/^(\.+)(.*)$/);
    if (dotMatch) {
      const dotCount = dotMatch[1].length;
      const remainder = dotMatch[2].replace(/\./g, '/');
      const baseParts = currentDir ? currentDir.split('/') : [];
      for (let i = 1; i < dotCount; i++) baseParts.pop();
      const candidate = remainder ? [...baseParts, remainder].join('/') : baseParts.join('/');
      if (allFileSet.has(candidate + '.py')) return candidate + '.py';
      if (allFileSet.has(candidate + '/__init__.py')) return candidate + '/__init__.py';
      if (allFileSet.has(candidate)) return candidate;
    }

    // Absolute module imports: import model or from app.utils import x
    const slashPath = rawImport.replace(/\./g, '/');

    // Check same folder
    const localTarget = currentDir ? `${currentDir}/${slashPath}` : slashPath;
    if (allFileSet.has(localTarget + '.py')) return localTarget + '.py';
    if (allFileSet.has(localTarget + '/__init__.py')) return localTarget + '/__init__.py';

    // Check repo root
    if (allFileSet.has(slashPath + '.py')) return slashPath + '.py';
    if (allFileSet.has(slashPath + '/__init__.py')) return slashPath + '/__init__.py';

    // Fuzzy scan filename
    const baseName = slashPath.split('/').pop() || slashPath;
    for (const f of allFileList) {
      if (f.endsWith(`/${baseName}.py`) || f === `${baseName}.py`) {
        return f;
      }
    }
  }

  // 3. C / C++ HEADERS & SOURCES
  if (lang === 'cpp') {
    const cleanSpec = rawImport.replace(/\\/g, '/');
    const localHit = currentDir ? `${currentDir}/${cleanSpec}` : cleanSpec;
    if (allFileSet.has(localHit)) return localHit;
    if (allFileSet.has(cleanSpec)) return cleanSpec;

    const baseName = cleanSpec.split('/').pop() || cleanSpec;
    for (const f of allFileList) {
      if (f.endsWith(`/${baseName}`) || f === baseName) return f;
    }
  }

  // 4. GO PACKAGES
  if (lang === 'go') {
    for (const f of allFileList) {
      const dir = getParentDir(f);
      if (dir && rawImport.endsWith(dir)) return f;
    }
  }

  return null;
}
