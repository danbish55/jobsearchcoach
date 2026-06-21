import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

const REMOTE_PATTERNS = [
  /\b100\s*%\s*remote\b/,
  /\bfully\s+remote\b/,
  /\bremote\s+position\b/,
  /\bremote\s+work\b/,
  /\bremote\s+opportunity\b/,
  /\bremote\s+role\b/,
  /\bwork\s+from\s+home\b/,
  /\bwork\s+remotely\b/,
  /\bwfh\b/,
  /\btelework\b/,
  /this\s+job\s+(could\s+be|is|may\s+be)\s+(100\s*%\s*)?remote/,
  /eligible\s+for\s+remote/,
  /remote\s+eligible/,
  /\bvirtual\s+position\b/,
  /\banywhere\s+in\s+the\s+u\.?s\.?\b/,
];

const HYBRID_PATTERNS = [
  /\bhybrid\b/,
  /\bpartially\s+remote\b/,
  /\bsome\s+remote\b/,
  /\bflexible\s+(work|schedule|location)\b/,
];

function detectWorkType(location: string, description: string): string {
  const locL = location.toLowerCase();
  const descL = description.toLowerCase();
  if (/remote|telework/.test(locL)) return 'Remote';
  if (REMOTE_PATTERNS.some(p => p.test(descL))) return 'Remote';
  if (HYBRID_PATTERNS.some(p => p.test(descL))) return 'Hybrid';
  return 'On-site';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');

    if (view === 'health') {
      return NextResponse.json({ ok: true, sources: {}, last_run: null });
    }

    const sql = db();
    // Include description so we can detect work_type for legacy rows that have none
    const rows = await sql`
      SELECT id, source, company, role, url, location, score, tier, approval_state, fetched_at,
             salary, date_posted, work_type, description
      FROM job_leads
      ORDER BY score DESC, fetched_at DESC
      LIMIT 200
    `;
    const leads = rows.map(r => {
      const wt = String(r.work_type || '') || detectWorkType(String(r.location || ''), String(r.description || ''));
      return {
        id: r.id,
        lead: {
          company: r.company,
          role: r.role,
          url: r.url,
          location: r.location,
          approval_state: r.approval_state,
          salary: r.salary || '',
          posted_at: r.date_posted || '',
          work_type: wt,
        },
        score: r.score,
        tier: r.tier,
        approval_state: r.approval_state,
        source: r.source,
      };
    });
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
