import { NextResponse } from 'next/server';

// Returns the raw field names and sample values from the first item of an Apify dataset.
// Use this to discover what field names the actor actually returns.
// GET /api/apify/inspect?datasetId=xxx&token=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get('datasetId') || '';
    const token     = String(searchParams.get('token') || process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || process.env.JSC_APIFY_TOKEN || '').trim();

    if (!datasetId) return NextResponse.json({ ok: false, error: 'Missing datasetId' }, { status: 400 });
    if (!token)     return NextResponse.json({ ok: false, error: 'Missing token' },     { status: 400 });

    const resp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return NextResponse.json({ ok: false, error: `Apify ${resp.status}` }, { status: 500 });

    const items = await resp.json() as Record<string, unknown>[];
    const item  = Array.isArray(items) && items[0] ? items[0] : {};

    const fields = Object.entries(item).map(([k, v]) => ({
      field: k,
      type:  Array.isArray(v) ? 'array' : typeof v,
      preview: typeof v === 'string' ? v.substring(0, 120) : JSON.stringify(v)?.substring(0, 120),
    }));

    return NextResponse.json({ ok: true, fieldCount: fields.length, fields });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
