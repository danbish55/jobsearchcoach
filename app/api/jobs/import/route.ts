import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

interface CsvRow {
  company: string;
  role?: string;
  date?: string;
  status?: string;
  url?: string;
  notes?: string;
}

const VALID_STATUSES = ['applied', 'phone', 'interview', 'offer', 'rejected'];

function normalizeStatus(s: string): string {
  const l = (s || '').toLowerCase().trim();
  if (VALID_STATUSES.includes(l)) return l;
  if (l === 'phone screen') return 'phone';
  if (['no', 'declined', 'reject'].includes(l)) return 'rejected';
  if (l === 'offer received') return 'offer';
  return 'applied';
}

function rowKey(company: string, role: string) {
  return `${(company || '').toLowerCase().trim()}|${(role || '').toLowerCase().trim()}`;
}

export async function POST(req: Request) {
  try {
    const { rows } = (await req.json()) as { rows: CsvRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const sql = db();
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id             SERIAL PRIMARY KEY,
        company        TEXT NOT NULL,
        role           TEXT NOT NULL DEFAULT '',
        date           TEXT NOT NULL DEFAULT '',
        status         TEXT NOT NULL DEFAULT 'applied',
        url            TEXT NOT NULL DEFAULT '',
        notes          TEXT NOT NULL DEFAULT '',
        source_lead_id TEXT NOT NULL DEFAULT '',
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const existing = await sql`SELECT company, role FROM applications`;
    const existingKeys = new Set(
      existing.map(r => rowKey(r.company as string, r.role as string))
    );

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.company?.trim()) { skipped++; continue; }
      const k = rowKey(row.company, row.role || '');
      if (existingKeys.has(k)) { skipped++; continue; }

      const company = row.company.trim();
      const role    = (row.role   || '').trim();
      const date    = (row.date   || '').trim();
      const status  = normalizeStatus(row.status || '');
      const url     = (row.url    || '').trim();
      const notes   = (row.notes  || '').trim();

      await sql`
        INSERT INTO applications (company,role,date,status,url,notes)
        VALUES (${company},${role},${date},${status},${url},${notes})
      `;
      existingKeys.add(k);
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, skipped });
  } catch (err) {
    console.error('POST /api/jobs/import:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
