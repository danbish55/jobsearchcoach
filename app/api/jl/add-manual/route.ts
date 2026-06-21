import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() { return neon(process.env.DATABASE_URL!); }

export async function POST(req: Request) {
  try {
    const { company, role, url, location, notes } = await req.json();
    const sql = db();
    const rows = await sql`
      INSERT INTO job_leads (source, external_id, company, role, url, location, description, score, tier, approval_state)
      VALUES ('manual', ${`manual-${Date.now()}`}, ${company||''}, ${role||''}, ${url||''}, ${location||''}, ${notes||''}, 50, 'B', 'pending_review')
      RETURNING id, company, role, url, location, score, tier, approval_state, source
    `;
    return NextResponse.json({ ok: true, lead: rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
