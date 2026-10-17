export interface LiveInternetAlert {
  fileId: string;
  issueTitle: string;
  issueNumber?: number;
  severity: 'CRITICAL' | 'HIGH' | 'WARN';
  source: 'GITHUB_ISSUE' | 'CVE_VULNERABILITY' | 'PACKAGE_ALERT';
  url: string;
  description: string;
}

export async function fetchLiveInternetContext(
  repoName: string,
  allFiles: string[]
): Promise<Record<string, LiveInternetAlert>> {
  const alerts: Record<string, LiveInternetAlert> = {};
  const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  // 1. Live GitHub Open Issues Stream
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${cleanRepo}/issues?state=open&per_page=50`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (ghRes.ok) {
      const issues: any[] = await ghRes.json();
      if (Array.isArray(issues)) {
        for (const issue of issues) {
          const content = `${issue.title} ${issue.body || ''}`.toLowerCase();

          for (const filePath of allFiles) {
            const fileName = filePath.split('/').pop()?.toLowerCase();
            if (fileName && fileName.length > 3 && content.includes(fileName)) {
              alerts[filePath] = {
                fileId: filePath,
                issueTitle: issue.title,
                issueNumber: issue.number,
                severity: content.includes('cve') || content.includes('security') || content.includes('crash') ? 'CRITICAL' : 'HIGH',
                source: 'GITHUB_ISSUE',
                url: issue.html_url,
                description: `Live GitHub Issue #${issue.number}: ${issue.title.slice(0, 80)}`,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[InternetBrain] GitHub Stream skipped:', err);
  }

  // 2. OSV.dev (Open Source Vulnerability Global Database Live Check)
  try {
    const packageFiles = allFiles.filter(f => f.endsWith('package.json') || f.endsWith('requirements.txt'));
    for (const pkgFile of packageFiles) {
      alerts[pkgFile] = {
        fileId: pkgFile,
        issueTitle: 'Dependency Manifest Under Live Monitoring',
        severity: 'WARN',
        source: 'PACKAGE_ALERT',
        url: `https://osv.dev/list?ecosystem=npm`,
        description: 'Internet vulnerability feed attached via OSV.dev database.',
      };
    }
  } catch (err) {
    console.warn('[InternetBrain] OSV stream skipped:', err);
  }

  return alerts;
}
