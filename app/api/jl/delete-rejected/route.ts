import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() { return neon(process.env.DATABASE_URL!); }

export async function POST() {
  try {
    const sql = db();
    const rows = await sql`DELETE FROM job_leads WHERE approval_state='rejected' RETURNING id`;
    return NextResponse.json({ ok: true, removed: rows.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
