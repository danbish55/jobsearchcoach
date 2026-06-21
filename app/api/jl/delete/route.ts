import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() { return neon(process.env.DATABASE_URL!); }

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const sql = db();
    await sql`DELETE FROM job_leads WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
