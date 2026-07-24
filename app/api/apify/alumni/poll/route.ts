import { NextResponse } from 'next/server';

const APIFY_BASE = 'https://api.apify.com/v2';

export interface AlumniProfile {
  name:           string;
  headline:       string;
  currentCompany: string;
  location:       string;
  profileUrl:     string;
  school:         string;
  fieldOfStudy:   string;
  graduationYear: string;
}

function normaliseProfile(item: Record<string, unknown>): AlumniProfile {
  const name    = String(item.fullName || item.name || '').trim();
  const url     = String(item.profileUrl || item.linkedinUrl || item.url || '').trim();
  const company = String(
    (item.currentPositions as Record<string, unknown>[])?.[0]?.companyName ||
    item.currentCompany || item.company || ''
  ).trim();
  const headline = String(item.headline || item.title || '').trim();
  const location = String(item.location || item.geoLocationName || '').trim();
  const school   = String(
    (item.schools as Record<string, unknown>[])?.[0]?.schoolName ||
    item.school || item.schoolName || ''
  ).trim();
  const field = String(
    (item.schools as Record<string, unknown>[])?.[0]?.fieldOfStudy ||
    item.fieldOfStudy || ''
  ).trim();
  const gradYear = String(
    (item.schools as Record<string, unknown>[])?.[0]?.endYear ||
    item.graduationYear || ''
  ).trim();

  return { name, headline, currentCompany: company, location, profileUrl: url, school, fieldOfStudy: field, graduationYear: gradYear };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId') || '';
    const token = String(searchParams.get('token') || process.env.APIFY_TOKEN || 'APIFY_TOKEN_REMOVED').trim();

    if (!runId) return NextResponse.json({ ok: false, error: 'Missing runId' }, { status: 400 });

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
      `${APIFY_BASE}/datasets/${datasetId}/items?format=json&limit=500`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!itemsResp.ok) {
      return NextResponse.json({ ok: false, error: `Could not fetch dataset: ${itemsResp.status}` }, { status: 500 });
    }

    const raw     = await itemsResp.json();
    const items   = Array.isArray(raw) ? raw : [];
    const alumni  = items
      .map(item => normaliseProfile(item as Record<string, unknown>))
      .filter(p => p.name && p.profileUrl);

    return NextResponse.json({ ok: true, status: 'succeeded', alumni, count: alumni.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
