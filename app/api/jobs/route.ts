import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

interface Application {
  id?: number;
  company: string;
  role?: string;
  date?: string;
  status?: string;
  url?: string;
  notes?: string;
  source_lead_id?: string;
}

export async function GET() {
  try {
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
    const rows = await sql`
      SELECT id, company, role, date, status, url, notes, source_lead_id
      FROM applications ORDER BY created_at ASC
    `;
    return NextResponse.json({ applications: rows });
  } catch (err) {
    console.error('GET /api/jobs:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Full replace — delete all and re-insert from the client's array
export async function PUT(req: Request) {
  try {
    const { applications } = (await req.json()) as { applications: Application[] };
    if (!Array.isArray(applications)) {
      return NextResponse.json({ error: 'applications must be an array' }, { status: 400 });
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

    const incomingIds = applications.filter(a => a.id).map(a => Number(a.id));

    // Batch delete rows not in incoming set
    if (incomingIds.length > 0) {
      await sql`DELETE FROM applications WHERE id != ALL(${incomingIds}::int[])`;
    } else {
      await sql`DELETE FROM applications`;
    }

    // Upsert all rows and collect the resulting rows (with server-assigned IDs)
    const result: Application[] = [];
    for (const app of applications) {
      const company        = app.company        || '';
      const role           = app.role           || '';
      const date           = app.date           || '';
      const status         = app.status         || 'applied';
      const url            = app.url            || '';
      const notes          = app.notes          || '';
      const source_lead_id = app.source_lead_id || '';

      if (app.id) {
        const rows = await sql`
          UPDATE applications
          SET company=${company}, role=${role}, date=${date}, status=${status},
              url=${url}, notes=${notes}, source_lead_id=${source_lead_id}, updated_at=NOW()
          WHERE id=${app.id}
          RETURNING id, company, role, date, status, url, notes, source_lead_id
        `;
        if (rows[0]) result.push(rows[0] as Application);
      } else {
        const rows = await sql`
          INSERT INTO applications (company,role,date,status,url,notes,source_lead_id)
          VALUES (${company},${role},${date},${status},${url},${notes},${source_lead_id})
          RETURNING id, company, role, date, status, url, notes, source_lead_id
        `;
        if (rows[0]) result.push(rows[0] as Application);
      }
    }

    return NextResponse.json({ ok: true, applications: result });
  } catch (err) {
    console.error('PUT /api/jobs:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const app = (await req.json()) as Application;
    if (!app.company) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
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

    const company        = app.company;
    const role           = app.role          || '';
    const date           = app.date          || '';
    const status         = app.status        || 'applied';
    const url            = app.url           || '';
    const notes          = app.notes         || '';
    const source_lead_id  = app.source_lead_id || '';

    const rows = await sql`
      INSERT INTO applications (company,role,date,status,url,notes,source_lead_id)
      VALUES (${company},${role},${date},${status},${url},${notes},${source_lead_id})
      RETURNING id, company, role, date, status, url, notes, source_lead_id
    `;

    return NextResponse.json({ ok: true, application: rows[0] });
  } catch (err) {
    console.error('POST /api/jobs:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
