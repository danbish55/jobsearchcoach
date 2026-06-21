import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { scoreJob } from '@/lib/jl-score';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

async function fetchUSAJOBS(apiKey: string) {
  const results: { externalId: string; company: string; role: string; url: string; location: string; description: string }[] = [];
  for (const kw of ['data analyst', 'business analyst', 'business intelligence']) {
    try {
      const res = await fetch(`https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&ResultsPerPage=25`, {
        headers: { 'Authorization-Key': apiKey, 'User-Agent': 'contact@example.com', 'Host': 'data.usajobs.gov' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data?.SearchResult?.SearchResultItems ?? []) {
        const pos = item.MatchedObjectDescriptor;
        if (!pos) continue;
        // Check if remote/telework is noted
        const remoteIndicator = pos.PositionRemuneration?.[0]?.Description || '';
        const teleWorkEligible = pos.UserArea?.Details?.TeleworkEligible || '';
        const locationName = teleWorkEligible === 'Yes'
          ? 'Remote / Telework'
          : pos.PositionLocation?.[0]?.LocationName || '';
        results.push({
          externalId: `usajobs-${pos.PositionID}`,
          company: pos.OrganizationName || 'Federal Agency',
          role: pos.PositionTitle || '',
          url: pos.PositionURI || '',
          location: locationName,
          description: pos.QualificationSummary || remoteIndicator,
        });
      }
    } catch {}
  }
  return results;
}

async function fetchAdzuna(appId: string, appKey: string) {
  const results: { externalId: string; company: string; role: string; url: string; location: string; description: string }[] = [];
  for (const kw of ['data analyst', 'business analyst', 'business intelligence analyst']) {
    try {
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(kw)}&results_per_page=25&content-type=application/json`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data?.results ?? []) {
        results.push({
          externalId: `adzuna-${job.id}`,
          company: job.company?.display_name || '',
          role: job.title || '',
          url: job.redirect_url || '',
          location: job.location?.display_name || '',
          description: job.description || '',
        });
      }
    } catch {}
  }
  return results;
}

export async function POST() {
  try {
    const sql = db();

    await sql`CREATE TABLE IF NOT EXISTS job_leads (
      id SERIAL PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', score INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'C', approval_state TEXT NOT NULL DEFAULT 'pending_review',
      raw JSONB, fetched_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(source, external_id)
    )`;

    const usajobsKey = process.env.USA_JOBS_API_KEY || '';
    const adzunaKey  = process.env.ADZUNA_API_KEY   || '';
    const adzunaId   = process.env.ADZUNA_APP_ID    || '';

    const allJobs: { externalId: string; company: string; role: string; url: string; location: string; description: string; source: string }[] = [];
    if (usajobsKey) allJobs.push(...(await fetchUSAJOBS(usajobsKey)).map(j => ({ ...j, source: 'usajobs' })));
    if (adzunaKey && adzunaId) allJobs.push(...(await fetchAdzuna(adzunaId, adzunaKey)).map(j => ({ ...j, source: 'adzuna' })));

    // Upsert new leads
    let inserted = 0;
    for (const job of allJobs) {
      const { score, tier } = scoreJob(job.role, job.description, job.location);
      try {
        await sql`INSERT INTO job_leads (source, external_id, company, role, url, location, description, score, tier)
          VALUES (${job.source}, ${job.externalId}, ${job.company}, ${job.role}, ${job.url}, ${job.location}, ${job.description}, ${score}, ${tier})
          ON CONFLICT (source, external_id) DO UPDATE
            SET score=EXCLUDED.score, tier=EXCLUDED.tier, location=EXCLUDED.location, fetched_at=NOW()`;
        inserted++;
      } catch {}
    }

    // Re-score ALL existing records with the updated scorer
    const existing = await sql`SELECT id, role, description, location FROM job_leads`;
    for (const row of existing) {
      const { score, tier } = scoreJob(String(row.role), String(row.description), String(row.location));
      await sql`UPDATE job_leads SET score=${score}, tier=${tier} WHERE id=${row.id}`;
    }

    return NextResponse.json({ success: true, fetched: allJobs.length, inserted, rescored: existing.length });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
