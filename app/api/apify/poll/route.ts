import { NextResponse } from 'next/server';

const ACTOR    = 'curious_coder~linkedin-jobs-scraper';
const APIFY_BASE = 'https://api.apify.com/v2';

// Mirrors app/api/apify/config/route.ts DEFAULT_CONFIG scoring rules.
const SCORING = {
  skills_max: 40, experience_max: 30, trajectory_max: 20, preference_max: 10,
  title_tier1_pts: 20, title_tier2_pts: 12, title_tier3_pts: 5,
  skill_tier1_weight: 10, skill_tier2_weight: 6, skill_tier3_weight: 3,
  keyword_tier1_pts: 30, keyword_tier2_pts: 28, keyword_tier3_bonus: 5,
  location_remote_pts: 8, location_tier1_pts: 9, location_tier2_pts: 7,
  location_tier3_pts: 5, location_ambiguous_pts: 2, location_non_preferred_pts: -15,
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
  id: string; title: string; company: string; location: string; url: string;
  salary: string | null; applicantsCount: number | null; seniorityLevel: string;
  employmentType: string; postedAt: string; description: string;
  score: number; score_breakdown: { skills: number; experience: number; trajectory: number; preference: number };
  skills_matched: string[]; approval_state: string;
}

function scoreJob(item: Record<string, unknown>): ScoredJob {
  const desc     = String(item.description || '').toLowerCase();
  const title    = String(item.title       || '').toLowerCase();
  const location = String(item.location    || '').toLowerCase();
  const seniority = String(item.seniorityLevel || '').toLowerCase();

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
  const kw1 = DEFAULT_KEYWORDS.tier1;
  const kw2 = DEFAULT_KEYWORDS.tier2;
  const kw3 = DEFAULT_KEYWORDS.tier3;
  let expScore: number;
  if (kw1.some(k => desc.includes(k))) {
    expScore = SCORING.keyword_tier1_pts;
  } else if (kw2.some(k => desc.includes(k))) {
    expScore = SCORING.keyword_tier2_pts;
  } else {
    expScore = 22;
  }
  if (['entry level', 'entry-level', 'internship'].includes(seniority)) {
    expScore = Math.min(expScore + 3, SCORING.experience_max);
  }
  if (kw3.some(k => desc.includes(k))) {
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

  // Preference (max 10)
  const remoteTerms = ['remote', 'hybrid', 'wfh', 'work from home', 'telework', 'telecommute', 'virtual'];
  const isRemote = remoteTerms.some(s => location.includes(s)) || remoteTerms.some(s => desc.includes(s));
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
  const salary = String(item.salary || '').trim();
  if (salary && !['null', 'none', ''].includes(salary.toLowerCase())) {
    prefScore = Math.min(prefScore + 1, SCORING.preference_max);
  }
  prefScore = Math.min(prefScore, SCORING.preference_max);

  const total = Math.max(0, Math.min(100, skillsScore + expScore + trajScore + prefScore));
  const jobId = String(item.id || '');
  const link  = String(item.link || item.jobUrl || '');
  const url   = jobId ? `https://www.linkedin.com/jobs/view/${jobId}` : link;

  return {
    id: jobId, title: String(item.title || ''), company: String(item.company || ''),
    location: String(item.location || ''), url, salary: salary || null,
    applicantsCount: typeof item.applicantsCount === 'number' ? item.applicantsCount : null,
    seniorityLevel: String(item.seniorityLevel || ''), employmentType: String(item.employmentType || ''),
    postedAt: String(item.postedAt || ''),
    description: String(item.description || '').substring(0, 4000),
    score: total,
    score_breakdown: { skills: skillsScore, experience: expScore, trajectory: trajScore, preference: prefScore },
    skills_matched: matchedSkills, approval_state: 'pending_review',
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId') || '';
    const token = String(searchParams.get('token') || process.env.APIFY_TOKEN || '').trim();

    if (!runId) return NextResponse.json({ ok: false, error: 'Missing runId' }, { status: 400 });
    if (!token) return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });

    // Check run status
    const runResp = await fetch(`${APIFY_BASE}/acts/${ACTOR}/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const runData = await runResp.json();
    if (!runResp.ok) {
      return NextResponse.json({ ok: false, error: `Apify status check failed: ${runResp.status}` }, { status: 500 });
    }

    const status    = String(runData?.data?.status || '').toUpperCase();
    const datasetId = String(runData?.data?.defaultDatasetId || '');

    if (status === 'RUNNING' || status === 'READY' || status === '') {
      return NextResponse.json({ ok: true, status: 'running' });
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ ok: false, error: `Apify run ended with status: ${status}` }, { status: 500 });
    }

    // Fetch items from dataset
    const itemsResp = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?format=json&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!itemsResp.ok) {
      return NextResponse.json({ ok: false, error: `Could not fetch dataset items: ${itemsResp.status}` }, { status: 500 });
    }

    const items = await itemsResp.json() as Record<string, unknown>[];
    const scored = (Array.isArray(items) ? items : [])
      .map(item => scoreJob(item))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ ok: true, status: 'succeeded', jobs: scored, count: scored.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
