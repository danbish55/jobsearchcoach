import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-me-in-production'
);

const COOKIE_NAME = 'jsc_auth';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export async function signToken(payload: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ ...payload, iat: Math.floor(Date.now() / 1000) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export function cookieName() {
  return COOKIE_NAME;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: MAX_AGE,
    path: '/',
  };
}
