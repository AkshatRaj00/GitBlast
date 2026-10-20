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
        if (p === '..') {
          if (baseParts.length === 0) return null;
          baseParts.pop();
        }
        else baseParts.push(p);
      }
      const candidate = normalizeFilePath(baseParts.join('/'));
      for (const ext of ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
        if (allFileSet.has(candidate + ext)) return candidate + ext;
      }
      if (allFileSet.has(candidate)) return candidate;
    }

    if (rawImport.startsWith('@/') || rawImport.startsWith('~/')) {
      const stripped = rawImport.replace(/^(@\/|~\/)/, '');
      const candidates = [stripped, `src/${stripped}`, `app/${stripped}`];
      for (const c of candidates) {
        for (const ext of ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
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

    const packageCandidates = [`${slashPath}.py`, `${slashPath}/__init__.py`];
    for (const candidate of packageCandidates) {
      if (allFileSet.has(candidate)) return candidate;
    }
  }

  // 3. C / C++ HEADERS & SOURCES
  if (lang === 'cpp') {
    const cleanSpec = rawImport.replace(/\\/g, '/');
    const localHit = currentDir ? `${currentDir}/${cleanSpec}` : cleanSpec;
    if (allFileSet.has(localHit)) return localHit;
    if (allFileSet.has(cleanSpec)) return cleanSpec;

    // Includes should resolve to the exact repository path. A same-name header in
    // another directory is ambiguous, so it is intentionally left unresolved.
  }

  // 4. RUST MODULES
  if (lang === 'rust') {
    const isCrateRoot = rawImport.startsWith('crate/');
    const modulePath = rawImport.replace(/^(crate|self|super)\//, '').replace(/^\.\//, '');
    if (modulePath && !modulePath.includes('::')) {
      const base = isCrateRoot
        ? (allFileSet.has('src/lib.rs') || allFileSet.has('src/main.rs') ? 'src' : '')
        : rawImport.startsWith('super/')
        ? currentDir.split('/').slice(0, -1).join('/')
        : currentDir;
      const candidate = normalizeFilePath([base, modulePath].filter(Boolean).join('/'));
      for (const path of [`${candidate}.rs`, `${candidate}/mod.rs`]) {
        if (allFileSet.has(path)) return path;
      }
    }
  }

  // 5. JVM source files. Resolve only exact package paths, never by basename.
  if (lang === 'java' || lang === 'kotlin') {
    const candidate = rawImport.replace(/\./g, '/');
    const extensions = lang === 'java' ? ['.java'] : ['.kt', '.kts'];
    for (const file of allFileList) {
      if (extensions.some((ext) => file.endsWith(`/${candidate}${ext}`) || file === `${candidate}${ext}`)) return file;
    }
  }

  // 6. Go packages
  if (lang === 'go') {
    const packageFiles = allFileList.filter((file) => {
      const dir = getParentDir(file);
      return dir && (rawImport === dir || rawImport.endsWith(`/${dir}`));
    });
    if (packageFiles.length === 1) return packageFiles[0];
  }

  return null;
}
