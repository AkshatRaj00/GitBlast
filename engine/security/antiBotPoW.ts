export interface BotCheckResult {
  isBot: boolean;
  reason?: string;
  fingerprint: string;
}

// Layer 1: Headless & Automation Flags Detection
export function detectAutomatedHeadlessBrowser(): BotCheckResult {
  if (typeof window === 'undefined') return { isBot: false, fingerprint: 'server' };

  const nav = navigator as any;

  // 1. WebDriver automation flag (Selenium / Puppeteer / Playwright)
  if (nav.webdriver) {
    return { isBot: true, reason: 'Automation flag navigator.webdriver === true', fingerprint: 'HEADLESS_WEBDRIVER' };
  }

  // 2. Headless Chrome User-Agent or Chrome CDP runtime check
  if (/HeadlessChrome|PhantomJS|Electron/i.test(nav.userAgent)) {
    return { isBot: true, reason: 'Headless user-agent signature detected', fingerprint: 'HEADLESS_UA' };
  }

  // 3. Plugin array anomaly
  if (nav.plugins && nav.plugins.length === 0 && !/iPhone|Android/i.test(nav.userAgent)) {
    return { isBot: true, reason: 'Zero browser plugins detected on desktop', fingerprint: 'ANOMALY_PLUGINS' };
  }

  // 4. Broken screen dimensions (Bots with 0x0 or negative values)
  if (window.screen.width === 0 || window.screen.height === 0) {
    return { isBot: true, reason: 'Invalid 0x0 screen resolution', fingerprint: 'INVALID_SCREEN' };
  }

  return { isBot: false, fingerprint: 'HUMAN_ENVIRONMENT' };
}

// Layer 3: SHA-256 Proof-of-Work Challenge (Hashcash)
// Real browser computes this in 30-50ms; automated bots spamming requests get choked.
export async function computeProofOfWorkChallenge(difficulty = 3): Promise<{ nonce: number; durationMs: number }> {
  const prefix = '0'.repeat(difficulty);
  const challenge = `gitblast_pow_${Date.now()}`;
  let nonce = 0;
  const start = performance.now();

  const encoder = new TextEncoder();

  while (true) {
    const data = encoder.encode(`${challenge}:${nonce}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex.startsWith(prefix)) {
      const durationMs = Math.round(performance.now() - start);
      return { nonce, durationMs };
    }
    nonce++;
  }
}
