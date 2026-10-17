import { NextRequest, NextResponse } from 'next/server';

const HONEYPOT_PATHS = ['/.env', '/.git', '/admin', '/api/keys', '/wp-login.php', '/phpmyadmin', '/config.json', '/backup.sql'];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.toLowerCase();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

  // 1. HONEYPOT TRAP ONLY
  if (HONEYPOT_PATHS.some((p) => pathname.startsWith(p))) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const alertMsg = `🚨 <b>CRITICAL: HONEYPOT INTRUDER TRAPPED!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Trap Path:</b> <code>${pathname}</code>\n` +
        `🌐 <b>Intruder IP:</b> <code>${ip}</code>\n` +
        `🤖 <b>User-Agent:</b> <code>${req.headers.get('user-agent')?.slice(0, 60) || 'Unknown'}</code>\n` +
        `🛡️ <b>Action:</b> IP Blocked (403 Forbidden)`;

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: alertMsg, parse_mode: 'HTML' }),
      }).catch(() => {});
    }

    return new NextResponse('Access Denied: Honeypot Triggered.', { status: 403 });
  }

  // Telegram audit is NEVER blocked by rate-limit!
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
