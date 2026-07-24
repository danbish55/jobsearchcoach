import { NextResponse } from 'next/server';

// Actor 1: openclawai/job-board-scraper — returns LinkedIn + Indeed reliably
const LI_IN_ACTOR  = 'DYFzkdbYmMF6x7QMG';
// Actor 2: gio21/google-jobs-scraper — Google Jobs meta-aggregator (Glassdoor, company ATSes, and more)
const GOOGLE_ACTOR = 'WJwHh23YVZFh9CIx6';
const APIFY_BASE   = 'https://api.apify.com/v2';

export async function POST(req: Request) {
  try {
    const body  = await req.json().catch(() => ({}));
    const token = String(body.token || process.env.APIFY_TOKEN || 'APIFY_TOKEN_REMOVED').trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Apify token not found. Save it in Settings → Job Board Scraper first.' },
        { status: 400 }
      );
    }

    const maxResults = Math.min(Number(body.min_results) || 50, 100);

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Pass 1a: LinkedIn + Indeed, US-wide with salary filter (catches national remote + posted-pay roles)
    const liUsPayload = {
      searchTerm: 'entry level data analyst',
      location: 'United States',
      sites: ['linkedin', 'indeed'],
      maxResults,
      enforceAnnualSalary: true,
      descriptionFormat: 'markdown',
      countryIndeed: 'usa',
    };

    // Pass 1b: LinkedIn + Indeed, LA-targeted, no salary filter (catches local listings that don't post pay)
    const liLaPayload = {
      searchTerm: 'entry level data analyst',
      location: 'Los Angeles, CA',
      sites: ['linkedin', 'indeed'],
      maxResults,
      enforceAnnualSalary: false,
      descriptionFormat: 'markdown',
      countryIndeed: 'usa',
    };

    // Pass 2: Google Jobs — aggregates Glassdoor, Greenhouse, Lever, direct company ATS pages
    const googlePayload = {
      queries: ['entry level data analyst Los Angeles'],
      countryCode: 'us',
      datePosted: 'week',
      jobType: ['FULLTIME'],
      maxItems: maxResults,
    };

    // Start all three in parallel
    const [liUsResp, liLaResp, googleResp] = await Promise.all([
      fetch(`${APIFY_BASE}/acts/${LI_IN_ACTOR}/runs`, { method: 'POST', headers, body: JSON.stringify(liUsPayload) }),
      fetch(`${APIFY_BASE}/acts/${LI_IN_ACTOR}/runs`, { method: 'POST', headers, body: JSON.stringify(liLaPayload) }),
      fetch(`${APIFY_BASE}/acts/${GOOGLE_ACTOR}/runs`, { method: 'POST', headers, body: JSON.stringify(googlePayload) }),
    ]);

    const liUsData   = await liUsResp.json();
    const liLaData   = await liLaResp.json();
    const googleData = await googleResp.json();

    if (!liUsResp.ok) {
      const msg = liUsData?.error?.message || JSON.stringify(liUsData);
      return NextResponse.json({ ok: false, error: `LI/IN (US) actor error ${liUsResp.status}: ${msg}` }, { status: 500 });
    }

    const runId = liUsData?.data?.id || '';
    if (!runId) {
      return NextResponse.json({ ok: false, error: 'No run ID returned from Apify (LI/IN US actor).' }, { status: 500 });
    }

    const laRunId     = liLaResp.ok     ? (liLaData?.data?.id    || '') : '';
    const googleRunId = googleResp.ok   ? (googleData?.data?.id  || '') : '';

    if (!liLaResp.ok)   console.warn('[apify/run] LI/IN LA actor failed to start:',    liLaData?.error?.message);
    if (!googleResp.ok) console.warn('[apify/run] Google Jobs actor failed to start:', googleData?.error?.message);

    return NextResponse.json({ ok: true, runId, laRunId, googleRunId, count: maxResults });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
