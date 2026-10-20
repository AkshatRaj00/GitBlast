/**
 * GitBlast Security Intelligence Cortex
 * High-Throughput Live CVE Telemetry & GitHub Security Advisory Engine
 * 
 * Intersects AST repository files with:
 * 1. Google OSV (Open Source Vulnerabilities) Global Database (NPM, PyPI, Go, Crates.io)
 * 2. GitHub Security Advisories & Bug Issue Streams
 * 3. Exact Dependency Manifest Resolvers (package.json, requirements.txt, go.mod, Cargo.toml)
 */

export interface LiveInternetAlert {
  fileId: string;
  issueTitle: string;
  issueNumber?: number;
  severity: 'CRITICAL' | 'HIGH' | 'WARN';
  source: 'GITHUB_ISSUE' | 'CVE_VULNERABILITY' | 'PACKAGE_ALERT' | 'LIVE_EXPLOIT';
  url: string;
  description: string;
  cveId?: string;
  cweIds?: string[];
  cvssScore?: number;
  affectedPackage?: string;
  mitigationAdvice: string;
}

interface OSVQueryPackage {
  package: {
    name: string;
    ecosystem: 'npm' | 'PyPI' | 'Go' | 'crates.io' | 'Maven';
  };
  version?: string;
}

interface OSVVulnerabilityItem {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  database_specific?: {
    severity?: string;
    cwe_ids?: string[];
    cvss?: {
      score?: number;
    };
  };
  references?: Array<{ type: string; url: string }>;
}

/**
 * Extracts real package identifiers from raw manifest contents
 */
export function extractPackagesFromManifest(
  filePath: string,
  content: string
): OSVQueryPackage[] {
  const packages: OSVQueryPackage[] = [];
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';

  try {
    // 1. Node.js / NPM: package.json
    if (fileName === 'package.json') {
      const parsed = JSON.parse(content);
      const allDeps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };

      for (const [name, rawVersion] of Object.entries(allDeps)) {
        const cleanVer = (rawVersion as string).replace(/[\^~>=<]/g, '').trim();
        packages.push({
          package: { name, ecosystem: 'npm' },
          ...(cleanVer && /^\d/.test(cleanVer) ? { version: cleanVer } : {}),
        });
      }
    }
    // 2. Python: requirements.txt
    else if (fileName === 'requirements.txt' || fileName.endsWith('.req')) {
      const lines = content.split('\n');
      for (const line of lines) {
        const clean = line.split('#')[0].trim();
        if (!clean || clean.startsWith('-')) continue;

        const match = clean.match(/^([a-zA-Z0-9_\-\.]+)(?:[=><~!~^]+([a-zA-Z0-9_\-\.]+))?/);
        if (match) {
          const name = match[1].toLowerCase();
          const version = match[2];
          packages.push({
            package: { name, ecosystem: 'PyPI' },
            ...(version ? { version } : {}),
          });
        }
      }
    }
    // 3. Go: go.mod
    else if (fileName === 'go.mod') {
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.trim().match(/^([a-zA-Z0-9_\-\.\/]+)\s+v([0-9\.]+)/);
        if (match && !line.includes('// indirect')) {
          packages.push({
            package: { name: match[1], ecosystem: 'Go' },
            version: match[2],
          });
        }
      }
    }
    // 4. Rust: Cargo.toml
    else if (fileName === 'cargo.toml') {
      let inDepsBlock = false;
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[')) {
          inDepsBlock = trimmed.includes('dependencies');
          continue;
        }
        if (inDepsBlock && trimmed) {
          const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(?:\{.*version\s*=\s*"([^"]+)".*\}|"([^"]+)")/);
          if (match) {
            const name = match[1];
            const version = (match[2] || match[3] || '').replace(/[\^~>=<]/g, '').trim();
            packages.push({
              package: { name, ecosystem: 'crates.io' },
              ...(version ? { version } : {}),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[SecurityCortex] Failed to tokenize manifest ${filePath}:`, err);
  }

  return packages;
}

/**
 * Universal Security Telemetry Ingestion Pipeline
 */
export async function fetchLiveInternetContext(
  repoName: string,
  allFiles: string[],
  manifestBuffers: Record<string, string> = {}
): Promise<Record<string, LiveInternetAlert>> {
  const alerts: Record<string, LiveInternetAlert> = {};
  const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  // =========================================================================
  // 1. DYNAMIC OSV BATCH QUERY (Google Open Source Vulnerabilities Registry)
  // =========================================================================
  try {
    const manifestFiles = allFiles.filter((f) => {
      const lower = f.toLowerCase();
      return (
        lower.endsWith('package.json') ||
        lower.endsWith('requirements.txt') ||
        lower.endsWith('go.mod') ||
        lower.endsWith('cargo.toml')
      );
    });

    const queryBatch: OSVQueryPackage[] = [];
    const manifestToPackageMap = new Map<number, string>(); // index in queryBatch -> manifestFilePath

    for (const manifestPath of manifestFiles) {
      const content = manifestBuffers[manifestPath] || '';
      if (content) {
        const pkgs = extractPackagesFromManifest(manifestPath, content);
        for (const pkg of pkgs) {
          manifestToPackageMap.set(queryBatch.length, manifestPath);
          queryBatch.push(pkg);
        }
      }
    }

    // Execute bulk batch in chunks of 500 to conform to OSV payload limits
    const BATCH_CHUNK_SIZE = 500;
    for (let i = 0; i < queryBatch.length; i += BATCH_CHUNK_SIZE) {
      const chunk = queryBatch.slice(i, i + BATCH_CHUNK_SIZE);

      const osvRes = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: chunk }),
      });

      if (osvRes.ok) {
        const osvData = await osvRes.json();
        const results: Array<{ vulns?: OSVVulnerabilityItem[] }> = osvData.results || [];

        results.forEach((item, relativeIdx) => {
          const globalIdx = i + relativeIdx;
          const manifestPath = manifestToPackageMap.get(globalIdx);
          const pkgMeta = queryBatch[globalIdx];

          if (manifestPath && item.vulns && item.vulns.length > 0) {
            const topVuln = item.vulns[0];
            const cveAlias = (topVuln.aliases || []).find((a) => a.startsWith('CVE-')) || topVuln.id;
            const cweList = topVuln.database_specific?.cwe_ids || [];
            const cvss = topVuln.database_specific?.cvss?.score;

            // Map vulnerability directly to the manifest file node
            alerts[manifestPath] = {
              fileId: manifestPath,
              issueTitle: `${cveAlias}: ${topVuln.summary || 'Critical Advisory in ' + pkgMeta.package.name}`,
              severity: cvss && cvss >= 9.0 ? 'CRITICAL' : 'HIGH',
              source: 'CVE_VULNERABILITY',
              cveId: cveAlias,
              cweIds: cweList.length > 0 ? cweList : undefined,
              cvssScore: cvss,
              affectedPackage: `${pkgMeta.package.name}${pkgMeta.version ? '@' + pkgMeta.version : ''}`,
              url: topVuln.references?.[0]?.url || `https://osv.dev/vulnerability/${topVuln.id}`,
              description: topVuln.details
                ? topVuln.details.replace(/[\r\n]+/g, ' ').slice(0, 160) + '...'
                : `Vulnerability identified in ${pkgMeta.package.name} (${pkgMeta.package.ecosystem}).`,
              mitigationAdvice: `Isolate dependent AST imports and patch ${pkgMeta.package.name} to non-vulnerable release.`,
            };
          }
        });
      }
    }
  } catch (err) {
    console.warn('[SecurityCortex] Real OSV Batch resolution encountered a network drop:', err);
  }

  // =========================================================================
  // 2. DISCRIMINATIVE GITHUB ISSUE & SECURITY ADVISORY STREAM
  // =========================================================================
  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/issues?state=open&sort=comments&direction=desc&per_page=75`,
      {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }
    );

    if (ghRes.ok) {
      const issues: any[] = await ghRes.json();

      if (Array.isArray(issues)) {
        // Compile exact regex matchers for all codebase files to eliminate false-positives
        const fileMatcherRegistry = allFiles.map((fullPath) => {
          const parts = fullPath.split('/');
          const fileName = parts[parts.length - 1];
          const baseName = fileName.replace(/\.[^/.]+$/, '');
          return {
            fullPath,
            fileNameLower: fileName.toLowerCase(),
            // Match exact word boundaries only (avoids matching 'test' inside 'contest' or generic terms)
            exactRegex: new RegExp(`\\b${fileName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'),
            isLengthSignificant: baseName.length > 3,
          };
        });

        for (const issue of issues) {
          if (issue.pull_request) continue; // Target actual defect reports only

          const labels = (issue.labels || []).map((l: any) => l.name.toLowerCase()).join(' ');
          const issueContent = `${issue.title}\n${issue.body || ''}`.toLowerCase();
          const combinedPayload = `${labels} ${issueContent}`;

          const isSecurityThreat =
            combinedPayload.includes('cve-') ||
            combinedPayload.includes('security') ||
            combinedPayload.includes('vulnerability') ||
            combinedPayload.includes('arbitrary code') ||
            combinedPayload.includes('buffer overflow') ||
            combinedPayload.includes('memory leak');

          const isCrashDefect =
            combinedPayload.includes('crash') ||
            combinedPayload.includes('segfault') ||
            combinedPayload.includes('nullpointer') ||
            combinedPayload.includes('unhandled exception') ||
            combinedPayload.includes('broken');

          if (!isSecurityThreat && !isCrashDefect && issue.comments === 0) {
            continue; // Ignore low-signal discussions
          }

          for (const item of fileMatcherRegistry) {
            if (!item.isLengthSignificant) continue;

            // Strict test: the file name must appear as an exact symbol boundary in the issue text
            if (item.exactRegex.test(issue.title) || item.exactRegex.test(issue.body || '')) {
              // Avoid overwriting a CVE vulnerability with a standard GitHub issue
              if (alerts[item.fullPath] && alerts[item.fullPath].source === 'CVE_VULNERABILITY') {
                continue;
              }

              alerts[item.fullPath] = {
                fileId: item.fullPath,
                issueTitle: `GitHub #${issue.number}: ${issue.title.slice(0, 80)}`,
                issueNumber: issue.number,
                severity: isSecurityThreat ? 'CRITICAL' : 'HIGH',
                source: isSecurityThreat ? 'LIVE_EXPLOIT' : 'GITHUB_ISSUE',
                url: issue.html_url,
                description: issue.body
                  ? issue.body.replace(/[\r\n]+/g, ' ').slice(0, 150) + '...'
                  : `Active production defect logged against ${item.fileNameLower}.`,
                mitigationAdvice: isSecurityThreat
                  ? 'Audit execution path for unsanitized input vectors or memory corruption.'
                  : 'Review regression tests and recent changes across upstream callers.',
              };
              break;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SecurityCortex] GitHub Issue Stream deferred:', err);
  }

  return alerts;
}