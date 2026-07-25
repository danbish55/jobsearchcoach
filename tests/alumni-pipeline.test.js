// node tests/alumni-pipeline.test.js

// ── normaliseProfile (mirrors poll/route.ts) ──────────────────────────────────

function normaliseProfile(item) {
  const name     = String(item.fullName || item.name || '').trim();
  const url      = String(item.profileUrl || item.linkedinUrl || item.url || '').trim();
  const headline = String(item.headline || item.title || '').trim();
  const location = String(item.location || item.geoLocationName || '').trim();
  const school   = String(item.schoolName || item.school || '').trim();
  const m        = headline.match(/\bat\s+([^|·•\-–—]+)/i);
  const company  = m ? m[1].trim() : '';
  return { name, headline, currentCompany: company, location, profileUrl: url, school };
}

// ── _alumniForCompany (mirrors job-target-tracker.js) ────────────────────────

function alumniForCompany(name, alumni) {
  const needle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (needle.length < 3) return [];
  return alumni.filter(p => {
    const co = String(p.currentCompany || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (co.length < 3) return false;
    return co.includes(needle) || needle.includes(co);
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function assert(label, got, expected) {
  if (JSON.stringify(got) === JSON.stringify(expected)) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.error(`  ✗  ${label}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       got:      ${JSON.stringify(got)}`);
    fail++;
  }
}

// normaliseProfile — headline parsing
const cases = [
  ['Software Engineer at Google',                 'Google'],
  ['Senior Analyst at Meta | Building things',    'Meta'],
  ['Data Scientist at TikTok / ByteDance',        'TikTok / ByteDance'],
  ['VP Analytics at Kaiser Permanente',           'Kaiser Permanente'],
  ['Head of Data - Netflix',                      ''],   // no "at" → empty
  ['Goldman Sachs | VP Data',                     ''],   // no "at" → empty
  ['at Google',                                   'Google'],  // edge: bare "at"
  ['',                                            ''],
];

console.log('\nnormaliseProfile — company extraction from headline:');
for (const [headline, expectedCompany] of cases) {
  const raw = { name: 'Jane Doe', profileUrl: 'https://linkedin.com/in/jane', headline };
  assert(JSON.stringify(headline), normaliseProfile(raw).currentCompany, expectedCompany);
}

// normaliseProfile — filter removes entries with no name/profileUrl
console.log('\nnormaliseProfile — sentinel detection (filter):');
const sentinelItem = { _status: 'no_data', _reason: 'cookie-invalid' };
const normalised = normaliseProfile(sentinelItem);
assert('sentinel has no name',       normalised.name,       '');
assert('sentinel has no profileUrl', normalised.profileUrl, '');

// _alumniForCompany — company matching
const alumni = [
  { currentCompany: 'Google LLC',        profileUrl: 'a', name: 'A' },
  { currentCompany: 'Meta Platforms',    profileUrl: 'b', name: 'B' },
  { currentCompany: 'TikTok',            profileUrl: 'c', name: 'C' },
  { currentCompany: 'Kaiser Permanente', profileUrl: 'd', name: 'D' },
  { currentCompany: 'Deloitte',          profileUrl: 'e', name: 'E' },
  { currentCompany: '',                  profileUrl: 'f', name: 'F' }, // empty — should never match
];

console.log('\n_alumniForCompany — company matching:');
assert('"Google" matches "Google LLC"',            alumniForCompany('Google', alumni).length,             1);
assert('"Meta" matches "Meta Platforms"',          alumniForCompany('Meta', alumni).length,               1);
assert('"TikTok / ByteDance" matches "TikTok"',   alumniForCompany('TikTok / ByteDance', alumni).length, 1);
assert('"Kaiser Permanente" exact match',          alumniForCompany('Kaiser Permanente', alumni).length,  1);
assert('"Deloitte S&A" matches "Deloitte"',        alumniForCompany('Deloitte S&A', alumni).length,       1);
assert('empty company never matches',              alumniForCompany('Google', alumni.slice(-1)).length,   0);
assert('"GoodRx" no match in list',                alumniForCompany('GoodRx', alumni).length,             0);

console.log(`\n${pass + fail} tests — ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
