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

type JobResult = {
  externalId: string; company: string; role: string; url: string;
  location: string; description: string; salary: string;
  date_posted: string; work_type: string;
};

// Detect remote/hybrid/on-site from location field and description text
function detectWorkType(location: string, description: string): string {
  const locL = location.toLowerCase();
  const descL = description.toLowerCase();

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
    /\bin\s+office\s+.*\s+remote\b/,
    /\bremote\s+.*\s+in\s+office\b/,
  ];

  // Location field already says remote
  if (/remote|telework/.test(locL)) return 'Remote';

  // Check description for remote signals
  if (REMOTE_PATTERNS.some(p => p.test(descL))) return 'Remote';

  // Check description for hybrid signals (only if not already flagged remote)
  if (HYBRID_PATTERNS.some(p => p.test(descL))) return 'Hybrid';

  return 'On-site';
}

async function fetchUSAJOBS(apiKey: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
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
        const teleWorkEligible = pos.UserArea?.Details?.TeleworkEligible || '';
        const remoteIndicator  = pos.UserArea?.Details?.RemoteIndicator   || '';
        const locationName = (teleWorkEligible === 'Yes' || remoteIndicator === 'Yes')
          ? 'Remote / Telework'
          : pos.PositionLocation?.[0]?.LocationName || '';
        const description = pos.QualificationSummary || pos.UserArea?.Details?.MajorDuties?.join(' ') || '';
        const rem = pos.PositionRemuneration?.[0];
        let salary = '';
        if (rem) {
          const min = rem.MinimumRange ? `$${Number(rem.MinimumRange).toLocaleString()}` : '';
          const max = rem.MaximumRange ? `$${Number(rem.MaximumRange).toLocaleString()}` : '';
          const interval = rem.RateIntervalCode || '';
          salary = [min && max ? `${min}–${max}` : min || max, interval].filter(Boolean).join(' ');
        }
        const pubDate = pos.PublicationStartDate ? pos.PublicationStartDate.split('T')[0] : '';
        // For USAJOBS, TeleworkEligible=Yes means at minimum hybrid
        let work_type = detectWorkType(locationName, description);
        if (teleWorkEligible === 'Yes' && work_type === 'On-site') work_type = 'Remote / Hybrid';
        if (remoteIndicator === 'Yes') work_type = 'Remote';

        results.push({ externalId: `usajobs-${pos.PositionID}`, company: pos.OrganizationName || 'Federal Agency', role: pos.PositionTitle || '', url: pos.PositionURI || '', location: locationName, description, salary, date_posted: pubDate, work_type });
      }
    } catch {}
  }
  return results;
}

async function fetchAdzuna(appId: string, appKey: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of ['data analyst', 'business analyst', 'business intelligence analyst']) {
    try {
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(kw)}&results_per_page=25&content-type=application/json`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data?.results ?? []) {
        let salary = '';
        if (job.salary_min || job.salary_max) {
          const min = job.salary_min ? `$${Math.round(job.salary_min).toLocaleString()}` : '';
          const max = job.salary_max ? `$${Math.round(job.salary_max).toLocaleString()}` : '';
          salary = min && max ? `${min}–${max}` : min || max;
        }
        const date_posted = job.created ? job.created.split('T')[0] : '';
        const location = job.location?.display_name || '';
        const description = job.description || '';
        const work_type = detectWorkType(location, description);
        results.push({ externalId: `adzuna-${job.id}`, company: job.company?.display_name || '', role: job.title || '', url: job.redirect_url || '', location, description, salary, date_posted, work_type });
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
      salary TEXT NOT NULL DEFAULT '', date_posted TEXT NOT NULL DEFAULT '',
      work_type TEXT NOT NULL DEFAULT '',
      raw JSONB, fetched_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(source, external_id)
    )`;
    await sql`ALTER TABLE job_leads ADD COLUMN IF NOT EXISTS salary TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE job_leads ADD COLUMN IF NOT EXISTS date_posted TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE job_leads ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT ''`;

    const usajobsKey = process.env.USA_JOBS_API_KEY || '';
    const adzunaKey  = process.env.ADZUNA_API_KEY   || '';
    const adzunaId   = process.env.ADZUNA_APP_ID    || '';

    const allJobs: (JobResult & { source: string })[] = [];
    if (usajobsKey) allJobs.push(...(await fetchUSAJOBS(usajobsKey)).map(j => ({ ...j, source: 'usajobs' })));
    if (adzunaKey && adzunaId) allJobs.push(...(await fetchAdzuna(adzunaId, adzunaKey)).map(j => ({ ...j, source: 'adzuna' })));

    let inserted = 0;
    for (const job of allJobs) {
      const { score, tier } = scoreJob(job.role, job.description, job.location);
      try {
        await sql`INSERT INTO job_leads (source, external_id, company, role, url, location, description, score, tier, salary, date_posted, work_type)
          VALUES (${job.source}, ${job.externalId}, ${job.company}, ${job.role}, ${job.url}, ${job.location}, ${job.description}, ${score}, ${tier}, ${job.salary}, ${job.date_posted}, ${job.work_type})
          ON CONFLICT (source, external_id) DO UPDATE
            SET score=EXCLUDED.score, tier=EXCLUDED.tier, location=EXCLUDED.location,
                salary=EXCLUDED.salary, date_posted=EXCLUDED.date_posted,
                work_type=EXCLUDED.work_type, description=EXCLUDED.description, fetched_at=NOW()`;
        inserted++;
      } catch {}
    }

    // Re-score ALL existing records and update work_type for any not yet classified
    const existing = await sql`SELECT id, role, description, location, work_type FROM job_leads`;
    for (const row of existing) {
      const { score, tier } = scoreJob(String(row.role), String(row.description), String(row.location));
      const wt = String(row.work_type) || detectWorkType(String(row.location), String(row.description));
      await sql`UPDATE job_leads SET score=${score}, tier=${tier}, work_type=${wt} WHERE id=${row.id}`;
    }

    return NextResponse.json({ success: true, fetched: allJobs.length, inserted, rescored: existing.length });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
