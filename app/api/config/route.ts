import { NextResponse } from 'next/server';

// On Vercel, config is managed via environment variables.
// POST is accepted but silently ignored to keep the client happy.
export async function GET() {
  return NextResponse.json({ ok: true, sources: {}, health: {} });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
