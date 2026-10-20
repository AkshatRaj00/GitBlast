/** Query the OSV database for real advisories and map affected source imports. */
export interface SupplyChainAdvisory {
  packageId: string;
  version: string;
  ecosystem: 'npm' | 'pypi' | 'crates' | 'go';
  cveId: string;
  cvss: number | null;
  compromisedFunctions: string[];
}

export interface SupplyChainShockwaveResult {
  advisory: SupplyChainAdvisory;
  impactedModules: string[];
  systemicRiskRatio: number;
  criticality: 'SYSTEMIC_HALT' | 'HIGH_EXPOSURE' | 'MODERATE_DRIFT';
}

const OSV_ECOSYSTEM: Record<SupplyChainAdvisory['ecosystem'], string> = {
  npm: 'npm', pypi: 'PyPI', crates: 'crates.io', go: 'Go',
};

export class GlobalSupplyChainEngine {
  static async simulatePackageExploit(
    packageName: string,
    version: string,
    ecosystem: SupplyChainAdvisory['ecosystem'],
    localImportsMap: Record<string, string[]>
  ): Promise<SupplyChainShockwaveResult[]> {
    const response = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ package: { name: packageName, ecosystem: OSV_ECOSYSTEM[ecosystem] }, version }),
    });
    if (!response.ok) throw new Error('OSV advisory lookup failed (' + response.status + ').');
    const data = await response.json() as { vulns?: Array<Record<string, unknown>> };
    const impactedModules = Object.entries(localImportsMap)
      .filter(([, imports]) => imports.some((item) => item.toLowerCase() === packageName.toLowerCase() || item.toLowerCase().startsWith(packageName.toLowerCase() + '/')))
      .map(([path]) => path);
    const ratio = Number(((impactedModules.length / Math.max(1, Object.keys(localImportsMap).length)) * 100).toFixed(2));
    const criticality = ratio > 25 ? 'SYSTEMIC_HALT' : ratio > 8 ? 'HIGH_EXPOSURE' : 'MODERATE_DRIFT';
    return (data.vulns || []).map((vuln) => {
      const severity = Array.isArray(vuln.severity) ? vuln.severity as Array<{ score?: string }> : [];
      const score = severity.map((entry) => Number(entry.score)).find((value) => Number.isFinite(value) && value > 0);
      const aliases = Array.isArray(vuln.aliases) ? vuln.aliases as string[] : [];
      return {
        advisory: {
          packageId: packageName, version, ecosystem,
          cveId: aliases.find((alias) => alias.startsWith('CVE-')) || String(vuln.id || 'OSV advisory'),
          cvss: score ?? null,
          compromisedFunctions: [],
        },
        impactedModules,
        systemicRiskRatio: ratio,
        criticality,
      };
    });
  }
}
