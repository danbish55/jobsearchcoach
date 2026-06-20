import { NextResponse } from 'next/server';

const stub = NextResponse.json(
  { ok: false, error: 'JobLeadsTool is not available in cloud mode' },
  { status: 501 }
);

export async function GET()  { return stub; }
export async function POST() { return stub; }
