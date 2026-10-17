export interface ParsedGitDiff {
  modifiedFiles: string[];
  addedLines: number;
  deletedLines: number;
}

export function parseRawGitDiff(diffText: string): ParsedGitDiff {
  const modifiedFiles = new Set<string>();
  let addedLines = 0;
  let deletedLines = 0;

  const lines = diffText.split(/\r?\n/);

  for (const line of lines) {
    // Standard git diff headers
    // diff --git a/src/index.ts b/src/index.ts
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch && diffMatch[2]) {
      modifiedFiles.add(diffMatch[2].trim());
      continue;
    }

    // Fallback: +++ b/path/to/file
    const plusMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (plusMatch && plusMatch[1] && plusMatch[1] !== '/dev/null') {
      modifiedFiles.add(plusMatch[1].trim());
      continue;
    }

    // Count line stats
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
    if (line.startsWith('-') && !line.startsWith('---')) deletedLines++;
  }

  return {
    modifiedFiles: Array.from(modifiedFiles),
    addedLines,
    deletedLines,
  };
}
