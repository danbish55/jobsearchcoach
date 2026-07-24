import { NextResponse } from 'next/server';

const ACTOR_ID  = 'DYFzkdbYmMF6x7QMG'; // iskoren/multi-job-board-scraper
const APIFY_BASE = 'https://api.apify.com/v2';

export async function POST(req: Request) {
  try {
    const body  = await req.json().catch(() => ({}));
    const token = String(body.token || process.env.APIFY_TOKEN || '').trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Apify token not found. Save it in Settings → LinkedIn Radar first.' }, { status: 400 });
    }

    const searchTerm = String(body.role_keyword || 'Data Analyst').trim();
    const maxResults = Math.min(Number(body.min_results) || 50, 100);

    const payload = {
      searchTerm: 'entry level data analyst',
      googleSearchTerm: 'entry level data analyst jobs United States',
      location: 'United States',
      sites: ['linkedin', 'indeed', 'glassdoor', 'google', 'zip_recruiter', 'bayt', 'bdjobs', 'naukri'],
      maxResults,
      // hoursOld removed: appears to cause non-LI/IN boards to return 0 results
      enforceAnnualSalary: true,
      descriptionFormat: 'markdown',
      countryIndeed: 'usa',
    };

    const resp = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return NextResponse.json({ ok: false, error: `Apify error ${resp.status}: ${msg}` }, { status: 500 });
    }

    const runId     = data?.data?.id || '';
    const datasetId = data?.data?.defaultDatasetId || '';
    if (!runId) return NextResponse.json({ ok: false, error: 'No run ID returned from Apify.' }, { status: 500 });

    return NextResponse.json({ ok: true, runId, datasetId, count: maxResults });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
