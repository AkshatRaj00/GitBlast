interface AbstractState {
  stringLiterals: Map<string, string>;
  mapDictionaries: Map<string, Map<string, string>>;
}

function isEnclosedLiteral(s: string): boolean {
  if (s.length >= 2) {
    if (s.startsWith("'") && s.endsWith("'")) return true;
    if (s.startsWith('"') && s.endsWith('"')) return true;
    if (s.startsWith('`') && s.endsWith('`')) return true;
  }
  return false;
}

function evaluateStringExpression(expr: string, state: AbstractState): string | null {
  const cleanExpr = expr.trim();
  
  if (isEnclosedLiteral(cleanExpr)) {
    return cleanExpr.slice(1, -1);
  }

  const parts = cleanExpr.split(/\s*\+\s*/);
  if (parts.length > 1) {
    let combined = '';
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (isEnclosedLiteral(trimmedPart)) {
        combined += trimmedPart.slice(1, -1);
      } else if (state.stringLiterals.has(trimmedPart)) {
        combined += state.stringLiterals.get(trimmedPart)!;
      } else {
        combined += '*';
      }
    }
    return combined.includes('*') ? null : combined;
  }

  if (state.stringLiterals.has(cleanExpr)) {
    return state.stringLiterals.get(cleanExpr)!;
  }

  return null;
}

export function resolveDynamicImportsWithConstantPropagation(code: string, lang: string): string[] {
  const resolvedModules = new Set<string>();
  const state: AbstractState = {
    stringLiterals: new Map<string, string>(),
    mapDictionaries: new Map<string, Map<string, string>>(),
  };

  const normalizedLang = lang.toLowerCase();
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;

    const jsAssign = line.match(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(.+?);?$/);
    if (jsAssign && (normalizedLang === 'typescript' || normalizedLang === 'javascript')) {
      const varName = jsAssign[1];
      const rawRhs = jsAssign[2].trim();

      if (rawRhs.startsWith('{') && rawRhs.endsWith('}')) {
        const dict = new Map<string, string>();
        const pairs = rawRhs.slice(1, -1).split(',');
        for (const pair of pairs) {
          const [key, val] = pair.split(':').map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''));
          if (key && val) dict.set(key, val);
        }
        state.mapDictionaries.set(varName, dict);
      } else {
        const evaluated = evaluateStringExpression(rawRhs, state);
        if (evaluated) state.stringLiterals.set(varName, evaluated);
      }
    }

    const pyAssign = line.match(/^([a-zA-Z_][\w]*)\s*=\s*(.+)$/);
    if (pyAssign && normalizedLang === 'python') {
      const varName = pyAssign[1];
      const rawRhs = pyAssign[2].trim();

      if (rawRhs.startsWith('{') && rawRhs.endsWith('}')) {
        const dict = new Map<string, string>();
        const pairs = rawRhs.slice(1, -1).split(',');
        for (const pair of pairs) {
          const [key, val] = pair.split(':').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
          if (key && val) dict.set(key, val);
        }
        state.mapDictionaries.set(varName, dict);
      } else {
        const evaluated = evaluateStringExpression(rawRhs, state);
        if (evaluated) state.stringLiterals.set(varName, evaluated);
      }
    }

    if (normalizedLang === 'python') {
      const pyDynMatch = line.match(/(?:importlib\.import_module|__import__)\s*\(\s*(.+?)\s*\)/);
      if (pyDynMatch) {
        const rawArg = pyDynMatch[1].trim();

        if (isEnclosedLiteral(rawArg)) {
          resolvedModules.add(rawArg.slice(1, -1));
          continue;
        }

        if (state.stringLiterals.has(rawArg)) {
          resolvedModules.add(state.stringLiterals.get(rawArg)!);
          continue;
        }

        const dictAccess = rawArg.match(/^([a-zA-Z_][\w]*)\[\s*(['"])(.*?)\2\s*\]$/);
        if (dictAccess) {
          const dict = state.mapDictionaries.get(dictAccess[1]);
          const key = dictAccess[3];
          if (dict && dict.has(key)) {
            resolvedModules.add(dict.get(key)!);
            continue;
          }
        }

        const fStringMatch = rawArg.match(/^f['"](.*?)['"]$/);
        if (fStringMatch) {
          let resolvedFString = fStringMatch[1];
          const placeholders = resolvedFString.match(/\{([a-zA-Z_][\w]*)\}/g);
          let allSubstituted = true;

          if (placeholders) {
            for (const ph of placeholders) {
              const v = ph.slice(1, -1);
              if (state.stringLiterals.has(v)) {
                resolvedFString = resolvedFString.replace(ph, state.stringLiterals.get(v)!);
              } else {
                allSubstituted = false;
                break;
              }
            }
          }
          if (allSubstituted) {
            resolvedModules.add(resolvedFString);
          }
        }
      }
    }

    if (normalizedLang === 'typescript' || normalizedLang === 'javascript') {
      const jsDynMatch = line.match(/(?:import|require)\s*\(\s*(.+?)\s*\)/);
      if (jsDynMatch) {
        const rawArg = jsDynMatch[1].trim();

        if (isEnclosedLiteral(rawArg)) {
          resolvedModules.add(rawArg.slice(1, -1));
          continue;
        }

        if (state.stringLiterals.has(rawArg)) {
          resolvedModules.add(state.stringLiterals.get(rawArg)!);
          continue;
        }

        const propAccess = rawArg.match(/^([a-zA-Z_$][\w$]*)\[\s*(['"`])(.*?)\2\s*\]$/);
        if (propAccess) {
          const dict = state.mapDictionaries.get(propAccess[1]);
          const key = propAccess[3];
          if (dict && dict.has(key)) {
            resolvedModules.add(dict.get(key)!);
            continue;
          }
        }

        if (rawArg.startsWith('`') && rawArg.endsWith('`')) {
          let templateBody = rawArg.slice(1, -1);
          const exprMatches = templateBody.match(/\$\{([a-zA-Z_$][\w$]*)\}/g);
          let validResolution = true;

          if (exprMatches) {
            for (const placeholder of exprMatches) {
              const varIdentifier = placeholder.slice(2, -1);
              if (state.stringLiterals.has(varIdentifier)) {
                templateBody = templateBody.replace(placeholder, state.stringLiterals.get(varIdentifier)!);
              } else {
                validResolution = false;
                break;
              }
            }
          }
          if (validResolution) {
            resolvedModules.add(templateBody);
          }
        }
      }
    }
  }

  return Array.from(resolvedModules)
    .map((mod) => mod.replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter((mod) => mod.length > 0 && !mod.includes('('));
}
