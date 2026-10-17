export function resolveDynamicImportsWithConstantPropagation(code: string, lang: string): string[] {
  const resolvedModules: string[] = [];
  const stringConstants = new Map<string, string>();

  const lines = code.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // 1. Constant Propagation: Track variable string assignments (e.g. mod_name = "models." + "classifier")
    const assignMatch = trimmed.match(/(?:const|let|var|)\s*([A-Za-z0-9_$]+)\s*=\s*(['"][^'"]+['"](?:\s*\+\s*['"][^'"]+['"])*)/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const expr = assignMatch[2];
      const evaluated = expr.split('+').map(p => p.trim().replace(/^['"]|['"]$/g, '')).join('');
      stringConstants.set(varName, evaluated);
    }

    // 2. Python Dynamic __import__('name') or importlib.import_module(var)
    if (lang === 'python') {
      const dynPyMatch = trimmed.match(/(?:importlib\.import_module|__import__)\s*\(\s*([A-Za-z0-9_$'"]+)/);
      if (dynPyMatch) {
        const rawArg = dynPyMatch[1].trim().replace(/^['"]|['"]$/g, '');
        const target = stringConstants.get(rawArg) || rawArg;
        if (target && !target.includes('(')) resolvedModules.push(target);
      }
    }

    // 3. JavaScript/TypeScript Dynamic import(`...`) or require(var)
    if (lang === 'typescript' || lang === 'javascript') {
      const dynJsMatch = trimmed.match(/(?:import|require)\s*\(\s*([A-Za-z0-9_$'"`]+)/);
      if (dynJsMatch) {
        const rawArg = dynJsMatch[1].trim().replace(/^['"`]|['"`]$/g, '');
        const target = stringConstants.get(rawArg) || rawArg;
        if (target && !target.includes('(')) resolvedModules.push(target);
      }
    }
  }

  return resolvedModules;
}
