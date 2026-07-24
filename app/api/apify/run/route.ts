import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'LinkedIn Radar scraping requires the local server (localhost). Open the app locally to run a scrape.' },
    { status: 400 }
  );
}
