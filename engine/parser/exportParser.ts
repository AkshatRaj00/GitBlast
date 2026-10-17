export interface ExportedSymbol {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'unknown';
  lineNumber: number;
}

export function extractExportedSymbols(code: string): ExportedSymbol[] {
  const symbols: ExportedSymbol[] = [];
  const lines = code.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('export')) return;

    // export function foo(...)
    let m = trimmed.match(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
    if (m) {
      symbols.push({ name: m[1], type: 'function', lineNumber: idx + 1 });
      return;
    }

    // export class Foo
    m = trimmed.match(/^export\s+class\s+([A-Za-z0-9_$]+)/);
    if (m) {
      symbols.push({ name: m[1], type: 'class', lineNumber: idx + 1 });
      return;
    }

    // export const / let / var foo = ...
    m = trimmed.match(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/);
    if (m) {
      symbols.push({ name: m[1], type: 'const', lineNumber: idx + 1 });
      return;
    }

    // export type / interface Foo
    m = trimmed.match(/^export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/);
    if (m) {
      symbols.push({ name: m[1], type: 'type', lineNumber: idx + 1 });
      return;
    }

    // export default function foo / export default foo
    m = trimmed.match(/^export\s+default\s+(?:function\s+)?([A-Za-z0-9_$]+)/);
    if (m) {
      symbols.push({ name: m[1] || 'default', type: 'function', lineNumber: idx + 1 });
    }
  });

  return symbols;
}
