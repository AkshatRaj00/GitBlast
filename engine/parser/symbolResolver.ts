export interface SymbolExport {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'variable' | 'unknown';
  line: number;
}

export interface SymbolImport {
  name: string;
  sourceModule: string;
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface ModuleSymbolTable {
  filePath: string;
  canonicalId: string;
  exports: SymbolExport[];
  imports: SymbolImport[];
  directDependencies: string[];
}

/**
 * Deterministic Token-Scan Lexer (Works universally without heavy WASM bundles)
 * Parses lexical tokens to construct genuine symbol-level exports and imports.
 */
export function parseModuleSymbols(filePath: string, content: string): ModuleSymbolTable {
  const exports: SymbolExport[] = [];
  const imports: SymbolImport[] = [];
  const directDependencies = new Set<string>();

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const lines = content.split('\n');

  // --- JavaScript / TypeScript Parser ---
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    // 1. Match Imports
    const importRegex = /import\s+(?:(\*\s+as\s+[\w$]+)|([\w$]+)|(?:\{([\s\S]*?)\}))?\s*from\s*['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const isNamespace = Boolean(match[1]);
      const defaultImport = match[2];
      const namedBlock = match[3];
      const source = match[4];

      if (!source) continue;
      directDependencies.add(source);

      if (defaultImport) {
        imports.push({ name: defaultImport, sourceModule: source, isDefault: true, isNamespace: false, line: 1 });
      }
      if (namedBlock) {
        namedBlock.split(',').forEach((sym) => {
          const clean = sym.trim().split(/\s+as\s+/)[0]?.trim();
          if (clean) {
            imports.push({ name: clean, sourceModule: source, isDefault: false, isNamespace: false, line: 1 });
          }
        });
      }
    }

    // 2. Match Exports
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const fnMatch = lineText.match(/export\s+(?:async\s+)?function\s+([\w$]+)/);
      if (fnMatch) exports.push({ name: fnMatch[1], kind: 'function', line: lineNum });

      const clsMatch = lineText.match(/export\s+class\s+([\w$]+)/);
      if (clsMatch) exports.push({ name: clsMatch[1], kind: 'class', line: lineNum });

      const intMatch = lineText.match(/export\s+(?:interface|type)\s+([\w$]+)/);
      if (intMatch) exports.push({ name: intMatch[1], kind: 'type', line: lineNum });

      const constMatch = lineText.match(/export\s+const\s+([\w$]+)/);
      if (constMatch) exports.push({ name: constMatch[1], kind: 'const', line: lineNum });
    });
  }

  // --- Python Parser ---
  else if (ext === 'py') {
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const pyFrom = lineText.match(/^\s*from\s+([\w.]+)\s+import\s+(.*)/);
      if (pyFrom) {
        const source = pyFrom[1].replace(/\./g, '/');
        directDependencies.add(source);
        pyFrom[2].split(',').forEach((sym) => {
          const sName = sym.trim().split(/\s+as\s+/)[0]?.trim();
          if (sName && sName !== '*') {
            imports.push({ name: sName, sourceModule: source, isDefault: false, isNamespace: false, line: lineNum });
          }
        });
      }

      const pyImp = lineText.match(/^\s*import\s+([\w.]+)/);
      if (pyImp) {
        const source = pyImp[1].replace(/\./g, '/');
        directDependencies.add(source);
        imports.push({ name: pyImp[1], sourceModule: source, isDefault: true, isNamespace: true, line: lineNum });
      }

      const fnDef = lineText.match(/^def\s+([\w]+)\s*\(/);
      if (fnDef) exports.push({ name: fnDef[1], kind: 'function', line: lineNum });

      const clsDef = lineText.match(/^class\s+([\w]+)\s*[:\(]/);
      if (clsDef) exports.push({ name: clsDef[1], kind: 'class', line: lineNum });
    });
  }

  return {
    filePath,
    canonicalId: filePath.replace(/\\/g, '/'),
    exports,
    imports,
    directDependencies: Array.from(directDependencies),
  };
}
