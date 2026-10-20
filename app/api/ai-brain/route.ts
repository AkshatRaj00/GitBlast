import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, selectedFile, blastReport, liveAlert } = await req.json();

    const groqKey = process.env.GROQ_API_KEY?.trim();
    const mistralKey = process.env.MISTRAL_API_KEY?.trim();

    // 1. Live Internet & Telemetry Augmented Cortex Context
    const internetTelemetryBlock = liveAlert
      ? `\n[LIVE INTERNET / CVE ALERT DETECTED]:
- Source: ${liveAlert.source}
- Title: ${liveAlert.issueTitle}
- Severity: ${liveAlert.severity}
- Details: ${liveAlert.description}
- Mitigation Target: ${liveAlert.mitigationAdvice || 'Assess blast radius immediately.'}`
      : '\n[LIVE INTERNET TELEMETRY]: Zero active CVEs or runtime crash reports on this specific file.';

    const systemContext = `You are JARVIS — the Autonomous Neural Chief Architect of GitBlast.
You analyze in-memory Abstract Syntax Tree (AST) graphs, topological blast-wave cascades, and real-time vulnerability feeds.

[FILE TOPOLOGY]:
- File Target: ${selectedFile?.id || 'None'}
- Size: ${selectedFile?.loc || 0} LOC
- Incoming Callers (In-Degree): ${selectedFile?.inDegree || 0}
- PageRank Score: ${selectedFile?.pageRank ? (selectedFile.pageRank * 100).toFixed(1) + '%' : '0%'}
- Total Blast Exposure: ${blastReport?.blastPercentage || 0}% (${blastReport?.totalImpactedCount || 0} downstream files)
- Critical Risk Level: ${blastReport?.severity || 'LOW'}
${internetTelemetryBlock}

INSTRUCTIONS:
1. Provide a sharp, direct architectural diagnosis. No boilerplate fluff.
2. If a live CVE or GitHub issue is active, prioritize isolating it without breaking downstream callers.
3. Formulate a 2-step surgical refactor plan:
   - Step 1: Interface containment (how to decouple dependents).
   - Step 2: Implementation patch (safe modification vector).`;

    const userPrompt = prompt || `Perform deep architectural diagnosis on ${selectedFile?.id || 'target node'}.`;

    // 2. PRIMARY: DYNAMIC GROQ ORCHESTRATION
    if (groqKey) {
      try {
        const modelListRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqKey}` },
        });

        if (modelListRes.ok) {
          const modelData = await modelListRes.json();
          const availableModels: string[] = (modelData.data || []).map((m: any) => m.id);

          const preferredOrder = [
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'llama3-70b-8192',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
          ];

          const selectedModel =
            preferredOrder.find((pref) => availableModels.includes(pref)) ||
            availableModels.find((m) => m.includes('llama') || m.includes('mixtral')) ||
            availableModels[0];

          if (selectedModel) {
            const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: 'system', content: systemContext },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.15,
                max_tokens: 750,
              }),
            });

            if (chatRes.ok) {
              const chatJson = await chatRes.json();
              const text = chatJson.choices?.[0]?.message?.content;
              if (text) {
                return NextResponse.json({
                  success: true,
                  provider: `Groq (${selectedModel})`,
                  reply: text.trim(),
                  internetSynced: Boolean(liveAlert),
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[AI-Brain] Groq dynamic dispatch error:', err.message);
      }
    }

    // 3. SECONDARY: MISTRAL AI ENGINE
    if (mistralKey) {
      try {
        const misRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [
              { role: 'system', content: systemContext },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.15,
            max_tokens: 750,
          }),
        });

        if (misRes.ok) {
          const misJson = await misRes.json();
          const reply = misJson.choices?.[0]?.message?.content;
          if (reply) {
            return NextResponse.json({
              success: true,
              provider: 'Mistral AI (mistral-small)',
              reply: reply.trim(),
              internetSynced: Boolean(liveAlert),
            });
          }
        }
      } catch (err: any) {
        console.warn('[AI-Brain] Mistral fallback failed:', err.message);
      }
    }

    // 4. AUTONOMOUS LOCAL COGNITIVE FALLBACK (Zero Crash Guarantee)
    const localFallbackReply = `[NEURAL MATRIX OFFLINE DIAGNOSIS]:
- Module: ${selectedFile?.id || 'Active Node'}
- Risk Exposure: ${blastReport?.blastPercentage || 0}% (${blastReport?.totalImpactedCount || 0} Callers Vulnerable)
- Architectural Advice: ${
      (blastReport?.blastPercentage || 0) > 20
        ? 'High coupling detected. Extract interface boundaries before modifying function signatures to prevent breaking downstream consumers.'
        : 'Node is topologically bounded. Direct surgical patches will not cause cascading breakage.'
    }
${liveAlert ? `\n- Immediate Patch: Check reported advisory (${liveAlert.issueTitle}) and isolate imports.` : ''}`;

    return NextResponse.json({
      success: true,
      provider: 'GitBlast Deterministic Core (Offline Engine)',
      reply: localFallbackReply,
      internetSynced: Boolean(liveAlert),
    });
  } catch (globalErr: any) {
    return NextResponse.json({ success: false, error: globalErr.message }, { status: 500 });
  }
}