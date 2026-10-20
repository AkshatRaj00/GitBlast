import { ModuleSymbolTable } from '../parser/symbolResolver';

export interface SymbolImpact {
  symbolName: string;
  kind: string;
  definedIn: string;
  brokenCallers: {
    filePath: string;
    line: number;
  }[];
}

export interface SymbolBlastReport {
  targetFiles: string[];
  totalSymbolsCompromised: number;
  impactedSymbols: SymbolImpact[];
  transitiveFilesCount: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
}

/**
 * Calculates deterministic symbol-level transitive blast radius.
 */
export function calculateSymbolBlast(
  targetFiles: string[],
  symbolTables: Map<string, ModuleSymbolTable>
): SymbolBlastReport {
  const impactedSymbols: SymbolImpact[] = [];
  const brokenFileSet = new Set<string>();

  targetFiles.forEach((targetPath) => {
    const table = symbolTables.get(targetPath);
    if (!table) return;

    table.exports.forEach((exp) => {
      const brokenCallers: { filePath: string; line: number }[] = [];

      // Check which downstream files imported this exact symbol
      symbolTables.forEach((callerTable, callerPath) => {
        if (callerPath === targetPath) return;

        callerTable.imports.forEach((imp) => {
          // Check if import matches the exported symbol
          if (
            imp.name === exp.name ||
            (imp.isNamespace && imp.sourceModule.includes(targetPath.split('/').pop()?.split('.')[0] || ''))
          ) {
            brokenCallers.push({
              filePath: callerPath,
              line: imp.line,
            });
            brokenFileSet.add(callerPath);
          }
        });
      });

      if (brokenCallers.length > 0) {
        impactedSymbols.push({
          symbolName: exp.name,
          kind: exp.kind,
          definedIn: targetPath,
          brokenCallers,
        });
      }
    });
  });

  const totalBroken = brokenFileSet.size;
  let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';

  if (totalBroken > 20 || impactedSymbols.some((s) => s.kind === 'type' && s.brokenCallers.length > 10)) {
    severity = 'CRITICAL';
  } else if (totalBroken > 8) {
    severity = 'HIGH';
  } else if (totalBroken > 2) {
    severity = 'MODERATE';
  }

  return {
    targetFiles,
    totalSymbolsCompromised: impactedSymbols.length,
    impactedSymbols,
    transitiveFilesCount: totalBroken,
    severity,
  };
}
