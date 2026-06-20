import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  return NextResponse.json({
    has_api_key: hasApiKey,
    has_drive: false,
    google_client_id: '',
    claude_model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    profile_complete: true,
    setup_complete: hasApiKey,
    install_build_id: '',
    port: null,
  });
}
