/**
 * Evaluation harness for the job-lead pipeline.
 *
 * Pulls every pending_review lead from Neon and uses Claude (Sonnet, full
 * descriptions + web_search for truncated ones) as an independent judge of
 * whether each lead genuinely fits the criteria:
 *   - entry-level (0-1 years; remote strictly 0-1)
 *   - analytics role
 *   - geography (on-site/hybrid in target metros; remote anywhere US)
 *   - no clearance / firearms / language requirements
 *
 * Reports accuracy = good / total. Target: 95%+.
 * The judge model (Sonnet) is intentionally stronger than the pipeline
 * screener (Haiku) so it can catch the screener's mistakes.
 *
 * Usage:  node scripts/eval-leads.js
 * Requires: DATABASE_URL and ANTHROPIC_API_KEY in .env.local
 */
const fs = require('fs');
const path = require('path');

// Minimal .env.local loader (no dotenv dependency)
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { neon } = require('@neondatabase/serverless');
const Anthropic = require('@anthropic-ai/sdk').default;

const CRITERIA = `You are auditing job leads surfaced to Corinne, a USC Marshall MSBA graduate with NO professional experience, seeking ENTRY-LEVEL analytics roles.

A lead is GOOD only if ALL are true:
- Requires at most 1 year of experience (remote roles: strictly 0-1 years, no "proven experience")
- It is a genuine analytics role (data/business/BI/operations/product/reporting/insights analyst or close variant)
- If on-site or hybrid: located in LA/SoCal, Orange County, San Diego, DFW, Austin, Seattle, Denver, SLC, Las Vegas, or Portland OR
- No security clearance, firearm, or foreign-language requirement
- Posting is a real, plausible job (not spam/gig work)

For truncated descriptions, visit the URL. If unreadable, mark verdict "unverifiable".
Return ONLY a JSON array: [{"id": <dbId>, "verdict": "good"|"bad"|"unverifiable", "reason": "<short>"}]`;

async function judgeChunk(client, rows) {
  const list = rows.map(r => {
    const desc = r.description.length >= 600
      ? `DESCRIPTION:\n${r.description.slice(0, 2500)}`
      : `DESCRIPTION TRUNCATED — read the posting at: ${r.url}`;
    return `--- DB ID ${r.id} ---\nTITLE: ${r.role}\nCOMPANY: ${r.company}\nLOCATION: ${r.location} (${r.work_type})\n${desc}`;
  }).join('\n\n');
  const truncated = rows.filter(r => r.description.length < 600).length;
  const msg = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300 + rows.length * 80,
    ...(truncated ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(truncated * 2, 20) }] } : {}),
    messages: [{ role: 'user', content: `${CRITERIA}\n\n${list}` }],
  });
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const m = text.match(/\[[\s\S]*\]/);
  return m ? JSON.parse(m[0]) : [];
}

(async () => {
  const sql = neon(process.env.DATABASE_URL);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const rows = await sql`SELECT id, role, company, url, location, work_type, description FROM job_leads WHERE approval_state='pending_review' ORDER BY id`;
  if (!rows.length) { console.log('No pending leads to evaluate.'); return; }

  console.log(`Evaluating ${rows.length} pending leads with Sonnet judge...\n`);
  const verdicts = [];
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    try {
      verdicts.push(...await judgeChunk(client, chunk));
    } catch (e) {
      console.error(`Chunk ${i / 10 + 1} failed: ${e.message}`);
    }
  }

  const good = verdicts.filter(v => v.verdict === 'good');
  const bad = verdicts.filter(v => v.verdict === 'bad');
  const unver = verdicts.filter(v => v.verdict === 'unverifiable');

  console.log('=== VERDICTS ===');
  for (const v of verdicts) {
    const row = rows.find(r => r.id === v.id) || {};
    console.log(`[${v.verdict.toUpperCase().padEnd(12)}] #${v.id} ${String(row.role || '').slice(0, 50)} @ ${String(row.company || '').slice(0, 25)} — ${v.reason}`);
  }
  const denom = good.length + bad.length;
  console.log(`\n=== ACCURACY: ${denom ? Math.round((good.length / denom) * 100) : 'n/a'}% (${good.length} good / ${bad.length} bad / ${unver.length} unverifiable of ${rows.length}) ===`);
  console.log('Target: 95%+. Bad leads above are pipeline escapes — turn each into a new gate.');
})();
