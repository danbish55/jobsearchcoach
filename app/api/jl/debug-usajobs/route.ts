import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.USA_JOBS_API_KEY || '';
  const out: Record<string, unknown>[] = [];
  for (const kw of ['data analyst', 'business analyst', 'business intelligence analyst']) {
    const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&ResultsPerPage=25&SortField=DatePosted&SortDirection=Desc`;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization-Key': key, 'User-Agent': 'contact@example.com', 'Host': 'data.usajobs.gov' },
      });
      const t = await res.text();
      let items: number | string;
      try { items = (JSON.parse(t)?.SearchResult?.SearchResultItems || []).length; }
      catch { items = 'parse-fail: ' + t.slice(0, 120); }
      out.push({ kw, status: res.status, items });
    } catch (e) { out.push({ kw, fetchError: String(e) }); }
  }
  return NextResponse.json(out);
}
