import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, selectedFile, blastReport } = await req.json();

    const groqKey = process.env.GROQ_API_KEY?.trim();
    const mistralKey = process.env.MISTRAL_API_KEY?.trim();

    const systemContext = `You are Jarvis, the Autonomous Chief Software Architect inside GitBlast.
Target: ${selectedFile?.id || 'None'}
LOC: ${selectedFile?.loc || 0}
In-Degree: ${selectedFile?.inDegree || 0}
Blast Radius: ${blastReport?.blastPercentage || 0}%
Give brief, sharp architectural diagnosis and refactor tips.`;

    // 1. DYNAMIC GROQ MODEL DISCOVERY & EXECUTION
    if (groqKey) {
      try {
        // Fetch active available models directly from your Groq account
        const modelListRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqKey}` },
        });

        if (modelListRes.ok) {
          const modelData = await modelListRes.json();
          const availableModels: string[] = (modelData.data || []).map((m: any) => m.id);
          
          // Pick the best available model
          const selectedModel =
            availableModels.find((m) => m.includes('llama-3') || m.includes('llama3') || m.includes('mixtral') || m.includes('gemma')) ||
            availableModels[0];

          if (selectedModel) {
            console.log(`[AI-Brain] Auto-selected active Groq model: ${selectedModel}`);
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
                  { role: 'user', content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 800,
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
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[AI-Brain] Groq auto-detect failed:', err.message);
      }
    }

    // 2. MISTRAL AI FALLBACK (open-mistral-7b)
    if (mistralKey) {
      try {
        console.log('[AI-Brain] Switching to Mistral AI (open-mistral-7b)...');
        const misRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'open-mistral-7b',
            messages: [
              { role: 'system', content: systemContext },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 800,
          }),
        });

        if (misRes.ok) {
          const misJson = await misRes.json();
          const reply = misJson.choices?.[0]?.message?.content;
          if (reply) {
            return NextResponse.json({
              success: true,
              provider: 'Mistral AI (open-mistral-7b)',
              reply: reply.trim(),
            });
          }
        }
      } catch (err: any) {
        console.warn('[AI-Brain] Mistral failed:', err.message);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Could not connect to Groq or Mistral. Check API key permissions.' },
      { status: 502 }
    );
  } catch (globalErr: any) {
    return NextResponse.json({ success: false, error: globalErr.message }, { status: 500 });
  }
}
