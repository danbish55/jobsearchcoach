import { NextResponse } from 'next/server';

const DEFAULT_CONFIG = {
  role_keyword: 'Data Analyst',
  min_results: 50,
  score_excellent_threshold: 90,
  score_strong_threshold: 70,
  titles: {
    tier1: ['Entry Level Data Analyst','Junior Data Analyst','Associate Data Analyst','Data Analyst','Data Coordinator','Business Intelligence Analyst','Junior Business Analyst','Associate Business Analyst','Business Analyst','Business Systems Analyst'],
    tier2: ['Product Analyst','Associate Product Analyst','Operations Analyst','Associate Operations Analyst','Reporting Analyst','Research Analyst','Compliance Analyst','Data Operations Specialist','Data Visualization Analyst','Analytics Engineer'],
    tier3: ['Operations Specialist','Analytics Consultant','Technology Consultant'],
  },
  skills: {
    tier1: ['SQL','Python','Tableau','statistical analysis','data visualization'],
    tier2: ['Power BI','Excel','machine learning','data modeling','ETL','business intelligence'],
    tier3: ['database management','optimization','requirements analysis','systems analysis','A/B test','forecasting'],
  },
  keywords: {
    tier1: ['new grad','recent graduate','no experience required'],
    tier2: ['entry level','0-2 years','0 to 2 years','1-2 years','junior','associate'],
    tier3: ["master's preferred",'MSBA','MBA','advanced degree'],
  },
  locations: {
    tier1: ['West Hollywood','Silver Lake','Los Feliz','Koreatown','Hollywood','Century City','Brentwood','Westwood','Beverly Hills','Culver City','Santa Monica','Playa Vista','Marina del Rey','Venice','El Segundo','Manhattan Beach','Hermosa Beach','Redondo Beach','Torrance','Hawthorne','Inglewood','Burbank','Glendale','Pasadena','Alhambra','San Gabriel','Arcadia','Studio City','Sherman Oaks','Encino','North Hollywood','Van Nuys','Long Beach','Downey','Carson','Los Angeles','Irvine','Anaheim','Orange County','Costa Mesa','Newport Beach','Huntington Beach','Fullerton','Brea','Santa Ana','Garden Grove','San Diego','La Jolla','Chula Vista','Carlsbad','Oceanside','Escondido','Del Mar','Encinitas','El Cajon','National City'],
    tier2: ['Dallas','Fort Worth','DFW','Plano','Irving','Frisco','McKinney','Arlington','Austin','Round Rock','Denver','Boulder','Aurora','Lakewood','Seattle','Bellevue','Redmond','Kirkland','Tacoma','Salt Lake City','Provo','Sandy','Portland','Beaverton','Hillsboro','Houston','Sugar Land','The Woodlands','Katy','St. Louis','Saint Louis'],
    tier3: ['Las Vegas','Henderson','Summerlin'],
  },
  scoring: {
    skills_max: 40, experience_max: 30, trajectory_max: 20, preference_max: 10,
    title_tier1_pts: 20, title_tier2_pts: 12, title_tier3_pts: 5,
    skill_tier1_weight: 10, skill_tier2_weight: 6, skill_tier3_weight: 3,
    keyword_tier1_pts: 30, keyword_tier2_pts: 28, keyword_tier3_bonus: 5,
    location_remote_pts: 8, location_tier1_pts: 9, location_tier2_pts: 7,
    location_tier3_pts: 5, location_ambiguous_pts: 2, location_non_preferred_pts: 0,
    exp_default_pts: 22,
    senior_title_penalty: 15,
    min_score_threshold: 30,
  },
};

export async function GET() {
  return NextResponse.json({ ok: true, has_token: false, config: DEFAULT_CONFIG });
}

export async function POST() {
  // On Vercel, config is local-only — settings saved but not persisted server-side.
  return NextResponse.json({ ok: true });
}
