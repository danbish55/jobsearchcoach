import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { scoreJob, isPreferredLocation } from '@/lib/jl-score';

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

// Titles that require OTJ experience Corinne doesn't have yet — reject outright.
// Also catches numeric level suffixes: "Analyst 2", "Analyst 5", "BI Analyst 3", etc.
const SENIOR_TITLE_RE = /\b(senior|lead|sr\.?|principal|staff|manager|director|head of|vp|vice president|experienced|ii|iii|iv)\b|\b(analyst|engineer|developer|specialist|consultant)\s+[2-9]\d*\b/i;

// The role must actually be an analytics/business-analysis role. Anything that doesn't
// match this (nurses, social workers, mechanical engineers, pharmacists...) is rejected
// before any other check runs.
const ROLE_FIT_RE = /\b(analyst|analytics|business intelligence|\bbi\b|data|insights?|reporting|research|operations specialist|data coordinator|product owner|consultant)\b/i;
// ...but data/consultant alone can still smuggle in engineering roles; reject these outright.
const ROLE_MISFIT_RE = /\b(nurse|\brn\b|social worker|lmsw|pharmacist|physician|mechanical engineer|electrical engineer|civil engineer|forward deployed|architect|registrar|rail coordinator|care coordinator|welder|technician|driver|therapist|counselor)\b/i;

// Language requirements in the title ("French Language", "Spanish speakers", "Bilingual") —
// Corinne is English-only.
const LANGUAGE_TITLE_RE = /\b(french|spanish|german|japanese|mandarin|korean|portuguese|italian|arabic|bilingual)\b/i;

// Federal jobs: "1 year of specialized experience at the GS-12 level" is a senior requirement
// dressed as entry-level. Entry-level federal grades are GS-5/7/9; reject GS-11 and above.
const HIGH_GS_GRADE_RE = /\bGS-?(1[1-5])\b/i;

// Non-US postings (remote listings from Canadian/international boards).
const NON_US_LOCATION_RE = /\b(canada|united kingdom|\buk\b|australia|india|philippines|mexico|brazil|germany|france|ireland|singapore)\b/i;

// HARD RULE: entry-level only — no prior professional experience required.
// A stated requirement of more than 1 year is an automatic reject, everywhere.
// ("0-1 years" / "up to 1 year" phrasing passes; "2+ years" never does.)
const MAX_EXPERIENCE_ONSITE = 1;
const MAX_EXPERIENCE_REMOTE = 1;

// Jobs requiring security clearance or firearm eligibility — not applicable to Corinne.
const CLEARANCE_RE = /\b(top\s*secret|ts\/sci|sci\s+clearance|secret\s+clearance|security\s+clearance|dod\s+clearance|q\s+clearance|sensitive\s+compartmented|classified\s+access|nato\s+secret)\b/i;
const FIREARM_RE   = /\b(firearm|carry\s+a\s+(weapon|gun)|concealed\s+carry|firearms?\s+qualif|armed\s+(guard|officer|position)|must\s+be\s+(able\s+to\s+)?carry|pistol\s+qualif)\b/i;

// ---------- helpers ----------

/**
 * Parse the minimum years of experience explicitly required in a job description.
 * Returns 0 if none found.
 *
 * Catches patterns like:
 *   "10+ years experience"           → 10
 *   "3-5 years of experience"        → 3  (lower bound of range)
 *   "minimum 5 years"                → 5
 *   "at least 4 years"               → 4
 *   "10 years SQL" (bullet lists)    → 10
 *   "requires 7 years"               → 7
 */
function minExperienceYears(description: string): number {
  const text = description.toLowerCase();
  let min = Infinity;

  const absorb = (re: RegExp) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }
  };

  // Range: "3-5 years", "3 to 5 years" — capture the lower bound
  absorb(/(\d+)\s*(?:[-–]|to)\s*\d+\s*(?:years?|yrs?)\b/g);
  // "5+ years of experience", "5 years experience", "5 years of relevant/prior/work/related experience"
  absorb(/(\d+)\s*\+?\s*(?:years?|yrs?)['']?\s+(?:of\s+)?(?:relevant\s+|prior\s+|work\s+|related\s+|professional\s+|hands.on\s+|industry\s+)?(?:experience|exp)\b/g);
  // "experience of 5+ years", "experience of at least 5 years"
  absorb(/experience\s+of\s+(?:at\s+least\s+|a\s+minimum\s+of\s+)?(\d+)\s*\+?\s*(?:years?|yrs?)\b/g);
  // "minimum X years", "at least X years", "requires X years", "must have X years",
  // "candidates must have X years", "need X years", "expected to have X years"
  absorb(/(?:minimum(?:\s+of)?|at\s+least|requires?\s+(?:a\s+minimum\s+of\s+)?|must\s+have(?:\s+at\s+least)?|candidates?\s+(?:must|should)\s+have(?:\s+at\s+least)?|need(?:s)?\s+(?:at\s+least\s+)?|expected\s+to\s+have|bring\s+(?:at\s+least\s+)?)\s*(\d+)\s*\+?\s*(?:years?|yrs?)\b/g);
  // "X years of experience required", "X years' experience required"
  absorb(/(\d+)\s*\+?\s*(?:years?|yrs?)['']?\s+(?:of\s+)?(?:\w+\s+)?experience\s+(?:required|preferred|needed|minimum)/g);
  // "X or more years", "X+ years"
  absorb(/(\d+)\s*(?:\+|\s+or\s+more)\s*(?:years?|yrs?)\b/g);
  // Bullet/skills-list pattern: "• 10 years SQL" or "- 10 years in Python"
  absorb(/(?:^|[\n\r•\-\*])\s*(\d+)\s*\+?\s*(?:years?|yrs?)\s+(?:in\s+|of\s+|with\s+)?[a-z]/gm);

  return min === Infinity ? 0 : min;
}

// Hard-reject if description contains explicit high-experience strings the parser might miss.
// Hard-reject keyword regex: any explicit requirement of 2+ years, all work types.
const EXPERIENCE_KEYWORD_RE = /\b([2-9]\d*\+\s*years?|10\+\s*years?|minimum\s+(?:of\s+)?[2-9]\d*\s*years?|at\s+least\s+[2-9]\d*\s*years?|[2-9]\d*\s*or\s+more\s+years?|must\s+have\s+[2-9]\d*\s*\+?\s*years?|candidates?\s+must\s+have\s+[2-9]\d*|requires?\s+[2-9]\d*\s*\+?\s*years?|[2-9]\d*\s*years?\s+(?:of\s+)?(?:relevant\s+|prior\s+|professional\s+)?experience\s+(?:required|minimum))\b/i;
const EXPERIENCE_KEYWORD_REMOTE_RE = EXPERIENCE_KEYWORD_RE;
const EXPERIENCE_KEYWORD_ONSITE_RE = EXPERIENCE_KEYWORD_RE;

function stripHtml(html: string): string {
  // Decode common HTML entities first (Greenhouse returns entity-escaped HTML,
  // so tags arrive as &lt;p&gt; and must be decoded before tag stripping).
  const decoded = String(html || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return decoded.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

type EvalJob = { externalId: string; url: string; role: string; company: string; description: string; location: string; work_type: string };

const SCREEN_PROMPT_HEADER = `You are screening job listings for Corinne, a recent USC Marshall MSBA graduate with NO prior professional work experience. She is looking for ENTRY-LEVEL data/business analyst roles. The goal is FEWER, MORE ACCURATE matches — when in doubt, REJECT.

NOTE on federal (USAJOBS) roles: Corinne's master's degree satisfies education-based qualification paths. ACCEPT a federal GS-7 or GS-9 role ONLY if it can be qualified via a master's degree / 2 years of graduate education INSTEAD of specialized experience AND its duty station passes the geography rule (telework-eligible does NOT make it remote — only a true nationwide-remote posting skips geography). REJECT if prior federal service or specialized work experience is strictly required, or the grade is GS-11+.

REJECT a job if ANY of the following are true:
- HARD RULE — EXPERIENCE: the job requires prior professional work experience. Any stated requirement of 2 or more years ("2+ years", "2-3 years", "minimum 2 years", "several years", "proven experience", "seasoned") is an automatic reject, for EVERY work type. "0-1 years", "entry level", "new grad", or no experience requirement passes.
- HARD RULE — GEOGRAPHY: the job is on-site or hybrid ANYWHERE outside the listed regions below. No exceptions, no matter how good the job looks. Federal telework jobs count as tied to their duty station, NOT remote.
- Title or description indicates a senior, lead, principal, staff, manager, director, experienced, or VP-level role
- The role is not actually an analytics/business-analysis role (reject nurses, engineers, pharmacists, coordinators of physical operations, etc.)
- Requires security clearance (top secret, TS/SCI, secret clearance, DOD clearance) — check the TITLE too
- Requires carrying a firearm or armed position
- Is on-site or hybrid AND located outside these regions: Los Angeles/SoCal, Orange County, San Diego, Dallas/DFW, Austin TX, Seattle WA, Denver CO, Salt Lake City UT, Las Vegas NV, Portland OR
- For truncated descriptions: visit the URL and read the FULL posting before deciding. If you cannot read the posting, REJECT it — never accept a job you could not verify.

ACCEPT a job ONLY if:
- It is genuinely early-career: 0-2 years for on-site/hybrid, 0-1 years for remote (or no experience stated)
- Title is an analytics role: data analyst, business analyst, BI analyst, operations analyst, reporting analyst, data coordinator, product analyst, insights analyst, or close variant
- Location passes the rule above (remote passes automatically)

Evaluate each job below. Return ONLY a JSON array — no other text:
[{"id": "<externalId>", "reject": true/false, "reason": "<brief reason if rejected>"}]`;

// Evaluate one chunk of jobs (≤15) in a single Claude call.
async function evaluateChunk(jobs: EvalJob[], apiKey: string): Promise<Set<string>> {
  const TRUNCATED = 600;
  const truncatedCount = jobs.filter(j => j.description.length < TRUNCATED).length;

  const list = jobs.map((j, i) => {
    const descPart = j.description.length >= TRUNCATED
      ? `DESCRIPTION:\n${j.description.slice(0, 2500)}`
      : `DESCRIPTION TRUNCATED — visit URL to read full posting: ${j.url}`;
    return `--- JOB ${i + 1} | ID=${j.externalId} ---\nTITLE: ${j.role}\nCOMPANY: ${j.company}\nLOCATION: ${j.location} (${j.work_type})\n${descPart}`;
  }).join('\n\n');

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const tools = truncatedCount > 0
      ? [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: Math.min(truncatedCount * 2, 20) }]
      : [];
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250 + jobs.length * 60, // scale output budget with batch size
      ...(tools.length ? { tools } : {}),
      messages: [{ role: 'user', content: `${SCREEN_PROMPT_HEADER}\n\n${list}` }],
    });
    const text = msg.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => (b as { type: string; text: string }).text)
      .join('');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      // Unparseable response = unverified batch. Reject truncated jobs (couldn't be
      // verified), keep full-description jobs (regex gates already vetted them).
      return new Set(jobs.filter(j => j.description.length < TRUNCATED).map(j => j.externalId));
    }
    const parsed: { id: string; reject: boolean; reason?: string }[] = JSON.parse(match[0]);
    const rejected = new Set(parsed.filter(r => r.reject).map(r => r.id));
    for (const r of parsed) if (r.reject) claudeRejects[r.id] = r.reason || 'no reason given';
    // Any job Claude didn't return a verdict for and that is truncated → reject (unverified).
    const answered = new Set(parsed.map(r => r.id));
    for (const j of jobs) {
      if (!answered.has(j.externalId) && j.description.length < TRUNCATED) {
        rejected.add(j.externalId);
        claudeRejects[j.externalId] = 'no verdict returned; truncated = unverified';
      }
    }
    return rejected;
  } catch {
    // API failure = nothing verified. Reject truncated jobs; keep regex-vetted long ones.
    return new Set(jobs.filter(j => j.description.length < TRUNCATED).map(j => j.externalId));
  }
}

// Use Claude Haiku to evaluate jobs against entry-level criteria, in chunks of 15
// so responses always fit the output budget and one bad batch can't poison the rest.
// Returns a Set of externalIds that should be REJECTED.
async function evaluateJobsViaClaude(jobs: EvalJob[], apiKey: string): Promise<Set<string>> {
  if (!jobs.length) return new Set();
  if (!apiKey) {
    // No API key = nothing can be verified. Reject all truncated-description jobs.
    return new Set(jobs.filter(j => j.description.length < 600).map(j => j.externalId));
  }
  const CHUNK = 15;
  const chunks: EvalJob[][] = [];
  for (let i = 0; i < jobs.length; i += CHUNK) chunks.push(jobs.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map(c => evaluateChunk(c, apiKey)));
  const rejected = new Set<string>();
  results.forEach(set => set.forEach(id => rejected.add(id)));
  return rejected;
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

// ---------- location resolution ----------

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',
  connecticut:'CT',delaware:'DE','district of columbia':'DC',florida:'FL',georgia:'GA',
  hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',
  louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',
  mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH',
  'new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',
  ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
  washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY',
};
const US_STATE_ABBR = new Set(Object.values(STATE_NAME_TO_ABBR));

function toStateAbbr(raw: string): string {
  const s = (raw || '').trim();
  if (/^[A-Z]{2}$/.test(s) && US_STATE_ABBR.has(s)) return s;
  return STATE_NAME_TO_ABBR[s.toLowerCase()] || '';
}

// True when a location string carries no city/state — just a country or nothing.
function isCountryOnly(loc: string): boolean {
  return /^(us|usa|u\.s\.?|united states|nationwide|)$/i.test((loc || '').trim());
}

// Pull a "City, ST" out of free text when the structured location is missing.
function extractLocationFromText(text: string): string {
  const re = /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2}),\s*([A-Z]{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (US_STATE_ABBR.has(m[2])) return `${m[1]}, ${m[2]}`;
  }
  return '';
}

// Does a location string already carry a recognizable US state?
function hasState(loc: string): boolean {
  return (loc || '').split(',').map(s => s.trim()).some(p => toStateAbbr(p) !== '');
}

// Unambiguous US counties → state (only counties whose name maps to a single
// state; ambiguous ones like "Hillsborough County" are deliberately omitted).
const COUNTY_TO_STATE: Record<string, string> = {
  'los angeles county':'CA','orange county':'CA','san diego county':'CA','riverside county':'CA',
  'ventura county':'CA','san bernardino county':'CA','alameda county':'CA','santa clara county':'CA',
  'sacramento county':'CA','san mateo county':'CA','contra costa county':'CA','fresno county':'CA',
  'tarrant county':'TX','dallas county':'TX','travis county':'TX','harris county':'TX',
  'bexar county':'TX','collin county':'TX','denton county':'TX',
  'king county':'WA','pierce county':'WA','snohomish county':'WA',
  'multnomah county':'OR','washington county':'OR','clackamas county':'OR',
  'denver county':'CO','boulder county':'CO','arapahoe county':'CO','jefferson county':'CO',
  'salt lake county':'UT','utah county':'UT','clark county':'NV','maricopa county':'AZ',
  'cook county':'IL','miami-dade county':'FL','broward county':'FL','palm beach county':'FL',
};

// If a location reads "City, Xxx County" with no state, resolve the county to its state.
function resolveCountyState(location: string): string {
  const parts = (location || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return location;
  const county = parts.find(p => /county/i.test(p));
  if (!county) return location;
  const st = COUNTY_TO_STATE[county.toLowerCase()];
  if (!st) return location;
  const city = parts.find(p => !/county/i.test(p) && toStateAbbr(p) === '' && !isCountryOnly(p));
  return city ? `${city}, ${st}` : st;
}

// Build the best "City, ST" from Adzuna's structured area array.
// area is country -> state -> county -> city, but the state isn't always present
// or at a fixed index, so scan the whole array for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adzunaLocation(job: any, description: string): string {
  const area: string[] = Array.isArray(job?.location?.area) ? job.location.area : [];

  // Find a real state anywhere in the array.
  let stAbbr = '';
  for (const a of area) { const ab = toStateAbbr(a); if (ab) { stAbbr = ab; break; } }

  // City = the most specific element that isn't the country, a state, or a county.
  const cityParts = area.filter(a => !isCountryOnly(a) && toStateAbbr(a) === '' && !/county/i.test(a));
  const city = cityParts.length ? cityParts[cityParts.length - 1] : '';

  if (city && stAbbr) return `${city}, ${stAbbr}`;

  // No state in the structured data — try to recover "City, ST" from the description.
  const fromText = extractLocationFromText(description);
  if (fromText) return fromText;

  // Keep whatever city/county we do have rather than dropping to country.
  if (city) {
    const county = area.find(a => /county/i.test(a));
    return county ? `${city}, ${county}` : city;
  }
  if (stAbbr) return stAbbr;

  const dn = job?.location?.display_name || '';
  return (dn && !isCountryOnly(dn)) ? dn : (dn || 'US');
}

// Final pass over every job: if it reads as on-site but we don't actually know
// where, try the description, and failing that mark it honestly so it can't pose
// as an applyable on-site listing with no address.
function normalizeLocation(job: JobResult): JobResult {
  let location = job.location;
  let work_type = job.work_type;

  // Only try to pin down a physical address for non-remote roles — a remote job's
  // location legitimately has no state, and we don't want to glue a random city to it.
  const isPhysical = !/remote|hybrid|telework/i.test(work_type) && !/remote|hybrid|telework/i.test(location);

  if (isPhysical && (isCountryOnly(location) || !hasState(location))) {
    // First resolve a known county to its state; then try the description.
    location = resolveCountyState(location);
    if (!hasState(location)) {
      const fromText = extractLocationFromText(job.description);
      if (fromText) location = fromText;
    }
  }

  if (work_type === 'On-site' && isCountryOnly(location)) {
    location = 'Location not specified';
    work_type = 'Unspecified';
  }
  return { ...job, location, work_type };
}

// ---------- source fetchers ----------

// Collected per-source fetch errors for the current cycle — surfaced in the response.
const fetchErrors: Record<string, string> = {};
// Claude's reject reasons for this cycle — surfaced in the response for diagnostics.
const claudeRejects: Record<string, string> = {};

// USAJOBS returns some detail fields as string OR array depending on the posting.
function joinField(v: unknown): string {
  if (Array.isArray(v)) return v.join(' ');
  return typeof v === 'string' ? v : '';
}

async function fetchUSAJOBS(apiKey: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of KEYWORDS) {
    try {
      // SortField=DatePosted&SortDirection=Desc returns freshest first
      const res = await fetch(`https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&ResultsPerPage=25&SortField=DatePosted&SortDirection=Desc`, {
        headers: { 'Authorization-Key': apiKey, 'User-Agent': 'JobSearchCoach/1.0', 'Host': 'data.usajobs.gov' },
      });
      if (!res.ok) { fetchErrors['usajobs'] = `HTTP ${res.status} for "${kw}"`; continue; }
      const data = await res.json();
      for (const item of data?.SearchResult?.SearchResultItems ?? []) {
        const pos = item.MatchedObjectDescriptor;
        if (!pos) continue;
        // TeleworkEligible does NOT mean remote — federal telework jobs are tied to
        // the duty station. Only RemoteIndicator=Yes is a true remote job.
        const remoteIndicator  = pos.UserArea?.Details?.RemoteIndicator   || '';
        const locationName = remoteIndicator === 'Yes'
          ? 'Remote'
          : pos.PositionLocation?.[0]?.LocationName || '';
        // Assemble ALL available text fields so filters can scan conditions,
        // qualifications, duties, and requirements — not just the summary.
        const details = pos.UserArea?.Details || {};
        const description = [
          pos.QualificationSummary,
          joinField(details.MajorDuties),
          joinField(details.Conditions),
          joinField(details.Requirements),
          joinField(details.Evaluations),
          pos.JobSummary,
          details.ServiceType,
        ].filter(Boolean).join(' ');
        const rem = pos.PositionRemuneration?.[0];
        let salary = '';
        if (rem) {
          const min = rem.MinimumRange ? `$${Number(rem.MinimumRange).toLocaleString()}` : '';
          const max = rem.MaximumRange ? `$${Number(rem.MaximumRange).toLocaleString()}` : '';
          salary = [min && max ? `${min}–${max}` : min || max, rem.RateIntervalCode || ''].filter(Boolean).join(' ');
        }
        const date_posted = pos.PublicationStartDate ? pos.PublicationStartDate.split('T')[0] : '';
        let work_type = detectWorkType(locationName, description);
        if (remoteIndicator === 'Yes') work_type = 'Remote';
        else if (work_type === 'Remote') work_type = 'Hybrid'; // desc mentioned telework, but duty station governs — geo gate must apply
        results.push({ externalId: `usajobs-${pos.PositionID}`, company: pos.OrganizationName || 'Federal Agency', role: pos.PositionTitle || '', url: pos.PositionURI || '', location: locationName, description, salary, date_posted, work_type });
      }
    } catch (e) { fetchErrors['usajobs'] = String(e); }
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
        const description = stripHtml(job.description || '');
        const location = adzunaLocation(job, description);
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
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
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
    const res = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'JobSearchCoach/1.0' } });
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

// Greenhouse + Lever — free public board APIs, no keys required.
// Curated list of companies with analytics teams in Corinne's target metros.
// Unknown/renamed board tokens 404 silently and are skipped.
const GREENHOUSE_BOARDS = [
  // LA / SoCal
  'snapchat', 'spacex', 'riotgames', 'hulu', 'liveramp', 'zwift', 'gooddata',
  'servicetitan', 'gohealth', 'honey', 'tala', 'scopely', 'crexi', 'fairapp',
  // Dallas / Austin / TX
  'atlassian', 'cloudflare', 'duosecurity', 'selffinancial', 'outdoorsy',
  // Seattle / Denver / SLC / Vegas
  'remitly', 'outreach', 'qualtrics', 'guildeducation', 'ibotta', 'checkr',
  // Big remote-friendly analytics employers
  'stripe', 'airbnb', 'coinbase', 'doordashusa', 'instacart', 'robinhood',
  'gusto', 'brex', 'affirm', 'flexport', 'scaleai', 'samsara', 'attentive',
];
const LEVER_BOARDS = [
  'plaid', 'palantir', 'mixpanel', 'postman', 'kraken',
  'welocalize', 'veho', 'voleon', 'zoox', 'octoenergy',
];
const ANALYST_TITLE_RE = /(data analyst|business analyst|business intelligence|bi analyst|analytics analyst|product analyst|operations analyst|reporting analyst|insights analyst|research analyst|revenue analyst|strategy analyst|growth analyst|marketing analyst|decision science)/i;

async function fetchGreenhouse(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  await Promise.all(GREENHOUSE_BOARDS.map(async board => {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const job of data?.jobs ?? []) {
        if (!ANALYST_TITLE_RE.test(job.title || '')) continue;
        const location = job.location?.name || '';
        const description = stripHtml(job.content || '');
        const date_posted = job.updated_at ? String(job.updated_at).split('T')[0] : '';
        results.push({
          externalId: `greenhouse-${board}-${job.id}`,
          company: data?.name || board,
          role: job.title || '', url: job.absolute_url || '',
          location, description, salary: '', date_posted,
          work_type: detectWorkType(location, description),
        });
      }
    } catch {}
  }));
  return results;
}

async function fetchLever(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  await Promise.all(LEVER_BOARDS.map(async board => {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const job of Array.isArray(data) ? data : []) {
        if (!ANALYST_TITLE_RE.test(job.text || '')) continue;
        const location = job.categories?.location || '';
        const description = stripHtml(`${job.descriptionPlain || job.description || ''} ${(job.lists || []).map((l: { text: string; content: string }) => `${l.text} ${stripHtml(l.content || '')}`).join(' ')}`);
        const date_posted = job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : '';
        results.push({
          externalId: `lever-${board}-${job.id}`,
          company: board.charAt(0).toUpperCase() + board.slice(1),
          role: job.text || '', url: job.hostedUrl || '',
          location, description, salary: '', date_posted,
          work_type: /remote/i.test(job.workplaceType || '') ? 'Remote' : detectWorkType(location, description),
        });
      }
    } catch {}
  }));
  return results;
}

// Ashby — free public job-board API, no auth. Popular with newer tech companies.
const ASHBY_BOARDS = [
  'notion', 'ramp', 'linear', 'deel', 'openai', 'replit', 'vanta',
  'mercury', 'zip', 'whatnot', 'clipboardhealth', 'astranis', 'kikoff',
];
async function fetchAshby(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  await Promise.all(ASHBY_BOARDS.map(async board => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const job of data?.jobs ?? []) {
        if (!ANALYST_TITLE_RE.test(job.title || '')) continue;
        const location = job.location || '';
        const description = stripHtml(job.descriptionHtml || job.descriptionPlain || '');
        const comp = job.compensation?.compensationTierSummary || '';
        results.push({
          externalId: `ashby-${board}-${job.id}`,
          company: board.charAt(0).toUpperCase() + board.slice(1),
          role: job.title || '', url: job.jobUrl || job.applyUrl || '',
          location, description, salary: comp,
          date_posted: job.publishedAt ? String(job.publishedAt).split('T')[0] : '',
          work_type: job.isRemote ? 'Remote' : detectWorkType(location, description),
        });
      }
    } catch {}
  }));
  return results;
}

// Workable — free public widget API, no auth.
const WORKABLE_BOARDS = ['tala'];
async function fetchWorkable(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  await Promise.all(WORKABLE_BOARDS.map(async board => {
    try {
      const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${board}?details=true`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const job of data?.jobs ?? []) {
        if (!ANALYST_TITLE_RE.test(job.title || '')) continue;
        const location = [job.city, job.state, job.country].filter(Boolean).join(', ');
        const description = stripHtml(job.description || '');
        results.push({
          externalId: `workable-${board}-${job.shortcode || job.id}`,
          company: data?.name || board,
          role: job.title || '', url: job.url || job.application_url || '',
          location, description, salary: '',
          date_posted: job.published_on || '',
          work_type: /remote/i.test(job.telecommuting ? 'remote' : location) ? 'Remote' : detectWorkType(location, description),
        });
      }
    } catch {}
  }));
  return results;
}

// SmartRecruiters — free public postings API, no auth.
const SMARTRECRUITERS_BOARDS = ['ServiceNow', 'VISA', 'Experian', 'WesternDigital', 'Blizzard'];
async function fetchSmartRecruiters(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  await Promise.all(SMARTRECRUITERS_BOARDS.map(async board => {
    try {
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${board}/postings?q=analyst&limit=100`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const job of data?.content ?? []) {
        if (!ANALYST_TITLE_RE.test(job.name || '')) continue;
        const location = [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', ');
        // Postings list has no description; fetch detail only for title-matched jobs
        let description = '';
        try {
          const dRes = await fetch(`https://api.smartrecruiters.com/v1/companies/${board}/postings/${job.id}`);
          if (dRes.ok) {
            const detail = await dRes.json();
            const sections = detail?.jobAd?.sections || {};
            description = stripHtml(Object.values(sections).map((s: unknown) => (s as { text?: string })?.text || '').join(' '));
          }
        } catch {}
        results.push({
          externalId: `smartrecruiters-${board}-${job.id}`,
          company: job.company?.name || board,
          role: job.name || '',
          url: `https://jobs.smartrecruiters.com/${board}/${job.id}`,
          location, description, salary: '',
          date_posted: job.releasedDate ? String(job.releasedDate).split('T')[0] : '',
          work_type: job.location?.remote ? 'Remote' : detectWorkType(location, description),
        });
      }
    } catch {}
  }));
  return results;
}

// Remotive — free public API, curated remote jobs
async function fetchRemotive(): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const kw of ['data analyst', 'business analyst']) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=30`, {
        headers: { 'User-Agent': 'JobSearchCoach/1.0' },
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
    // Reset per-cycle diagnostics (module state survives warm serverless invocations)
    for (const k of Object.keys(fetchErrors)) delete fetchErrors[k];
    for (const k of Object.keys(claudeRejects)) delete claudeRejects[k];
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
    if (isEnabled('greenhouse', true)) jobs.push({ source: 'greenhouse', run: () => fetchGreenhouse() });
    if (isEnabled('lever', true)) jobs.push({ source: 'lever', run: () => fetchLever() });
    if (isEnabled('ashby', true)) jobs.push({ source: 'ashby', run: () => fetchAshby() });
    if (isEnabled('workable', true)) jobs.push({ source: 'workable', run: () => fetchWorkable() });
    if (isEnabled('smartrecruiters', true)) jobs.push({ source: 'smartrecruiters', run: () => fetchSmartRecruiters() });

    const sourceKeys = jobs.map(j => j.source);
    const settled = await Promise.all(jobs.map(j => j.run().catch(() => [] as JobResult[])));
    const allJobs: (JobResult & { source: string })[] = [];
    // Per-source funnel diagnostics: fetched → survived hard gates → survived Claude
    const funnel: Record<string, { fetched: number; gated: number; claude_ok: number }> = {};
    settled.forEach((list, i) => {
      const source = jobs[i].source;
      funnel[source] = { fetched: list.length, gated: 0, claude_ok: 0 };
      for (const j of list) {
        // freshness guard — drop anything older than MAX_AGE_DAYS when we have a date
        if (j.date_posted && daysSince(j.date_posted) > MAX_AGE_DAYS) continue;
        // resolve/honestly flag the location before storing
        allJobs.push({ ...normalizeLocation(j), source });
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

    // Deterministic hard gates — every job must pass these regardless of what Claude says.
    // Claude is the second line of defense, not the only line.
    const passesHardGates = (job: { role: string; description: string; location: string; work_type: string }): boolean => {
      // Role must be an analytics role and not an obvious misfit (nurse, engineer, etc.)
      if (!ROLE_FIT_RE.test(job.role)) return false;
      if (ROLE_MISFIT_RE.test(job.role)) return false;
      // Senior/experienced titles
      if (SENIOR_TITLE_RE.test(job.role)) return false;
      // Language requirements in the title
      if (LANGUAGE_TITLE_RE.test(job.role)) return false;
      // Federal GS-11+ grades — senior requirements dressed as "1 year of experience"
      if (HIGH_GS_GRADE_RE.test(job.role) || HIGH_GS_GRADE_RE.test(job.description)) return false;
      // Non-US postings
      if (NON_US_LOCATION_RE.test(job.location)) return false;
      // Clearance/firearm — check TITLE and description
      if (CLEARANCE_RE.test(job.role) || CLEARANCE_RE.test(job.description)) return false;
      if (FIREARM_RE.test(job.role) || FIREARM_RE.test(job.description)) return false;
      // HARD RULE — GEOGRAPHY: anything that is not a true Remote job must have a
      // verified preferred-city location. Unknown/vague locations are rejected, period.
      if (job.work_type !== 'Remote') {
        if (!isPreferredLocation(job.location.toLowerCase().trim())) return false;
      }
      // Experience regex on longer descriptions (truncated ones are verified by Claude)
      if (job.description.length >= 600) {
        const isRemote = job.work_type === 'Remote';
        if (minExperienceYears(job.description) > (isRemote ? MAX_EXPERIENCE_REMOTE : MAX_EXPERIENCE_ONSITE)) return false;
        if ((isRemote ? EXPERIENCE_KEYWORD_REMOTE_RE : EXPERIENCE_KEYWORD_ONSITE_RE).test(job.description)) return false;
      }
      return true;
    };

    const preFiltered = deduped.filter(passesHardGates);
    preFiltered.forEach(j => { if (funnel[j.source]) funnel[j.source].gated++; });

    // Claude evaluation: reads every job (full text or via web_search for truncated ones)
    // and makes the final call on experience level, location, and role fit.
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    const rejected = await evaluateJobsViaClaude(
      preFiltered.map(j => ({
        externalId: j.externalId, url: j.url, role: j.role,
        company: j.company, description: j.description,
        location: j.location, work_type: j.work_type,
      })),
      anthropicKey
    );

    let inserted = 0;
    const insertedThisCycle = new Set<string>();
    for (const job of preFiltered) {
      if (rejected.has(job.externalId)) continue;
      if (funnel[job.source]) funnel[job.source].claude_ok++;
      insertedThisCycle.add(job.externalId);
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

    // Re-evaluate existing pending_review records — hard gates first (deterministic,
    // catches wrong geo / wrong role / senior / clearance instantly), then Claude for
    // whatever survives. approved/rejected records are never touched.
    const existing = await sql`SELECT id, external_id, role, company, url, description, location, work_type FROM job_leads WHERE approval_state = 'pending_review'`;
    let pruned = 0;
    const survivors: typeof existing = [];
    for (const row of existing) {
      // Jobs accepted in THIS cycle already passed both gates and Claude — don't re-judge them.
      if (insertedThisCycle.has(String(row.external_id))) continue;
      const wt0 = String(row.work_type) || detectWorkType(String(row.location), String(row.description));
      const normalized = normalizeLocation({
        externalId: '', company: '', role: String(row.role), url: '',
        location: String(row.location), description: String(row.description),
        salary: '', date_posted: '', work_type: wt0,
      });
      if (!passesHardGates({ role: String(row.role), description: normalized.description, location: normalized.location, work_type: normalized.work_type })) {
        await sql`DELETE FROM job_leads WHERE id=${row.id}`;
        pruned++;
      } else {
        survivors.push({ ...row, work_type: normalized.work_type, location: normalized.location });
      }
    }

    // Claude pass on hard-gate survivors
    const rejectedExisting = await evaluateJobsViaClaude(
      survivors.map((row: Record<string, unknown>) => ({
        externalId: String(row.external_id || row.id),
        url: String(row.url || ''),
        role: String(row.role),
        company: String(row.company || ''),
        description: String(row.description),
        location: String(row.location),
        work_type: String(row.work_type),
      })),
      anthropicKey
    );
    for (const row of survivors) {
      const exId = String(row.external_id || row.id);
      if (rejectedExisting.has(exId)) {
        await sql`DELETE FROM job_leads WHERE id=${row.id}`;
        pruned++;
      } else {
        const { score, tier } = scoreJob(String(row.role), String(row.description), String(row.location));
        await sql`UPDATE job_leads SET score=${score}, tier=${tier}, work_type=${String(row.work_type)}, location=${String(row.location)} WHERE id=${row.id}`;
      }
    }

    return NextResponse.json({ success: true, fetched: deduped.length, inserted, pruned, rescored: existing.length - pruned, sources_used: sourceKeys, funnel, fetch_errors: fetchErrors, claude_rejects: claudeRejects });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
