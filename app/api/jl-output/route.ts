import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

export async function GET() {
  try {
    const sql = db();
    const rows = await sql`
      SELECT id, source, company, role, url, location, score, tier, approval_state, fetched_at
      FROM job_leads
      ORDER BY score DESC, fetched_at DESC
      LIMIT 200
    `;
    const leads = rows.map(r => ({
      lead: {
        company: r.company,
        role: r.role,
        url: r.url,
        location: r.location,
        approval_state: r.approval_state,
      },
      score: r.score,
      tier: r.tier,
      approval_state: r.approval_state,
      source: r.source,
      id: r.id,
    }));
    return NextResponse.json(leads);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, approval_state } = await req.json() as { id: number; approval_state: string };
    const sql = db();
    await sql`UPDATE job_leads SET approval_state = ${approval_state} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
