export interface DetectedBug {
  fileId: string;
  line: number;
  type: 'POTENTIAL_NULL_DEREF' | 'UNHANDLED_ASYNC' | 'SQL_INJECTION' | 'RESOURCE_LEAK' | 'EMPTY_CATCH';
  severity: 'CRITICAL' | 'HIGH' | 'WARN';
  message: string;
  snippet: string;
}

export function detectBugsInSource(fileId: string, content: string): DetectedBug[] {
  const bugs: DetectedBug[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const lineNum = idx + 1;

    // 1. Empty Catch Block (Swallowing runtime errors)
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
      bugs.push({
        fileId,
        line: lineNum,
        type: 'EMPTY_CATCH',
        severity: 'HIGH',
        message: 'Empty catch block silently swallows exceptions.',
        snippet: trimmed,
      });
    }

    // 2. Unhandled Promise without catch or await
    if (/\.then\s*\(/.test(trimmed) && !trimmed.includes('.catch') && !content.includes('.catch(')) {
      bugs.push({
        fileId,
        line: lineNum,
        type: 'UNHANDLED_ASYNC',
        severity: 'WARN',
        message: 'Promise chain missing .catch() rejection handler.',
        snippet: trimmed,
      });
    }

    // 3. Raw SQL String Concatenation (SQLi Risk)
    if (/(?:query|execute)\s*\(\s*['"`].*?\b(SELECT|INSERT|UPDATE|DELETE)\b.*?\$\{|\s*\+\s*[A-Za-z0-9_$]+/i.test(trimmed)) {
      bugs.push({
        fileId,
        line: lineNum,
        type: 'SQL_INJECTION',
        severity: 'CRITICAL',
        message: 'Potential SQL Injection: Direct string interpolation in database query.',
        snippet: trimmed,
      });
    }

    // 4. Memory/Resource Leak (setInterval without clear or window listener without remove)
    if (/setInterval\s*\(/.test(trimmed) && !content.includes('clearInterval')) {
      bugs.push({
        fileId,
        line: lineNum,
        type: 'RESOURCE_LEAK',
        severity: 'HIGH',
        message: 'Active setInterval loop detected without clearInterval disposal.',
        snippet: trimmed,
      });
    }
  });

  return bugs;
}
