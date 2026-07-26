import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, cookieName } from '@/lib/auth';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  if (PUBLIC.some(p => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(cookieName())?.value;
  if (token && await verifyToken(token)) return NextResponse.next();

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
