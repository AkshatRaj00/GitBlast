import { NextRequest, NextResponse } from 'next/server';

const HONEYPOT_PATHS = ['/.env', '/.git', '/admin', '/api/keys', '/wp-login.php', '/phpmyadmin', '/config.json', '/backup.sql'];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname.toLowerCase();
  if (HONEYPOT_PATHS.some((path) => pathname.startsWith(path))) {
    return new NextResponse('Not found.', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
