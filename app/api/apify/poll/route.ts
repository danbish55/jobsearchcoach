import { NextResponse } from 'next/server';

const ACTOR_ID   = 'DYFzkdbYmMF6x7QMG'; // iskoren/multi-job-board-scraper
const APIFY_BASE = 'https://api.apify.com/v2';

// Mirrors app/api/apify/config/route.ts DEFAULT_CONFIG scoring rules.
const SCORING = {
  skills_max: 40, experience_max: 30, trajectory_max: 20, preference_max: 10,
  title_tier1_pts: 20, title_tier2_pts: 12, title_tier3_pts: 5,
  skill_tier1_weight: 10, skill_tier2_weight: 6, skill_tier3_weight: 3,
  keyword_tier1_pts: 30, keyword_tier2_pts: 28, keyword_tier3_bonus: 5,
  location_remote_pts: 8, location_tier1_pts: 9, location_tier2_pts: 7,
  location_tier3_pts: 5, location_ambiguous_pts: 2, location_non_preferred_pts: 0,
  exp_default_pts: 22,
  senior_title_penalty: 15,
  min_score_threshold: 30,
};

const DEFAULT_TITLES = {
  tier1: ['entry level data analyst','junior data analyst','associate data analyst','data analyst','data coordinator','business intelligence analyst','junior business analyst','associate business analyst','business analyst','business systems analyst'],
  tier2: ['product analyst','associate product analyst','operations analyst','associate operations analyst','reporting analyst','research analyst','compliance analyst','data operations specialist','data visualization analyst','analytics engineer'],
  tier3: ['operations specialist','analytics consultant','technology consultant'],
};
const DEFAULT_SKILLS = {
  tier1: ['sql','python','tableau','statistical analysis','data visualization'],
  tier2: ['power bi','excel','machine learning','data modeling','etl','business intelligence'],
  tier3: ['database management','optimization','requirements analysis','systems analysis','a/b test','forecasting'],
};
const DEFAULT_KEYWORDS = {
  tier1: ['new grad','recent graduate','no experience required'],
  tier2: ['entry level','0-2 years','0 to 2 years','1-2 years','junior','associate'],
  tier3: ["master's preferred",'msba','mba','advanced degree'],
};
const DEFAULT_LOCATIONS = {
  tier1: ['west hollywood','silver lake','los feliz','koreatown','hollywood','century city','brentwood','westwood','beverly hills','culver city','santa monica','playa vista','marina del rey','venice','el segundo','manhattan beach','hermosa beach','redondo beach','torrance','hawthorne','inglewood','burbank','glendale','pasadena','alhambra','san gabriel','arcadia','studio city','sherman oaks','encino','north hollywood','van nuys','long beach','downey','carson','los angeles','irvine','anaheim','orange county','costa mesa','newport beach','huntington beach','fullerton','brea','santa ana','garden grove','san diego','la jolla','chula vista','carlsbad','oceanside','escondido','del mar','encinitas','el cajon','national city'],
  tier2: ['dallas','fort worth','dfw','plano','irving','frisco','mckinney','arlington','austin','round rock','denver','boulder','aurora','lakewood','seattle','bellevue','redmond','kirkland','tacoma','salt lake city','provo','sandy','portland','beaverton','hillsboro','houston','sugar land','the woodlands','katy','st. louis','saint louis'],
  tier3: ['las vegas','henderson','summerlin'],
};

interface ScoredJob {
  id: string; title: string; company: string; location: string;
  url: string; urlDirect: string | null; site: string;
  salary: string | null; salaryMin: number | null; salaryMax: number | null;
  salaryCurrency: string; salaryInterval: string;
  seniorityLevel: string; employmentType: string; postedAt: string;
  description: string; isRemoteFlag: boolean;
  score: number; score_breakdown: { skills: number; experience: number; trajectory: number; preference: number };
  skills_matched: string[]; approval_state: string;
}

function scoreJob(item: Record<string, unknown>): ScoredJob {
  // New actor field names
  const rawDesc    = String(item.description || '');
  const desc       = rawDesc.toLowerCase();
  const title      = String(item.title    || '').toLowerCase();
  const location   = String(item.location || '').toLowerCase();
  const seniority  = String(item.job_level || item.seniority || item.seniorityLevel || '').toLowerCase();
  const isRemoteRaw = item.is_remote === true || location.includes('remote');

  // Skills (max 40)
  let matchedW = 0, totalW = 0;
  const matchedSkills: string[] = [];
  for (const s of DEFAULT_SKILLS.tier1) {
    totalW += SCORING.skill_tier1_weight;
    if (desc.includes(s)) { matchedW += SCORING.skill_tier1_weight; matchedSkills.push(s); }
  }
  for (const s of DEFAULT_SKILLS.tier2) {
    totalW += SCORING.skill_tier2_weight;
    if (desc.includes(s)) { matchedW += SCORING.skill_tier2_weight; matchedSkills.push(s); }
  }
  for (const s of DEFAULT_SKILLS.tier3) {
    totalW += SCORING.skill_tier3_weight;
    if (desc.includes(s)) { matchedW += SCORING.skill_tier3_weight; matchedSkills.push(s); }
  }
  const skillsScore = totalW
    ? Math.min(SCORING.skills_max, Math.round((matchedW / totalW) * SCORING.skills_max * 1.6))
    : 0;

  // Experience (max 30)
  let expScore: number;
  if (DEFAULT_KEYWORDS.tier1.some(k => desc.includes(k))) {
    expScore = SCORING.keyword_tier1_pts;
  } else if (DEFAULT_KEYWORDS.tier2.some(k => desc.includes(k))) {
    expScore = SCORING.keyword_tier2_pts;
  } else {
    expScore = SCORING.exp_default_pts;
  }
  if (['entry level', 'entry-level', 'internship'].includes(seniority)) {
    expScore = Math.min(expScore + 3, SCORING.experience_max);
  }
  if (DEFAULT_KEYWORDS.tier3.some(k => desc.includes(k))) {
    expScore = Math.min(expScore + SCORING.keyword_tier3_bonus, SCORING.experience_max);
  }
  expScore = Math.min(expScore, SCORING.experience_max);

  // Trajectory (max 20)
  let trajScore: number;
  if (DEFAULT_TITLES.tier1.some(t => title.includes(t))) {
    trajScore = SCORING.title_tier1_pts;
  } else if (DEFAULT_TITLES.tier2.some(t => title.includes(t))) {
    trajScore = SCORING.title_tier2_pts;
  } else if (DEFAULT_TITLES.tier3.some(t => title.includes(t))) {
    trajScore = SCORING.title_tier3_pts;
  } else {
    trajScore = 5;
  }
  if (/\b(senior|sr\.?|lead|manager|director|principal|head of|vp|vice president|chief|staff)\b/.test(title)) {
    trajScore -= SCORING.senior_title_penalty;
  }

  // Preference / location (max 10)
  const remoteTerms = ['remote', 'hybrid', 'wfh', 'work from home', 'telework', 'telecommute', 'virtual'];
  const isRemote = isRemoteRaw || remoteTerms.some(s => location.includes(s)) || remoteTerms.some(s => desc.includes(s));
  let prefScore: number;
  if (isRemote) {
    prefScore = SCORING.location_remote_pts;
  } else if (DEFAULT_LOCATIONS.tier1.some(l => location.includes(l))) {
    prefScore = SCORING.location_tier1_pts;
  } else if (DEFAULT_LOCATIONS.tier2.some(l => location.includes(l))) {
    prefScore = SCORING.location_tier2_pts;
  } else if (DEFAULT_LOCATIONS.tier3.some(l => location.includes(l))) {
    prefScore = SCORING.location_tier3_pts;
  } else if (!location.trim() || ['united states', 'us', 'usa'].includes(location.trim())) {
    prefScore = SCORING.location_ambiguous_pts;
  } else {
    prefScore = SCORING.location_non_preferred_pts;
  }
  // Bonus point if salary is known
  const salaryMin = typeof item.salary_min === 'number' ? item.salary_min : null;
  const salaryMax = typeof item.salary_max === 'number' ? item.salary_max : null;
  if (salaryMin || salaryMax) prefScore = Math.min(prefScore + 1, SCORING.preference_max);
  prefScore = Math.min(prefScore, SCORING.preference_max);

  const total = Math.max(0, Math.min(100, skillsScore + expScore + trajScore + prefScore));

  // Build a human-readable salary string
  const salaryCurrency = String(item.salary_currency || 'USD');
  const salaryInterval = String(item.salary_interval || '');
  let salaryDisplay: string | null = null;
  if (salaryMin && salaryMax) {
    salaryDisplay = `$${Math.round(salaryMin / 1000)}K–$${Math.round(salaryMax / 1000)}K/yr`;
  } else if (salaryMin) {
    salaryDisplay = `$${Math.round(salaryMin / 1000)}K+/yr`;
  } else if (salaryMax) {
    salaryDisplay = `Up to $${Math.round(salaryMax / 1000)}K/yr`;
  }

  const url       = String(item.job_url || '');
  const urlDirect = String(item.job_url_direct || '') || null;

  return {
    id: url || String(item.id || ''),
    title: String(item.title || ''),
    company: String(item.company || item.companyName || ''),
    location: String(item.location || ''),
    url, urlDirect,
    site: String(item.site || ''),
    salary: salaryDisplay,
    salaryMin, salaryMax, salaryCurrency, salaryInterval,
    seniorityLevel: String(item.job_level || item.seniority || item.seniorityLevel || ''),
    employmentType: String(item.job_type || item.employmentType || ''),
    postedAt: String(item.date_posted || item.postedAt || ''),
    description: rawDesc.substring(0, 4000),
    isRemoteFlag: isRemote,
    score: total,
    score_breakdown: { skills: skillsScore, experience: expScore, trajectory: trajScore, preference: prefScore },
    skills_matched: matchedSkills, approval_state: 'pending_review',
  };
}

const EXCLUDED_SENIORITIES = ['mid-senior level', 'senior level', 'director', 'executive', 'management'];

const SENIOR_TITLE_RE = /\b(senior|sr\.?|lead|manager|director|principal|head of|vp|vice president|chief|staff)\b/i;

function isExcluded(job: ScoredJob): boolean {
  if (SENIOR_TITLE_RE.test(job.title)) return true;
  if (EXCLUDED_SENIORITIES.some(s => job.seniorityLevel.toLowerCase().includes(s))) return true;
  if (job.description) {
    const d = job.description.toLowerCase();
    const plus  = d.match(/\b(\d+)\s*\+\s*years?\b/);
    const range = d.match(/\b(\d+)\s*[-–]\s*\d+\s*years?\b/);
    const min   = plus ? parseInt(plus[1]) : range ? parseInt(range[1]) : 0;
    if (min >= 3) return true;
  }
  return false;
}

// Map gio21/google-jobs-scraper fields to the same shape scoreJob() expects,
// then score through the same pipeline so both actor outputs are treated identically.
function scoreGoogleJob(item: Record<string, unknown>): ScoredJob {
  // Annualise salary (gio21 can return HOUR / MONTH / YEAR)
  const period = String(item.salaryPeriod || 'YEAR').toUpperCase();
  const mult   = period === 'HOUR' ? 2080 : period === 'MONTH' ? 12 : 1;
  const rawMin = typeof item.salaryMin === 'number' ? item.salaryMin * mult : null;
  const rawMax = typeof item.salaryMax === 'number' ? item.salaryMax * mult : null;

  // postedVia or via — field name varies by actor version
  const via  = String(item.postedVia || item.via || '').toLowerCase();
  const site = via.includes('linkedin')     ? 'linkedin'
             : via.includes('indeed')       ? 'indeed'
             : via.includes('glassdoor')    ? 'glassdoor'
             : via.includes('ziprecruiter') ? 'zip_recruiter'
             : 'google';

  // Build the best URL: cast wide across every field gio21 might populate
  const applyOptions  = Array.isArray(item.applyOptions)  ? item.applyOptions  as Record<string, unknown>[] : [];
  const relatedLinks  = Array.isArray(item.relatedLinks)  ? item.relatedLinks  as Record<string, unknown>[] : [];

  const directUrl = String(
    applyOptions[0]?.link          ||   // primary gio21 field
    applyOptions[0]?.url           ||
    applyOptions[0]?.applicationLink ||
    item.url                       ||   // root-level Google canonical URL
    item.jobUrl                    ||
    item.link                      ||
    relatedLinks[0]?.link          ||   // sometimes populated when applyOptions is empty
    ''
  );

  // Last resort: a Google Jobs search for this title+company always lets the user find the posting
  const title   = String(item.title       || '').trim();
  const company = String(item.companyName || '').trim();
  const bestUrl = directUrl || (title
    ? `https://www.google.com/search?q=${encodeURIComponent(company ? `${title} ${company}` : title)}&ibp=htl;jobs`
    : '');

  return scoreJob({
    title:           item.title,
    company:         item.companyName,
    location:        item.location,
    description:     item.description,
    salary_min:      rawMin,
    salary_max:      rawMax,
    salary_currency: item.salaryCurrency || 'USD',
    salary_interval: period === 'YEAR' ? 'yearly' : period.toLowerCase(),
    is_remote:       item.workFromHome === true,
    job_type:        item.jobType,
    date_posted:     item.postedAtIso,
    job_url:         bestUrl,
    site,
  });
}

// Deduplicate by normalised title+company — keep the higher-scored copy.
function deduplicateJobs(jobs: ScoredJob[]): ScoredJob[] {
  const seen = new Map<string, ScoredJob>();
  for (const job of jobs) {
    const key = (job.title + '|' + job.company).toLowerCase().replace(/[^a-z0-9|]/g, '');
    const existing = seen.get(key);
    if (!existing || job.score > existing.score) seen.set(key, job);
  }
  return Array.from(seen.values());
}

async function checkRun(runId: string, token: string): Promise<{ status: string; datasetId: string }> {
  const resp = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Apify status check failed (${runId}): ${resp.status}`);
  const data = await resp.json();
  return {
    status:    String(data?.data?.status || '').toUpperCase(),
    datasetId: String(data?.data?.defaultDatasetId || ''),
  };
}

async function fetchDataset(datasetId: string, token: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?format=json&limit=400`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Could not fetch dataset ${datasetId}: ${resp.status}`);
  const items = await resp.json();
  return Array.isArray(items) ? items : [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId       = searchParams.get('runId')       || '';
    const laRunId     = searchParams.get('laRunId')     || '';
    const googleRunId = searchParams.get('googleRunId') || '';
    const token       = String(searchParams.get('token') || process.env.APIFY_TOKEN || 'APIFY_TOKEN_REMOVED').trim();

    if (!runId) return NextResponse.json({ ok: false, error: 'Missing runId' }, { status: 400 });
    if (!token) return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });

    // Poll all three actors in parallel — LA and Google are optional
    const [liUsCheck, liLaCheck, googleCheck] = await Promise.all([
      checkRun(runId, token),
      laRunId     ? checkRun(laRunId,     token) : Promise.resolve({ status: 'SUCCEEDED', datasetId: '' }),
      googleRunId ? checkRun(googleRunId, token) : Promise.resolve({ status: 'SUCCEEDED', datasetId: '' }),
    ]);

    const PENDING = new Set(['RUNNING', 'READY', '']);
    if (
      PENDING.has(liUsCheck.status) ||
      (laRunId     && PENDING.has(liLaCheck.status)) ||
      (googleRunId && PENDING.has(googleCheck.status))
    ) {
      return NextResponse.json({ ok: true, status: 'running' });
    }
    if (liUsCheck.status !== 'SUCCEEDED') {
      return NextResponse.json({ ok: false, error: `LI/IN (US) run ended: ${liUsCheck.status}` }, { status: 500 });
    }

    // Fetch all three datasets in parallel
    const [liUsItems, liLaItems, googleItems] = await Promise.all([
      fetchDataset(liUsCheck.datasetId, token),
      (laRunId && liLaCheck.status === 'SUCCEEDED' && liLaCheck.datasetId)
        ? fetchDataset(liLaCheck.datasetId, token)
        : Promise.resolve([] as Record<string, unknown>[]),
      (googleRunId && googleCheck.status === 'SUCCEEDED' && googleCheck.datasetId)
        ? fetchDataset(googleCheck.datasetId, token)
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);

    // Per-site raw counts for debug
    const rawBySite: Record<string, number> = {};
    for (const item of [...liUsItems, ...liLaItems]) {
      const s = String(item.site || 'unknown');
      rawBySite[s] = (rawBySite[s] || 0) + 1;
    }
    for (const item of googleItems) {
      const via = String(item.postedVia || '').toLowerCase();
      const s   = via.includes('linkedin')     ? 'linkedin'
                : via.includes('indeed')       ? 'indeed'
                : via.includes('glassdoor')    ? 'glassdoor'
                : via.includes('ziprecruiter') ? 'zip_recruiter'
                : 'google';
      rawBySite[s] = (rawBySite[s] || 0) + 1;
    }

    // Score all three sets through the same pipeline
    const liUsScored  = liUsItems.map(item => scoreJob(item));
    const liLaScored  = liLaItems.map(item => scoreJob(item));
    const googleScored = googleItems.map(item => scoreGoogleJob(item));

    // Merge → exclude seniors → deduplicate → score threshold → sort
    const merged   = [...liUsScored, ...liLaScored, ...googleScored];
    const afterExcl = merged.filter(j => !isExcluded(j));
    const deduped   = deduplicateJobs(afterExcl);
    const scored    = deduped
      .filter(j => j.score >= SCORING.min_score_threshold)
      .sort((a, b) => b.score - a.score);

    const debug = {
      rawTotal:         liUsItems.length + liLaItems.length + googleItems.length,
      rawLiUs:          liUsItems.length,
      rawLiLa:          liLaItems.length,
      rawGoogle:        googleItems.length,
      rawBySite,
      afterExclusion:   afterExcl.length,
      afterDedup:       deduped.length,
      afterScoreFilter: scored.length,
    };

    return NextResponse.json({ ok: true, status: 'succeeded', jobs: scored, count: scored.length, debug });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
