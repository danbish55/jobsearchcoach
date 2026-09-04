import { NextResponse } from 'next/server';

const APIFY_BASE = 'https://api.apify.com/v2';

export interface AlumniProfile {
  name:           string;
  headline:       string;
  currentCompany: string;
  location:       string;
  profileUrl:     string;
  school:         string;
}

function normaliseProfile(item: Record<string, unknown>): AlumniProfile {
  const name     = String(item.fullName || item.name || '').trim();
  const url      = String(item.profileUrl || item.linkedinUrl || item.url || '').trim();
  const headline = String(item.headline || item.title || '').trim();
  const location = String(item.location || item.geoLocationName || '').trim();
  const school   = String(item.schoolName || item.school || '').trim();

  // Actor returns company inside the headline: "Title at Company | ..."
  const m = headline.match(/\bat\s+([^|·•\-–—]+)/i);
  const company = m ? m[1].trim() : '';

  return { name, headline, currentCompany: company, location, profileUrl: url, school };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId') || '';
    const token = String(searchParams.get('token') || process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || process.env.JSC_APIFY_TOKEN || '').trim();

    if (!runId) return NextResponse.json({ ok: false, error: 'Missing runId' }, { status: 400 });
    if (!token) return NextResponse.json({ ok: false, error: 'Apify token not configured.' }, { status: 400 });

    const statusResp = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!statusResp.ok) {
      return NextResponse.json({ ok: false, error: `Apify status check failed: ${statusResp.status}` }, { status: 500 });
    }
    const statusData = await statusResp.json();
    const status     = String(statusData?.data?.status || '').toUpperCase();
    const datasetId  = String(statusData?.data?.defaultDatasetId || '');

    if (['RUNNING', 'READY', ''].includes(status)) {
      return NextResponse.json({ ok: true, status: 'running' });
    }
    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ ok: false, error: `Run ended with status: ${status}` }, { status: 500 });
    }

    const itemsResp = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?format=json&limit=2000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!itemsResp.ok) {
      return NextResponse.json({ ok: false, error: `Could not fetch dataset: ${itemsResp.status}` }, { status: 500 });
    }

    const raw   = await itemsResp.json();
    const items = Array.isArray(raw) ? raw : [];

    // Actor emits a sentinel item when the cookie is invalid
    const sentinel = items.find(i => (i as Record<string, unknown>)._reason === 'cookie-invalid');
    if (sentinel) {
      return NextResponse.json(
        { ok: false, error: 'LinkedIn cookie expired — paste a fresh li_at cookie in Settings → LinkedIn Alumni.' },
        { status: 401 }
      );
    }

    const alumni = items
      .map(item => normaliseProfile(item as Record<string, unknown>))
      .filter(p => p.name && p.profileUrl);

    return NextResponse.json({ ok: true, status: 'succeeded', alumni, count: alumni.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
