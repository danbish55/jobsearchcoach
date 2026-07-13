import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.USA_JOBS_API_KEY || '';
  const out: Record<string, unknown> = { keyLen: key.length };
  try {
    const res = await fetch('https://data.usajobs.gov/api/search?Keyword=data%20analyst&ResultsPerPage=3', {
      headers: { 'Authorization-Key': key, 'User-Agent': 'contact@example.com', 'Host': 'data.usajobs.gov' },
    });
    out.status = res.status;
    const t = await res.text();
    try { out.items = (JSON.parse(t)?.SearchResult?.SearchResultItems || []).length; }
    catch { out.body = t.slice(0, 200); }
  } catch (e) { out.fetchError = String(e); }
  // retry without Host header
  try {
    const res2 = await fetch('https://data.usajobs.gov/api/search?Keyword=data%20analyst&ResultsPerPage=3', {
      headers: { 'Authorization-Key': key, 'User-Agent': 'contact@example.com' },
    });
    out.statusNoHost = res2.status;
    const t2 = await res2.text();
    try { out.itemsNoHost = (JSON.parse(t2)?.SearchResult?.SearchResultItems || []).length; }
    catch { out.bodyNoHost = t2.slice(0, 200); }
  } catch (e) { out.fetchErrorNoHost = String(e); }
  return NextResponse.json(out);
}
