import { NextResponse } from 'next/server';

const ALUMNI_ACTOR = 'mg4cEVz9exfzFsDHl'; // crawlerbros/linkedin-schools-alumni-scraper
const APIFY_BASE   = 'https://api.apify.com/v2';

const USC_URL  = 'https://www.linkedin.com/school/university-of-southern-california/';
const ELLA_URL = 'https://www.linkedin.com/school/university-of-arizona/';

export async function POST(req: Request) {
  try {
    const body    = await req.json().catch(() => ({}));
    const token   = String(body.token   || process.env.APIFY_TOKEN || 'APIFY_TOKEN_REMOVED').trim();
    const cookie  = String(body.cookie  || '').trim();
    const keyword = String(body.keyword || '').trim();
    const max     = Math.min(Number(body.maxAlumni) || 200, 1000);

    if (!cookie) {
      return NextResponse.json(
        { ok: false, error: 'LinkedIn cookie required. Add your li_at cookie in Settings → LinkedIn Alumni.' },
        { status: 400 }
      );
    }

    const suffix = keyword ? `?keywords=${encodeURIComponent(keyword)}` : '';
    const input = {
      schoolUrls:         [USC_URL + suffix, ELLA_URL + suffix],
      cookie,
      maxAlumniPerSchool: max,
      language:           'en_US',
      proxyConfiguration: { useApifyProxy: false },
    };

    const resp = await fetch(`${APIFY_BASE}/acts/${ALUMNI_ACTOR}/runs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return NextResponse.json({ ok: false, error: `Actor error ${resp.status}: ${msg}` }, { status: 500 });
    }

    const runId = data?.data?.id || '';
    if (!runId) return NextResponse.json({ ok: false, error: 'No run ID returned from Apify.' }, { status: 500 });

    return NextResponse.json({ ok: true, runId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
