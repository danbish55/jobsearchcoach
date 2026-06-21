import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

const PROFILE = {
  target_titles: [
    'Entry Level Data Analyst','Junior Data Analyst','Associate Data Analyst','Data Analyst',
    'Data Coordinator','Business Intelligence Analyst','Junior Business Analyst',
    'Associate Business Analyst','Business Analyst','Business Systems Analyst',
    'Product Analyst','Associate Product Analyst','Operations Analyst',
    'Associate Operations Analyst','Reporting Analyst','Research Analyst',
    'Compliance Analyst','Data Operations Specialist','Operations Specialist',
    'Analytics Consultant','Technology Consultant','Data Visualization Analyst','Analytics Engineer',
  ],
  must_have_keywords: [
    'entry level','junior','associate','intern','graduate','analytics',
    'business intelligence','requirements','database','reporting','visualization','dashboard','data-driven',
  ],
  excluded_keywords: [
    'senior consultant','lead consultant','senior manager','associate manager','regional manager',
    'principal','staff','director','vice president','VP','architect','expert','head of',
    '3+ years','3 or more years','minimum 3 years','4+ years','5+ years','6+ years',
    '7+ years','8+ years','10+ years','minimum experience of 3','at least 3 years',
    '3 years of experience','4 years of experience','5 years of experience',
    'unpaid','commission only','door-to-door',
  ],
};

function scoreJob(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();
  let score = 0;
  if (PROFILE.target_titles.some(t => titleLower.includes(t.toLowerCase()))) score += 40;
  score += PROFILE.must_have_keywords.filter(k => text.includes(k)).length * 5;
  if (PROFILE.excluded_keywords.some(k => text.includes(k))) score -= 50;
  score = Math.max(0, Math.min(100, score));
  return { score, tier: score >= 70 ? 'A' : score >= 45 ? 'B' : 'C' };
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
        results.push({ externalId: `usajobs-${pos.PositionID}`, company: pos.OrganizationName || 'Federal Agency', role: pos.PositionTitle || '', url: pos.PositionURI || '', location: pos.PositionLocation?.[0]?.LocationName || '', description: pos.QualificationSummary || '' });
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
        results.push({ externalId: `adzuna-${job.id}`, company: job.company?.display_name || '', role: job.title || '', url: job.redirect_url || '', location: job.location?.display_name || '', description: job.description || '' });
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

    let inserted = 0;
    for (const job of allJobs) {
      const { score, tier } = scoreJob(job.role, job.description);
      try {
        await sql`INSERT INTO job_leads (source, external_id, company, role, url, location, description, score, tier)
          VALUES (${job.source}, ${job.externalId}, ${job.company}, ${job.role}, ${job.url}, ${job.location}, ${job.description}, ${score}, ${tier})
          ON CONFLICT (source, external_id) DO UPDATE SET score=EXCLUDED.score, tier=EXCLUDED.tier, fetched_at=NOW()`;
        inserted++;
      } catch {}
    }

    return NextResponse.json({ success: true, fetched: allJobs.length, inserted });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
