import { SupportedLanguage } from '@/types/graph.types';
import { resolveDynamicImportsWithConstantPropagation } from '../analysis/constantPropagation';

export function extractRawImports(code: string, lang: SupportedLanguage): string[] {
  const imports = new Set<string>();
  if (lang === 'typescript' || lang === 'javascript') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const esmRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]/g;
    const dynamicRegex = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = esmRegex.exec(cleanCode)) !== null) if (match[1]) imports.add(match[1].trim());
    while ((match = dynamicRegex.exec(cleanCode)) !== null) if (match[1]) imports.add(match[1].trim());
    resolveDynamicImportsWithConstantPropagation(cleanCode, lang).forEach((item) => imports.add(item));
  } else if (lang === 'python') {
    const cleanCode = code.replace(/#.*$/gm, '').replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '');
    const fromRegex = /^\s*from\s+([.\w]+)\s+import/gm;
    const importRegex = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
    let match: RegExpExecArray | null;
    while ((match = fromRegex.exec(cleanCode)) !== null) imports.add(match[1].trim());
    while ((match = importRegex.exec(cleanCode)) !== null) {
      match[1].split(',').forEach((part) => imports.add(part.trim().split(/\s+as\s+/)[0]));
    }
  } else if (lang === 'cpp' || lang === 'c') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const includeRegex = /^\s*#\s*include\s*["<]([^">]+)[">]/gm;
    let match: RegExpExecArray | null;
    while ((match = includeRegex.exec(cleanCode)) !== null) imports.add(match[1].trim());
  } else if (lang === 'go') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const importRegex = /\bimport\s+(?:\w+\s+)?["']([^"']+)["']/g;
    const blockRegex = /\bimport\s*\(([\s\S]*?)\)/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(cleanCode)) !== null) imports.add(match[1].trim());
    while ((match = blockRegex.exec(cleanCode)) !== null) {
      const stringRegex = /["']([^"']+)["']/g;
      let item: RegExpExecArray | null;
      while ((item = stringRegex.exec(match[1])) !== null) imports.add(item[1].trim());
    }
  } else if (lang === 'rust') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const useRegex = /^\s*(?:pub\s+)?use\s+([^;]+);/gm;
    const moduleRegex = /^\s*(?:pub\s+)?mod\s+([A-Za-z_]\w*)\s*;/gm;
    let match: RegExpExecArray | null;
    while ((match = useRegex.exec(cleanCode)) !== null) {
      const path = match[1].replace(/\{.*$/, '').replace(/::\*$/, '').trim();
      if (/^(crate|self|super)(::|$)/.test(path)) imports.add(path.replace(/::/g, '/'));
    }
    while ((match = moduleRegex.exec(cleanCode)) !== null) imports.add(match[1]);
  } else if (lang === 'java' || lang === 'kotlin') {
    const importRegex = /^\s*import\s+(?:static\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)(?:\.\*)?\s*;?/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(code)) !== null) imports.add(match[1].replace(/\./g, '/'));
  } else if (lang === 'csharp') {
    const usingRegex = /^\s*using\s+(?!static\b|var\b)([A-Za-z_][\w.]*)\s*;/gm;
    let match: RegExpExecArray | null;
    while ((match = usingRegex.exec(code)) !== null) imports.add(match[1].replace(/\./g, '/'));
  }
  return Array.from(imports);
}