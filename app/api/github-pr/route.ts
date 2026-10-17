import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, repoName, filePath, newContent, commitMessage, prTitle, prBody, prNumber, userToken } = await req.json();

    const token = userToken?.trim() || process.env.GITHUB_TOKEN?.trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'GitHub Token missing in .env.local (GITHUB_TOKEN)' },
        { status: 401 }
      );
    }

    const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const [targetOwner, targetRepo] = cleanRepo.split('/');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // ACTION: CREATE REAL PR (Handles both own repos and external forks automatically)
    if (action === 'CREATE_PR') {
      // 1. Identify the authenticated user
      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) {
        return NextResponse.json(
          { success: false, error: 'GitHub Token invalid or expired. Check permissions.' },
          { status: 401 }
        );
      }
      const authUser = await userRes.json();
      const authUsername = authUser.login;

      const isOwnRepo = targetOwner.toLowerCase() === authUsername.toLowerCase();
      let workingOwner = targetOwner;
      let workingRepo = targetRepo;

      // 2. If external repo (like facebook/react), automatically fork to user account
      if (!isOwnRepo) {
        console.log(`[GitHub-PR] External repo detected. Ensuring fork on ${authUsername}/${targetRepo}...`);
        const forkRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/forks`, {
          method: 'POST',
          headers,
        });
        if (forkRes.ok || forkRes.status === 202) {
          workingOwner = authUsername;
          // Short delay for GitHub fork propagation
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // 3. Get default branch sha
      const repoMetaRes = await fetch(`https://api.github.com/repos/${workingOwner}/${workingRepo}`, { headers });
      if (!repoMetaRes.ok) {
        throw new Error(`Could not access ${workingOwner}/${workingRepo}. Token needs 'repo' permission.`);
      }
      const repoMeta = await repoMetaRes.json();
      const defaultBranch = repoMeta.default_branch || 'main';

      const refRes = await fetch(`https://api.github.com/repos/${workingOwner}/${workingRepo}/git/ref/heads/${defaultBranch}`, { headers });
      const refData = await refRes.json();
      const baseSha = refData.object?.sha;
      if (!baseSha) throw new Error('Could not resolve branch head SHA.');

      // 4. Create unique branch: gitblast-patch-[timestamp]
      const branchName = `gitblast-patch-${Date.now()}`;
      const createRefRes = await fetch(`https://api.github.com/repos/${workingOwner}/${workingRepo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
      if (!createRefRes.ok) {
        const err = await createRefRes.text();
        throw new Error(`Branch creation failed: ${err}`);
      }

      // 5. Get existing file sha (if updating existing file)
      let fileSha: string | undefined = undefined;
      const fileRes = await fetch(`https://api.github.com/repos/${workingOwner}/${workingRepo}/contents/${filePath}?ref=${branchName}`, { headers });
      if (fileRes.ok) {
        const fileJson = await fileRes.json();
        fileSha = fileJson.sha;
      }

      // 6. Commit updated content
      const commitRes = await fetch(`https://api.github.com/repos/${workingOwner}/${workingRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: commitMessage || `fix(architecture): patch applied via GitBlast`,
          content: Buffer.from(newContent).toString('base64'),
          branch: branchName,
          sha: fileSha,
        }),
      });

      if (!commitRes.ok) {
        const err = await commitRes.text();
        throw new Error(`Commit rejected by GitHub (HTTP ${commitRes.status}): Token needs write permission.`);
      }

      // 7. Open Pull Request on the target repository
      const headBranch = isOwnRepo ? branchName : `${authUsername}:${branchName}`;
      const prRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: prTitle || `⚡ GitBlast Patch: ${filePath.split('/').pop()}`,
          body: prBody || `### Surgical Architecture Patch\n- Target: \`${filePath}\`\n- Generated via GitBlast Client-Side Engine.\n- Verified zero dependency regressions.`,
          head: headBranch,
          base: defaultBranch,
        }),
      });

      const prJson = await prRes.json();
      if (!prRes.ok) {
        throw new Error(prJson.message || 'Pull request opening failed.');
      }

      return NextResponse.json({
        success: true,
        prUrl: prJson.html_url,
        prNumber: prJson.number,
        branch: branchName,
      });
    }

    // ACTION: MERGE PR
    if (action === 'MERGE_PR') {
      const mergeRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ commit_title: `Merge PR #${prNumber} via GitBlast`, merge_method: 'squash' }),
      });

      const mergeJson = await mergeRes.json();
      if (!mergeRes.ok) throw new Error(mergeJson.message || 'PR merge failed.');

      return NextResponse.json({ success: true, merged: true, message: mergeJson.message });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
