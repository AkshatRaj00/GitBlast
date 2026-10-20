import { SupportedLanguage } from '@/types/graph.types';

export function detectLanguage(filePath: string): SupportedLanguage {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  if (lower.endsWith('.go')) return 'go';
  return 'unknown';
}

export function computeComplexityAndLoc(code: string, lang: SupportedLanguage) {
  const lines = code.split(/\r?\n/);
  let loc = 0;
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (lang === 'python' && t.startsWith('#')) continue;
    if (lang !== 'python' && (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))) continue;
    loc++;
  }

  // McCabe Cyclomatic Complexity M = 1 + Decision Predicates
  let complexity = 1;
  const sanitized = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const branchRegex = lang === 'python'
    ? /\b(if|elif|for|while|except|with|and|or)\b/g
    : /\b(if|for|while|case|catch)\b|&&|\|\||\?\?/g;

  const matches = sanitized.match(branchRegex);
  if (matches) complexity += matches.length;

  return { loc: Math.max(1, loc), cyclomaticComplexity: complexity };
}
