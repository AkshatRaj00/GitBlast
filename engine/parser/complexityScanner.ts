import { SupportedLanguage } from '@/types/graph.types';

export function detectLanguage(filePath: string): SupportedLanguage {
  const lower = filePath.toLowerCase();
  if (/\.(ts|tsx|mts|cts)$/.test(lower)) return 'typescript';
  if (/\.(js|jsx|mjs|cjs)$/.test(lower)) return 'javascript';
  if (lower.endsWith('.py')) return 'python';
  if (/\.(c|cc|cpp|cxx|h|hh|hpp|hxx)$/.test(lower)) return 'cpp';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.java')) return 'java';
  if (/\.(kt|kts)$/.test(lower)) return 'kotlin';
  if (lower.endsWith('.cs')) return 'csharp';
  return 'unknown';
}

export function computeComplexityAndLoc(code: string, lang: SupportedLanguage) {
  const lines = code.split(/\r?\n/);
  const loc = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (lang === 'python') return !trimmed.startsWith('#');
    return !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  }).length;

  // This is a token-pattern estimate, not a language AST cyclomatic-complexity calculation.
  const sanitized = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const branchRegex = lang === 'python'
    ? /\b(if|elif|for|while|except|with|and|or)\b/g
    : /\b(if|for|while|case|catch)\b|&&|\|\||\?\?/g;
  const complexity = 1 + (sanitized.match(branchRegex)?.length || 0);
  return { loc, cyclomaticComplexity: complexity };
}