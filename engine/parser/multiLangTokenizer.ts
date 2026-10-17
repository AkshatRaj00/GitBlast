import { SupportedLanguage } from '@/types/graph.types';
import { resolveDynamicImportsWithConstantPropagation } from '../analysis/constantPropagation';

export function extractRawImports(code: string, lang: SupportedLanguage): string[] {
  const imports = new Set<string>();

  // Run Abstract Interpretation Constant Propagation first
  const dynamicImports = resolveDynamicImportsWithConstantPropagation(code, lang);
  dynamicImports.forEach(m => imports.add(m));

  if (lang === 'typescript' || lang === 'javascript') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const esmRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const dynamicRegex = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = esmRegex.exec(cleanCode)) !== null) { if (m[1]) imports.add(m[1].trim()); }
    while ((m = dynamicRegex.exec(cleanCode)) !== null) { if (m[1]) imports.add(m[1].trim()); }
  } else if (lang === 'python') {
    const cleanCode = code.replace(/#.*$/gm, '').replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '');
    const fromRegex = /^\s*from\s+([.\w]+)\s+import/gm;
    const directRegex = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
    let m;
    while ((m = fromRegex.exec(cleanCode)) !== null) { if (m[1]) imports.add(m[1].trim()); }
    while ((m = directRegex.exec(cleanCode)) !== null) {
      if (m[1]) {
        m[1].split(',').forEach(p => {
          const mod = p.trim().split(/\s+as\s+/)[0].trim();
          if (mod) imports.add(mod);
        });
      }
    }
  } else if (lang === 'cpp') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const incRegex = /^\s*#\s*include\s*["<]([^">]+)[">]/gm;
    let m;
    while ((m = incRegex.exec(cleanCode)) !== null) { if (m[1]) imports.add(m[1].trim()); }
  } else if (lang === 'go') {
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const singleRegex = /\bimport\s+["']([^"']+)["']/g;
    const blockRegex = /\bimport\s*\(([\s\S]*?)\)/g;
    let m;
    while ((m = singleRegex.exec(cleanCode)) !== null) { if (m[1]) imports.add(m[1].trim()); }
    while ((m = blockRegex.exec(cleanCode)) !== null) {
      const block = m[1];
      const strRegex = /["']([^"']+)["']/g;
      let sm;
      while ((sm = strRegex.exec(block)) !== null) { if (sm[1]) imports.add(sm[1].trim()); }
    }
  }

  return Array.from(imports);
}
