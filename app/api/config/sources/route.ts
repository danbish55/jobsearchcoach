import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS job_sources (
      key       TEXT PRIMARY KEY,
      enabled   BOOLEAN NOT NULL DEFAULT false,
      api_key   TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS job_leads (
      id             SERIAL PRIMARY KEY,
      source         TEXT NOT NULL,
      external_id    TEXT NOT NULL DEFAULT '',
      company        TEXT NOT NULL DEFAULT '',
      role           TEXT NOT NULL DEFAULT '',
      url            TEXT NOT NULL DEFAULT '',
      location       TEXT NOT NULL DEFAULT '',
      description    TEXT NOT NULL DEFAULT '',
      score          INTEGER NOT NULL DEFAULT 0,
      tier           TEXT NOT NULL DEFAULT 'C',
      approval_state TEXT NOT NULL DEFAULT 'pending_review',
      raw            JSONB,
      fetched_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source, external_id)
    )
  `;
}

export async function GET() {
  try {
    const sql = db();
    await ensureTables(sql);

    // Seed from env vars on first load if table is empty
    const existing = await sql`SELECT key FROM job_sources`;
    if (existing.length === 0) {
      const seeds = [
        { key: 'adzuna',   enabled: true,  api_key: process.env.ADZUNA_API_KEY   || '' },
        { key: 'usajobs',  enabled: true,  api_key: process.env.USA_JOBS_API_KEY || '' },
        { key: 'the_muse', enabled: true,  api_key: '' },
        { key: 'remoteok', enabled: true,  api_key: '' },
        { key: 'remotive', enabled: true,  api_key: '' },
        { key: 'greenhouse', enabled: false, api_key: '' },
        { key: 'lever',    enabled: false, api_key: '' },
        { key: 'indeed_rss', enabled: false, api_key: '' },
        { key: 'built_in_la', enabled: false, api_key: '' },
      ];
      for (const s of seeds) {
        await sql`
          INSERT INTO job_sources (key, enabled, api_key)
          VALUES (${s.key}, ${s.enabled}, ${s.api_key})
          ON CONFLICT (key) DO NOTHING
        `;
      }
    }

    const rows = await sql`SELECT key, enabled, api_key FROM job_sources`;
    const sources: Record<string, { enabled: boolean; api_key: string }> = {};
    for (const row of rows) {
      sources[row.key as string] = { enabled: row.enabled as boolean, api_key: row.api_key as string };
    }
    return NextResponse.json({ ok: true, sources, health: {} });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { sources } = await req.json() as { sources: Record<string, { enabled: boolean; api_key?: string }> };
    const sql = db();
    await ensureTables(sql);
    for (const [key, val] of Object.entries(sources)) {
      const enabled = !!val.enabled;
      const apiKey = val.api_key || '';
      await sql`
        INSERT INTO job_sources (key, enabled, api_key, updated_at)
        VALUES (${key}, ${enabled}, ${apiKey}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET enabled = EXCLUDED.enabled,
              api_key = EXCLUDED.api_key,
              updated_at = NOW()
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
