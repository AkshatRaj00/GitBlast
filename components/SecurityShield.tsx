'use client';
import { useEffect } from 'react';
import { sendInvisibleSecurityAudit } from '@/engine/telemetry/auditHook';

export default function SecurityShield() {
  useEffect(() => {
    // 1. Prototype & Fetch Tamper Protection
    try {
      if (typeof window !== 'undefined') {
        Object.freeze(Object.prototype);
      }
    } catch (_) {}

    // 2. Anti-DevTools / Reverse Engineering Detection
    let isAlerted = false;
    const threshold = 160;

    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if ((widthThreshold || heightThreshold) && !isAlerted) {
        isAlerted = true;
        sendInvisibleSecurityAudit({
          eventType: 'SUSPICIOUS_ACTIVITY',
          repoName: 'CLIENT_CONSOLE_BREACH',
          actionDetails: 'Intruder opened browser DevTools / F12 Inspection console to reverse-engineer client code.',
        });
      }
    };

    window.addEventListener('resize', detectDevTools);

    // 3. Disable Context Menu & Source Shortcut Traps
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        if (!isAlerted) {
          isAlerted = true;
          sendInvisibleSecurityAudit({
            eventType: 'SUSPICIOUS_ACTIVITY',
            repoName: 'UNAUTHORIZED_KEY_INTERCEPTION',
            actionDetails: `User pressed inspection shortcut: ${e.key}`,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', detectDevTools);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
