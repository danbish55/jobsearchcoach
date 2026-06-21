import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() { return neon(process.env.DATABASE_URL!); }

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const sql = db();
    const rows = await sql`UPDATE job_leads SET approval_state='approved' WHERE id=${id} RETURNING id, company, role, url, location, score, tier, approval_state, source`;
    return NextResponse.json({ ok: true, lead: rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
