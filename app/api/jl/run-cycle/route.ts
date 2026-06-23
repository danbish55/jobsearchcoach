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

// Only keep listings posted within this many days (freshness guard).
const MAX_AGE_DAYS = 45;

// Search terms used across every source.
const KEYWORDS = ['data analyst', 'business analyst', 'business intelligence analyst'];

// ---------- helpers ----------

function stripHtml(html: string): string {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86400000;
}

const REMOTE_PATTERNS = [
  /\b100\s*%\s*remote\b/, /\bfully\s+remote\b/, /\bremote\s+position\b/,
  /\bremote\s+work\b/, /\bremote\s+opportunity\b/, /\bremote\s+role\b/,
  /\bwork\s+from\s+home\b/, /\bwork\s+remotely\b/, /\bwfh\b/, /\btelework\b/,
  /this\s+job\s+(could\s+be|is|may\s+be)\s+(100\s*%\s*)?remote/,
  /eligible\s+for\s+remote/, /remote\s+eligible/, /\bvirtual\s+position\b/,
  /\banywhere\s+in\s+the\s+u\.?s\.?\b/,
];
const HYBRID_PATTERNS = [
  /\bhybrid\b/, /\bpartially\s+remote\b/, /\bsome\s+remote\b/,
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

// ---------- source fetchers ----------

async function fetchUSAJOBS(apiKey: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of KEYWORDS) {
    try {
      // SortField=DatePosted&SortDirection=Desc returns freshest first
      const res = await fetch(`https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&ResultsPerPage=25&SortField=DatePosted&SortDirection=Desc`, {
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
        const description = pos.QualificationSummary || (pos.UserArea?.Details?.MajorDuties || []).join(' ') || '';
        const rem = pos.PositionRemuneration?.[0];
        let salary = '';
        if (rem) {
          const min = rem.MinimumRange ? `$${Number(rem.MinimumRange).toLocaleString()}` : '';
          const max = rem.MaximumRange ? `$${Number(rem.MaximumRange).toLocaleString()}` : '';
          salary = [min && max ? `${min}–${max}` : min || max, rem.RateIntervalCode || ''].filter(Boolean).join(' ');
        }
        const date_posted = pos.PublicationStartDate ? pos.PublicationStartDate.split('T')[0] : '';
        let work_type = detectWorkType(locationName, description);
        if (teleWorkEligible === 'Yes' && work_type === 'On-site') work_type = 'Remote / Hybrid';
        if (remoteIndicator === 'Yes') work_type = 'Remote';
        results.push({ externalId: `usajobs-${pos.PositionID}`, company: pos.OrganizationName || 'Federal Agency', role: pos.PositionTitle || '', url: pos.PositionURI || '', location: locationName, description, salary, date_posted, work_type });
      }
    } catch {}
  }
  return results;
}

async function fetchAdzuna(appId: string, appKey: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of KEYWORDS) {
    try {
      // sort_by=date = freshest first; max_days_old keeps it recent
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(kw)}&results_per_page=30&sort_by=date&max_days_old=${MAX_AGE_DAYS}&content-type=application/json`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data?.results ?? []) {
        let salary = '';
        if (job.salary_min || job.salary_max) {
          const min = job.salary_min ? `$${Math.round(job.salary_min).toLocaleString()}` : '';
          const max = job.salary_max ? `$${Math.round(job.salary_max).toLocaleString()}` : '';
          salary = min && max ? `${min}–${max}` : min || max;
        }
        const location = job.location?.display_name || '';
        const description = stripHtml(job.description || '');
        results.push({ externalId: `adzuna-${job.id}`, company: job.company?.display_name || '', role: job.title || '', url: job.redirect_url || '', location, description, salary, date_posted: job.created ? job.created.split('T')[0] : '', work_type: detectWorkType(location, description) });
      }
    } catch {}
  }
  return results;
}

// The Muse — free public API, structured company listings
async function fetchTheMuse(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const page of [0, 1]) {
    try {
      const res = await fetch(`https://www.themuse.com/api/public/jobs?category=Data%20and%20Analytics&category=Business%20%26%20Strategy&page=${page}`, {
        headers: { 'User-Agent': 'contact@example.com' },
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const job of data?.results ?? []) {
        const location = (job.locations || []).map((l: { name: string }) => l.name).join(', ') || '';
        const description = stripHtml(job.contents || '');
        const date_posted = job.publication_date ? job.publication_date.split('T')[0] : '';
        results.push({ externalId: `themuse-${job.id}`, company: job.company?.name || '', role: job.name || '', url: job.refs?.landing_page || '', location, description, salary: '', date_posted, work_type: detectWorkType(location, description) });
      }
    } catch {}
  }
  return results;
}

// RemoteOK — free public API, all-remote tech jobs
async function fetchRemoteOK(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  try {
    const res = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'contact@example.com' } });
    if (!res.ok) return results;
    const data = await res.json();
    const wanted = /(data analyst|business analyst|business intelligence|analytics|bi analyst|data analy)/i;
    for (const job of Array.isArray(data) ? data : []) {
      if (!job || !job.position) continue; // first element is a legal notice
      if (!wanted.test(`${job.position} ${(job.tags || []).join(' ')}`)) continue;
      let salary = '';
      if (job.salary_min || job.salary_max) {
        const min = job.salary_min ? `$${Math.round(job.salary_min).toLocaleString()}` : '';
        const max = job.salary_max ? `$${Math.round(job.salary_max).toLocaleString()}` : '';
        salary = min && max ? `${min}–${max}` : min || max;
      }
      const description = stripHtml(job.description || '');
      results.push({ externalId: `remoteok-${job.id || job.slug}`, company: job.company || '', role: job.position || '', url: job.url || `https://remoteok.com/remote-jobs/${job.id}`, location: 'Remote', description, salary, date_posted: job.date ? String(job.date).split('T')[0] : '', work_type: 'Remote' });
    }
  } catch {}
  return results;
}

// Remotive — free public API, curated remote jobs
async function fetchRemotive(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of ['data analyst', 'business analyst']) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=30`, {
        headers: { 'User-Agent': 'contact@example.com' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data?.jobs ?? []) {
        const location = job.candidate_required_location || 'Remote';
        const description = stripHtml(job.description || '');
        results.push({ externalId: `remotive-${job.id}`, company: job.company_name || '', role: job.title || '', url: job.url || '', location, description, salary: job.salary || '', date_posted: job.publication_date ? job.publication_date.split('T')[0] : '', work_type: 'Remote' });
      }
    } catch {}
  }
  return results;
}

// ---------- main ----------

export async function POST() {
  try {
    const sql = db();

    await sql`CREATE TABLE IF NOT EXISTS job_sources (key TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT false, api_key TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ DEFAULT NOW())`;
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

    // Read which sources are enabled. Keyless free sources default ON even if no row exists yet.
    const rows = await sql`SELECT key, enabled, api_key FROM job_sources`;
    const cfg: Record<string, { enabled: boolean; api_key: string }> = {};
    for (const r of rows) cfg[String(r.key)] = { enabled: !!r.enabled, api_key: String(r.api_key || '') };
    const isEnabled = (key: string, defaultOn: boolean) =>
      key in cfg ? cfg[key].enabled : defaultOn;

    const usajobsKey = cfg['usajobs']?.api_key || process.env.USA_JOBS_API_KEY || '';
    const adzunaKey  = cfg['adzuna']?.api_key  || process.env.ADZUNA_API_KEY   || '';
    const adzunaId   = process.env.ADZUNA_APP_ID || '';

    // Pair each source with its fetch so result/source can never desync.
    const jobs: { source: string; run: () => Promise<JobResult[]> }[] = [];
    if (isEnabled('usajobs', true) && usajobsKey) jobs.push({ source: 'usajobs', run: () => fetchUSAJOBS(usajobsKey) });
    if (isEnabled('adzuna', true) && adzunaKey && adzunaId) jobs.push({ source: 'adzuna', run: () => fetchAdzuna(adzunaId, adzunaKey) });
    if (isEnabled('the_muse', true)) jobs.push({ source: 'the_muse', run: () => fetchTheMuse() });
    if (isEnabled('remoteok', true)) jobs.push({ source: 'remoteok', run: () => fetchRemoteOK() });
    if (isEnabled('remotive', true)) jobs.push({ source: 'remotive', run: () => fetchRemotive() });

    const sourceKeys = jobs.map(j => j.source);
    const settled = await Promise.all(jobs.map(j => j.run().catch(() => [] as JobResult[])));
    const allJobs: (JobResult & { source: string })[] = [];
    settled.forEach((list, i) => {
      const source = jobs[i].source;
      for (const j of list) {
        // freshness guard — drop anything older than MAX_AGE_DAYS when we have a date
        if (j.date_posted && daysSince(j.date_posted) > MAX_AGE_DAYS) continue;
        allJobs.push({ ...j, source });
      }
    });

    // Dedup within this batch by normalized company+role+location
    // (location included so genuinely different-location postings survive)
    const seen = new Set<string>();
    const deduped = allJobs.filter(j => {
      const key = `${j.company}|${j.role}|${j.location}`.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let inserted = 0;
    for (const job of deduped) {
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

    // Re-score ALL existing records and backfill work_type
    const existing = await sql`SELECT id, role, description, location, work_type FROM job_leads`;
    for (const row of existing) {
      const { score, tier } = scoreJob(String(row.role), String(row.description), String(row.location));
      const wt = String(row.work_type) || detectWorkType(String(row.location), String(row.description));
      await sql`UPDATE job_leads SET score=${score}, tier=${tier}, work_type=${wt} WHERE id=${row.id}`;
    }

    return NextResponse.json({ success: true, fetched: deduped.length, inserted, rescored: existing.length, sources_used: sourceKeys });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
