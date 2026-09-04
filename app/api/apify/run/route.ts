import { NextResponse } from 'next/server';

const ACTOR_ID   = 'jpraRc4MCUh5ehbHV'; // agentx/all-jobs-scraper — 39 boards
const APIFY_BASE = 'https://api.apify.com/v2';

export async function POST(req: Request) {
  try {
    const body  = await req.json().catch(() => ({}));
    const token = String(body.token || process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || process.env.JSC_APIFY_TOKEN || '').trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Apify token not found. Save it in Settings → Job Board Scraper first.' },
        { status: 400 }
      );
    }

    // max_results is per-platform; 4 platforms × 25 = ~100 total
    const perPlatform = Math.min(Math.ceil((Number(body.min_results) || 50) / 4), 50);
    const roleKw      = String(body.role_keyword || 'Data Analyst').trim();

    const resp = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword:     roleKw,
        country:     'United States',
        max_results: perPlatform,
        job_type:    'fulltime',
        platforms:   ['LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter'],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return NextResponse.json({ ok: false, error: `Actor error ${resp.status}: ${msg}` }, { status: 500 });
    }

    const runId = data?.data?.id || '';
    if (!runId) {
      return NextResponse.json({ ok: false, error: 'No run ID returned from Apify.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, runId, count: perPlatform * 4 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
