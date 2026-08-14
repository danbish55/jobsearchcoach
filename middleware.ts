import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, cookieName } from '@/lib/auth';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  if (PUBLIC.some(p => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();

  // Machine access for API routes (cron refresh, admin tooling): a matching
  // x-api-key header substitutes for the browser session cookie.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = req.headers.get('x-api-key');
    const expected = process.env.DASHBOARD_PASSWORD;
    if (apiKey && expected && apiKey.trim() === expected.trim()) return NextResponse.next();
  }

  const token = req.cookies.get(cookieName())?.value;
  if (token && await verifyToken(token)) return NextResponse.next();

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
