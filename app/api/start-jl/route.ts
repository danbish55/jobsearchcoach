import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

// Corinne's criteria from candidate_profile.yaml
const PROFILE = {
  target_titles: [
    'Entry Level Data Analyst','Junior Data Analyst','Associate Data Analyst','Data Analyst',
    'Data Coordinator','Business Intelligence Analyst','Junior Business Analyst',
    'Associate Business Analyst','Business Analyst','Business Systems Analyst',
    'Product Analyst','Associate Product Analyst','Operations Analyst',
    'Associate Operations Analyst','Reporting Analyst','Research Analyst',
    'Compliance Analyst','Data Operations Specialist','Operations Specialist',
    'Analytics Consultant','Technology Consultant','Data Visualization Analyst',
    'Analytics Engineer',
  ],
  must_have_keywords: [
    'entry level','junior','associate','intern','graduate','analytics',
    'business intelligence','requirements','database','reporting','visualization',
    'dashboard','data-driven',
  ],
  excluded_keywords: [
    'senior consultant','lead consultant','senior manager','associate manager',
    'regional manager','principal','staff','director','vice president','VP',
    'architect','expert','head of','3+ years','3 or more years','minimum 3 years',
    '4+ years','5+ years','6+ years','7+ years','8+ years','10+ years',
    'minimum experience of 3','at least 3 years','3 years of experience',
    '4 years of experience','5 years of experience','unpaid','commission only','door-to-door',
  ],
};

function scoreJob(title: string, description: string): { score: number; tier: string } {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  // Title match
  const titleLower = title.toLowerCase();
  if (PROFILE.target_titles.some(t => titleLower.includes(t.toLowerCase()))) score += 40;

  // Must-have keywords
  const mustMatches = PROFILE.must_have_keywords.filter(k => text.includes(k.toLowerCase()));
  score += mustMatches.length * 5;

  // Excluded keywords — hard penalty
  const hasExcluded = PROFILE.excluded_keywords.some(k => text.includes(k.toLowerCase()));
  if (hasExcluded) score -= 50;

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 70 ? 'A' : score >= 45 ? 'B' : 'C';
  return { score, tier };
}

async function fetchUSAJOBS(apiKey: string): Promise<{ externalId: string; company: string; role: string; url: string; location: string; description: string }[]> {
  const keywords = ['data analyst', 'business analyst', 'business intelligence'];
  const results: { externalId: string; company: string; role: string; url: string; location: string; description: string }[] = [];

  for (const kw of keywords) {
    try {
      const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&ResultsPerPage=25`;
      const res = await fetch(url, {
        headers: {
          'Authorization-Key': apiKey,
          'User-Agent': 'contact@example.com',
          'Host': 'data.usajobs.gov',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data?.SearchResult?.SearchResultItems ?? []) {
        const pos = item.MatchedObjectDescriptor;
        if (!pos) continue;
        results.push({
          externalId: `usajobs-${pos.PositionID}`,
          company: pos.OrganizationName || 'Federal Agency',
          role: pos.PositionTitle || '',
          url: pos.PositionURI || '',
          location: pos.PositionLocation?.[0]?.LocationName || '',
          description: pos.QualificationSummary || '',
        });
      }
    } catch {}
  }
  return results;
}

async function fetchAdzuna(appId: string, appKey: string): Promise<{ externalId: string; company: string; role: string; url: string; location: string; description: string }[]> {
  const keywords = ['data analyst', 'business analyst', 'business intelligence analyst'];
  const results: { externalId: string; company: string; role: string; url: string; location: string; description: string }[] = [];

  for (const kw of keywords) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(kw)}&results_per_page=25&content-type=application/json`;
      const res = await fetch(url);
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

    // Ensure tables exist
    await sql`
      CREATE TABLE IF NOT EXISTS job_sources (
        key TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT false,
        api_key TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS job_leads (
        id SERIAL PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '', score INTEGER NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'C', approval_state TEXT NOT NULL DEFAULT 'pending_review',
        raw JSONB, fetched_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source, external_id)
      )
    `;

    // Load enabled sources
    const sourceRows = await sql`SELECT key, enabled, api_key FROM job_sources WHERE enabled = true`;
    const sources: Record<string, string> = {};
    for (const row of sourceRows) sources[row.key as string] = row.api_key as string;

    const allJobs: { externalId: string; company: string; role: string; url: string; location: string; description: string; source: string }[] = [];

    // USAJOBS
    const usajobsKey = sources['usajobs'] || process.env.USA_JOBS_API_KEY || '';
    if (usajobsKey) {
      const jobs = await fetchUSAJOBS(usajobsKey);
      allJobs.push(...jobs.map(j => ({ ...j, source: 'usajobs' })));
    }

    // Adzuna
    const adzunaKey = sources['adzuna'] || process.env.ADZUNA_API_KEY || '';
    const adzunaAppId = process.env.ADZUNA_APP_ID || '';
    if (adzunaKey && adzunaAppId) {
      const jobs = await fetchAdzuna(adzunaAppId, adzunaKey);
      allJobs.push(...jobs.map(j => ({ ...j, source: 'adzuna' })));
    }

    // Score and upsert
    let inserted = 0;
    for (const job of allJobs) {
      const { score, tier } = scoreJob(job.role, job.description);
      try {
        await sql`
          INSERT INTO job_leads (source, external_id, company, role, url, location, description, score, tier)
          VALUES (${job.source}, ${job.externalId}, ${job.company}, ${job.role}, ${job.url}, ${job.location}, ${job.description}, ${score}, ${tier})
          ON CONFLICT (source, external_id) DO UPDATE
            SET score = EXCLUDED.score, tier = EXCLUDED.tier, fetched_at = NOW()
        `;
        inserted++;
      } catch {}
    }

    return NextResponse.json({ ok: true, status: 'completed', fetched: allJobs.length, inserted });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
