import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(
      new URL('/context/corinne_claude_context.md', process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      ).toString(),
      { cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ content: '' });
    const content = await res.text();
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: '' });
  }
}
