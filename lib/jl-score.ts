export const PROFILE = {
  target_titles: [
    'Entry Level Data Analyst','Junior Data Analyst','Associate Data Analyst','Data Analyst',
    'Data Coordinator','Business Intelligence Analyst','Junior Business Analyst',
    'Associate Business Analyst','Business Analyst','Business Systems Analyst',
    'Product Analyst','Associate Product Analyst','Operations Analyst',
    'Associate Operations Analyst','Reporting Analyst','Research Analyst',
    'Compliance Analyst','Data Operations Specialist','Operations Specialist',
    'Analytics Consultant','Technology Consultant','Data Visualization Analyst','Analytics Engineer',
  ],
  must_have_keywords: [
    'entry level','junior','associate','intern','graduate','analytics',
    'business intelligence','requirements','database','reporting','visualization','dashboard','data-driven',
  ],
  excluded_keywords: [
    'senior consultant','lead consultant','senior manager','associate manager','regional manager',
    'principal','staff','director','vice president','VP','architect','expert','head of',
    '3+ years','3 or more years','minimum 3 years','4+ years','5+ years','6+ years',
    '7+ years','8+ years','10+ years','minimum experience of 3','at least 3 years',
    '3 years of experience','4 years of experience','5 years of experience',
    'unpaid','commission only','door-to-door',
  ],
  remote_terms: ['remote','hybrid','telework','wfh','work from home','virtual','anywhere in the u.s'],
};

// City names that appear in multiple states — require state context to match
const DISAMBIGUATED: { city: string; states: string[] }[] = [
  { city: 'arlington',  states: ['tx','texas','dfw','fort worth'] },
  { city: 'glendale',   states: ['ca','california','los angeles'] },
  { city: 'aurora',     states: ['co','colorado','denver'] },
  { city: 'lakewood',   states: ['co','colorado','denver'] },
  { city: 'henderson',  states: ['nv','nevada','las vegas'] },
  { city: 'sandy',      states: ['ut','utah','salt lake'] },
  { city: 'beaverton',  states: ['or','oregon','portland'] },
  { city: 'hillsboro',  states: ['or','oregon','portland'] },
  { city: 'burbank',    states: ['ca','california','los angeles'] },
  { city: 'carson',     states: ['ca','california','los angeles'] },
  { city: 'compton',    states: ['ca','california','los angeles'] },
  { city: 'hawthorne',  states: ['ca','california','los angeles'] },
  { city: 'inglewood',  states: ['ca','california','los angeles'] },
  { city: 'westwood',   states: ['ca','california','los angeles'] },
  { city: 'austin',     states: ['tx','texas','round rock','pflugerville'] },
  { city: 'portland',   states: ['or','oregon','beaverton','hillsboro'] },
  { city: 'richmond',   states: ['ca','california'] },
];

// Unambiguous preferred cities/regions (any state context is fine)
// NOTE: cities that appear in multiple states are handled by DISAMBIGUATED above — do NOT list them here
const PREFERRED_CITIES = [
  'west hollywood','silver lake','los feliz','koreatown','mid-wilshire','la brea',
  'hancock park','larchmont','hollywood','century city','brentwood',
  'beverly hills','culver city','santa monica','playa vista','marina del rey',
  'venice','el segundo','manhattan beach','hermosa beach','redondo beach','torrance',
  'north hollywood','van nuys','chatsworth','long beach','downey',
  'studio city','sherman oaks','encino',
  'pasadena','alhambra','san gabriel','arcadia','monrovia',
  'irvine','anaheim','costa mesa','newport beach','huntington beach',
  'fullerton','brea','santa ana','garden grove',
  'san diego','la jolla','chula vista','carlsbad','oceanside','escondido',
  'del mar','encinitas','el cajon','national city',
  'dallas','fort worth','plano','irving','frisco','mckinney',
  'round rock',
  'seattle','bellevue','redmond','kirkland','tacoma',
  'denver','boulder','salt lake city','provo','las vegas',
  'los angeles','orange county','dfw','socal','southern california',
  // These are unambiguous enough at metro level:
  'palms, los angeles','palms, la','inglewood, ca','compton, ca',
];

function isPreferredLocation(locL: string): boolean {
  // Check unambiguous cities
  if (PREFERRED_CITIES.some(c => locL.includes(c))) return true;

  // Check disambiguated cities (require state context)
  for (const { city, states } of DISAMBIGUATED) {
    if (locL.includes(city) && states.some(s => locL.includes(s))) return true;
  }

  return false;
}

export function scoreJob(title: string, description: string, location: string): { score: number; tier: string } {
  const text   = `${title} ${description}`.toLowerCase();
  const titleL = title.toLowerCase();
  const locL   = location.toLowerCase().trim();
  let score = 0;

  // Title match: +40
  if (PROFILE.target_titles.some(t => titleL.includes(t.toLowerCase()))) score += 40;

  // Must-have keywords — cap at 3 matches (+15 max) so long federal descriptions don't dominate
  const kwMatches = PROFILE.must_have_keywords.filter(k => text.includes(k)).length;
  score += Math.min(kwMatches, 3) * 5;

  // Excluded keywords: hard -50
  if (PROFILE.excluded_keywords.some(k => text.includes(k))) score -= 50;

  // Senior/lead in the job TITLE specifically — these are overqualified roles
  if (/\b(senior|lead|sr\.?|ii|iii|iv)\b/.test(titleL)) score -= 30;

  // Location scoring — only check the location field, NOT the description
  // (descriptions often mention "remote" incidentally even for on-site jobs)
  const isRemote   = PROFILE.remote_terms.some(r => locL.includes(r));
  const isNational = locL === 'us' || locL === 'united states' || locL === '' || locL === 'nationwide';

  if (isRemote) {
    score += 20;
  } else if (!isNational) {
    if (isPreferredLocation(locL)) {
      score += 15;
    } else {
      score -= 60; // wrong geography: heavy penalty
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, tier: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C' };
}
