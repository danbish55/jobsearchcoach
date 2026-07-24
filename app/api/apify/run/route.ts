import { NextResponse } from 'next/server';

// Actor 1: openclawai/job-board-scraper — returns LinkedIn + Indeed reliably
const LI_IN_ACTOR  = 'DYFzkdbYmMF6x7QMG';
// Actor 2: gio21/google-jobs-scraper — Google Jobs meta-aggregator (Glassdoor, company ATSes, and more)
const GOOGLE_ACTOR = 'WJwHh23YVZFh9CIx6';
const APIFY_BASE   = 'https://api.apify.com/v2';

export async function POST(req: Request) {
  try {
    const body  = await req.json().catch(() => ({}));
    const token = String(body.token || process.env.APIFY_TOKEN || '').trim();
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

    // Actor 1: LinkedIn + Indeed (openclawai only reliably returns these two)
    const liPayload = {
      searchTerm: 'entry level data analyst',
      location: 'United States',
      sites: ['linkedin', 'indeed'],
      maxResults,
      enforceAnnualSalary: true,
      descriptionFormat: 'markdown',
      countryIndeed: 'usa',
    };

    // Actor 2: Google Jobs — aggregates from Glassdoor, Greenhouse, Lever, direct company ATS pages, and more
    const googlePayload = {
      queries: ['entry level data analyst'],
      countryCode: 'us',
      datePosted: 'week',
      jobType: ['FULLTIME'],
      maxItems: maxResults,
    };

    // Start both actors in parallel
    const [liResp, googleResp] = await Promise.all([
      fetch(`${APIFY_BASE}/acts/${LI_IN_ACTOR}/runs`,  { method: 'POST', headers, body: JSON.stringify(liPayload) }),
      fetch(`${APIFY_BASE}/acts/${GOOGLE_ACTOR}/runs`, { method: 'POST', headers, body: JSON.stringify(googlePayload) }),
    ]);

    const liData     = await liResp.json();
    const googleData = await googleResp.json();

    if (!liResp.ok) {
      const msg = liData?.error?.message || JSON.stringify(liData);
      return NextResponse.json({ ok: false, error: `LI/IN actor error ${liResp.status}: ${msg}` }, { status: 500 });
    }

    const runId = liData?.data?.id || '';
    if (!runId) {
      return NextResponse.json({ ok: false, error: 'No run ID returned from Apify (LI/IN actor).' }, { status: 500 });
    }

    const googleRunId = googleResp.ok ? (googleData?.data?.id || '') : '';
    if (!googleResp.ok) {
      console.warn('[apify/run] Google Jobs actor failed to start:', googleData?.error?.message);
    }

    return NextResponse.json({ ok: true, runId, googleRunId, count: maxResults });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
