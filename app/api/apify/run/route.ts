import { NextResponse } from 'next/server';

const ACTOR = 'curious_coder~linkedin-jobs-scraper';
const APIFY_BASE = 'https://api.apify.com/v2';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || process.env.APIFY_TOKEN || '').trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Apify token not found. Save it in Settings → LinkedIn Radar first.' }, { status: 400 });
    }

    const role  = String(body.role_keyword || 'Data Analyst').trim();
    const count = Number(body.min_results) || 50;
    const liUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}&location=United+States&f_E=2&f_JT=F&position=1&pageNum=0`;

    const resp = await fetch(`${APIFY_BASE}/acts/${ACTOR}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [liUrl], count, scrapeCompany: false }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return NextResponse.json({ ok: false, error: `Apify error ${resp.status}: ${msg}` }, { status: 500 });
    }

    const runId     = data?.data?.id || '';
    const datasetId = data?.data?.defaultDatasetId || '';
    if (!runId) return NextResponse.json({ ok: false, error: 'No run ID returned from Apify.' }, { status: 500 });

    return NextResponse.json({ ok: true, runId, datasetId, count });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
