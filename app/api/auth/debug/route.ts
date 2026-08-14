import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const key = req.headers.get('x-api-key') || '';
  const expected = process.env.DASHBOARD_PASSWORD || '';
  return NextResponse.json({
    envSet: !!expected,
    envLen: expected.length,
    headerLen: key.length,
    match: !!expected && key.trim() === expected.trim(),
  });
}
