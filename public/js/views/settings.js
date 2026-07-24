/* Settings view */
const Settings = (() => {
  const DEFAULT_CONTACTS = {
    name: 'Corinne',
    student_email: 'corinne@example.com',
    parent1_name: 'Dad',
    parent1_email: 'contact@example.com',
    parent2_name: 'Mom',
    parent2_email: 'supporter@example.com',
  };

  const DATA_KEYS = [
    'installation',
    'profile',
    'candidate_profile',
    'progress',
    'milestones',
    'jobs',
    'usc',
    'resume',
    'deep_dive',
    'cover_letters',
    'sessions',
    'coach_current_session',
    'gauges',
    'gauge_settings',
    'job_target_tracker',
    'chat_memory',
    'mission_discussion_dossier',
    'mission_discussion_network',
    'mission_discussion_deploy',
    'mission_discussion_interview',
    'mission_discussion_negotiate',
    'mission_discussion_extraction',
  ];

  const PROFILE_TAG_FIELDS = [
    { key: 'target_roles', label: 'Target Roles', placeholder: 'Data Analyst, Business Analyst' },
    { key: 'skills', label: 'Skills', placeholder: 'SQL, Python, Tableau' },
    { key: 'must_have_keywords', label: 'Must-Have Keywords', placeholder: 'analytics, dashboard, forecasting' },
    { key: 'preferred_keywords', label: 'Preferred Keywords', placeholder: 'new grad, entry level, MSBA' },
    { key: 'excluded_keywords', label: 'Excluded Keywords', placeholder: 'senior, unpaid, commission' },
    { key: 'preferred_locations', label: 'Preferred Locations', placeholder: 'Los Angeles, Santa Monica, Remote' },
    { key: 'affinity_schools', label: 'Affinity Schools', placeholder: 'USC, Marshall, UofA, Eller' },
  ];

  const DEFAULT_CANDIDATE_PROFILE = {
    target_roles: [],
    skills: [],
    must_have_keywords: [],
    preferred_keywords: [],
    excluded_keywords: [],
    preferred_locations: [],
    affinity_schools: ['USC', 'Marshall', 'UofA', 'Eller'],
  };

  const SCORING_WEIGHT_FIELDS = [
    { key: 'title_match_weight', label: 'Title match weight', defaultValue: 40 },
    { key: 'skills_weight', label: 'Skills weight', defaultValue: 35 },
    { key: 'must_have_keywords_weight', label: 'Must-have keywords weight', defaultValue: 20 },
    { key: 'location_bonus', label: 'Location bonus', defaultValue: 5 },
    { key: 'excluded_keyword_penalty', label: 'Excluded keyword penalty', defaultValue: -40 },
    { key: 'affinity_school_bonus', label: 'Affinity school bonus', defaultValue: 15 },
  ];

  const JOB_SOURCE_FIELDS = [
    {
      key: 'usajobs',
      label: 'USAJOBS',
      description: 'Federal analytics and IT roles. Requires a USAJOBS API key.',
      requiresKey: true,
    },
    {
      key: 'adzuna',
      label: 'Adzuna',
      description: 'Broad job search API for analytics roles. Enter the Adzuna app key; the approved App ID is built in.',
      requiresKey: true,
    },
    {
      key: 'the_muse',
      label: 'The Muse',
      description: 'Company-focused roles and career content with structured listings. Free, no key.',
      requiresKey: false,
    },
    {
      key: 'remoteok',
      label: 'RemoteOK',
      description: 'All-remote tech and analytics roles. Free public API, no key.',
      requiresKey: false,
    },
    {
      key: 'remotive',
      label: 'Remotive',
      description: 'Curated remote jobs with salary and structured data. Free public API, no key.',
      requiresKey: false,
    },
    {
      key: 'greenhouse',
      label: 'Greenhouse',
      description: 'Per-company career boards (Greenhouse API). Requires a curated company list — not yet wired for general search.',
      requiresKey: false,
    },
    {
      key: 'lever',
      label: 'Lever',
      description: 'Per-company career boards (Lever API). Requires a curated company list — not yet wired for general search.',
      requiresKey: false,
    },
    {
      key: 'indeed_rss',
      label: 'Indeed RSS',
      description: 'RSS-based search feed. Indeed blocks automated requests; not currently fetched.',
      requiresKey: false,
    },
    {
      key: 'built_in_la',
      label: 'Built In LA',
      description: 'Los Angeles tech-company listings. Not currently fetched.',
      requiresKey: false,
    },
  ];

  const GAUGE_GOAL_FIELDS = [
    { key: 'apps_target', label: 'Weekly applications goal', defaultValue: 10 },
    { key: 'followups_target', label: 'Weekly follow-ups goal', defaultValue: 10 },
    { key: 'usc_eller_target', label: 'Weekly USC / Eller networking goal', defaultValue: 6 },
    { key: 'networking_target', label: 'Weekly general networking goal', defaultValue: 6 },
    { key: 'interview_prep_target', label: 'Weekly interview prep goal', defaultValue: 6 },
    { key: 'linkedin_target', label: 'Weekly LinkedIn activity goal', defaultValue: 6 },
    { key: 'portfolio_target', label: 'Portfolio project goal', defaultValue: 3 },
    { key: 'resume_variants_target', label: 'Resume variants goal', defaultValue: 3 },
    { key: 'side_hustle_income_target', label: 'Weekly side hustle income goal ($)', defaultValue: 250 },
    { key: 'side_hustle_items_target', label: 'Weekly side hustle portfolio item goal', defaultValue: 1 },
  ];

  let candidateProfileDraft = null;
  let apifyConfigDraft      = null;

  const APIFY_SCORING_FIELDS = [
    { key: 'skills_max',                 label: 'Skills max pts',          defaultValue: 40  },
    { key: 'experience_max',             label: 'Experience max pts',      defaultValue: 30  },
    { key: 'trajectory_max',             label: 'Trajectory max pts',      defaultValue: 20  },
    { key: 'preference_max',             label: 'Preference max pts',      defaultValue: 10  },
    { key: 'title_tier1_pts',            label: 'Title Tier 1 pts',        defaultValue: 20  },
    { key: 'title_tier2_pts',            label: 'Title Tier 2 pts',        defaultValue: 12  },
    { key: 'title_tier3_pts',            label: 'Title Tier 3 pts',        defaultValue:  5  },
    { key: 'skill_tier1_weight',         label: 'Skill Tier 1 weight',     defaultValue: 10  },
    { key: 'skill_tier2_weight',         label: 'Skill Tier 2 weight',     defaultValue:  6  },
    { key: 'skill_tier3_weight',         label: 'Skill Tier 3 weight',     defaultValue:  3  },
    { key: 'keyword_tier1_pts',          label: 'Keyword Tier 1 pts',      defaultValue: 30  },
    { key: 'keyword_tier2_pts',          label: 'Keyword Tier 2 pts',      defaultValue: 28  },
    { key: 'keyword_tier3_bonus',        label: 'Keyword Tier 3 bonus',    defaultValue:  5  },
    { key: 'location_remote_pts',        label: 'Remote/hybrid pts',       defaultValue:  8  },
    { key: 'location_tier1_pts',         label: 'Location Tier 1 pts',     defaultValue:  9  },
    { key: 'location_tier2_pts',         label: 'Location Tier 2 pts',     defaultValue:  7  },
    { key: 'location_tier3_pts',         label: 'Location Tier 3 pts',     defaultValue:  5  },
    { key: 'location_ambiguous_pts',     label: 'Ambiguous location pts',  defaultValue:  2  },
    { key: 'location_non_preferred_pts', label: 'Non-preferred penalty',   defaultValue: -15 },
  ];

  function render() {
    const status = Config.get() || {};
    const profile = Storage.get('profile', {});
    candidateProfileDraft = _loadCandidateProfileDraft(profile);
    const container = document.getElementById('settings-content');

    container.innerHTML = `
      <div style="max-width:600px">

        <!-- Profile -->
        <div class="settings-section">
          ${_sectionHeaderHTML('your-profile', 'Your Profile')}
          <div id="your-profile-panel" style="display:none">

          <div class="setting-row">
            <span class="setting-label">Name</span>
            <div class="setting-control">
              <input id="s-name" type="text" value="${_esc(profile.name || DEFAULT_CONTACTS.name)}" placeholder="Your name">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Email</span>
            <div class="setting-control">
              <input id="s-student-email" type="email" value="${_esc(profile.student_email || DEFAULT_CONTACTS.student_email)}" placeholder="corinne@example.com">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">School</span>
            <div class="setting-control">
              <input id="s-school" type="text" value="${_esc(profile.school || 'USC')}" placeholder="School name">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Grad Year</span>
            <div class="setting-control" style="max-width:120px">
              <input id="s-grad" type="text" value="${_esc(profile.grad_year || '')}" placeholder="2024">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Major</span>
            <div class="setting-control">
              <input id="s-major" type="text" value="${_esc(profile.major || '')}" placeholder="Your major">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Target Roles</span>
            <div class="setting-control">
              <input id="s-roles" type="text"
                value="${_esc((profile.target_roles || []).join(', '))}"
                placeholder="Marketing Coordinator, Brand Manager">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Comma-separated</div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Target Industries</span>
            <div class="setting-control">
              <input id="s-industries" type="text"
                value="${_esc((profile.target_industries || []).join(', '))}"
                placeholder="Tech, Entertainment, Media">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Comma-separated</div>
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveProfile()">Save Profile</button>
          </div>
          </div>
        </div>

        <!-- Success Gauge Goals -->
        <div class="settings-section">
          ${_sectionHeaderHTML('success-gauge-goals', 'Success Gauge Goals')}
          <div id="success-gauge-goals-panel" style="display:none">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">
            Adjust the targets used by the dashboard success gauges. Values must be whole numbers greater than zero.
          </div>
          ${GAUGE_GOAL_FIELDS.map(_gaugeGoalFieldHTML).join('')}
          <div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveGaugeGoals()">Save Gauge Goals</button>
            <span id="gauge-goals-error" style="font-size:12px;color:var(--danger)"></span>
          </div>
          </div>
        </div>

        <!-- Job Search Profile -->
        <div class="settings-section">
          ${_sectionHeaderHTML('job-search-profile', 'Job Search Profile')}
          <div id="job-search-profile-panel" style="display:none">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">
              These tags shape the Job Leads matching profile. Type a value and press Enter.
            </div>
            ${PROFILE_TAG_FIELDS.map(_tagFieldHTML).join('')}
            <div style="margin-top:18px">
              <button type="button" onclick="Settings.toggleSection('advanced-scoring-weights')"
                style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);cursor:pointer;text-align:left">
                <span style="font-size:13px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em">Advanced Scoring Weights</span>
                <span id="advanced-scoring-weights-chevron" style="color:var(--gold);font-size:16px;line-height:1;transition:transform 0.2s ease;transform:rotate(-90deg)">v</span>
              </button>
              <div id="advanced-scoring-weights-panel" style="display:none;border:1px solid var(--border);border-top:0;border-radius:0 0 8px 8px;padding:14px 12px">
                ${SCORING_WEIGHT_FIELDS.map(_weightFieldHTML).join('')}
              </div>
            </div>
            <div style="margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="Settings.saveJobSearchProfile()">Save Profile</button>
              <span id="job-search-profile-error" style="font-size:12px;color:var(--danger)"></span>
            </div>
            <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border)">
              <div class="settings-section-title" style="font-size:13px">Job Sources</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">
                Choose which feeds the Job Leads tool may use. API keys stay in local config only.
              </div>
              ${JOB_SOURCE_FIELDS.map(_jobSourceFieldHTML).join('')}
              <div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" onclick="Settings.saveJobSources()">Save Sources</button>
                <span id="job-sources-error" style="font-size:12px;color:var(--danger)"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Report Emails -->
        <div class="settings-section">
          ${_sectionHeaderHTML('progress-report-recipients', 'Progress Report Recipients')}
          <div id="progress-report-recipients-panel" style="display:none">
          <div class="setting-row">
            <span class="setting-label">Recipient 1 Name</span>
            <div class="setting-control">
              <input id="s-p1-name" type="text" value="${_esc(profile.parent1_name || DEFAULT_CONTACTS.parent1_name)}" placeholder="Dad">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Dad's Email</span>
            <div class="setting-control">
              <input id="s-p1-email" type="email" value="${_esc(profile.parent1_email || DEFAULT_CONTACTS.parent1_email)}" placeholder="dad@example.com">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Recipient 2 Name</span>
            <div class="setting-control">
              <input id="s-p2-name" type="text" value="${_esc(profile.parent2_name || DEFAULT_CONTACTS.parent2_name)}" placeholder="Mom">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Mom's Email</span>
            <div class="setting-control">
              <input id="s-p2-email" type="email" value="${_esc(profile.parent2_email || DEFAULT_CONTACTS.parent2_email)}" placeholder="mom@example.com">
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveParentEmails()">Save Emails</button>
          </div>
          </div>
        </div>

        <!-- API Key -->
        <div class="settings-section">
          ${_sectionHeaderHTML('coach-access-key', 'Coach Access Key')}
          <div id="coach-access-key-panel" style="display:none">
          <div class="setting-row">
            <span class="setting-label">Access Key</span>
            <div class="api-key-display">
              <span class="api-key-dots">${status.has_api_key ? '●●●●●●●●●●●●●●●●●●●●' : 'Not configured'}</span>
              <span style="font-size:12px;color:${status.has_api_key ? 'var(--success)' : 'var(--danger)'}">
                ${status.has_api_key ? '✓ Saved' : '✗ Missing'}
              </span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Update Key</span>
            <div class="setting-control">
                <input id="s-apikey" type="password" placeholder="Paste a replacement key from Dad"
                autocomplete="off" style="font-family:monospace">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Model</span>
            <div class="setting-control">
              <div style="font-family:monospace;font-size:13px;color:var(--text-muted)">
                ${status.claude_model || Config.claudeModel()} (configured)
              </div>
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveApiKey()">Update API Key</button>
          </div>
          </div>
        </div>

        <!-- LinkedIn Radar -->
        <div class="settings-section">
          ${_sectionHeaderHTML('linkedin-radar', 'LinkedIn Radar')}
          <div id="linkedin-radar-panel" style="display:none">

          <div class="setting-row">
            <span class="setting-label">Apify Token</span>
            <div class="setting-control">
              <input id="ar-apify-token" type="password" placeholder="apify_api_…" autocomplete="off" style="font-family:monospace;font-size:12px">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px" id="ar-token-status">Leave blank to keep the current token.</div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Role Keyword</span>
            <div class="setting-control">
              <input id="ar-role-keyword" type="text" placeholder="Data Analyst">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">LinkedIn search keyword</div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Min Results</span>
            <div class="setting-control" style="max-width:110px">
              <input id="ar-min-results" type="number" min="10" max="200" placeholder="50">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Excellent ≥</span>
            <div class="setting-control" style="max-width:110px">
              <input id="ar-score-excellent" type="number" min="1" max="100" placeholder="90">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Green row threshold</div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Strong ≥</span>
            <div class="setting-control" style="max-width:110px">
              <input id="ar-score-strong" type="number" min="1" max="100" placeholder="70">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Amber row threshold</div>
            </div>
          </div>

          <div style="margin:20px 0 16px;padding:14px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.03);font-size:12px;line-height:1.7;color:var(--text-muted)">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">How Scoring Works</div>
            <p style="margin:0 0 6px">Each job is scored 0–100 across four categories. <strong style="color:var(--text)">Tiers</strong> assign different weights to core vs. adjacent matches within each category.</p>
            <ul style="margin:8px 0 0 16px;padding:0;display:flex;flex-direction:column;gap:6px">
              <li><strong style="color:var(--text)">Skills (40 pts max)</strong> — Tier 1 skills score higher per match; Tier 2 and 3 progressively less. Total scales with breadth.</li>
              <li><strong style="color:var(--text)">Experience (30 pts max)</strong> — Tier 1 keywords ("new grad") = 30 pts. Tier 2 ("entry level") = 28 pts. Tier 3 keywords (MSBA/master's) add a +5 bonus.</li>
              <li><strong style="color:var(--text)">Role Trajectory (20 pts max)</strong> — Tier 1 title = 20 pts, Tier 2 = 12 pts, Tier 3 = 5 pts. No match = 5 pts.</li>
              <li><strong style="color:var(--text)">Preference (10 pts max)</strong> — Remote/hybrid = 8 pts. Tier 1 cities = 9 pts, Tier 2 = 7 pts, Tier 3 = 5 pts. Non-preferred location = −15 pts. Salary listed adds +1.</li>
            </ul>
          </div>

          <div style="font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px">Job Titles</div>
          ${_apifyTagFieldHTML('titles_tier1', 'Tier 1 (20 pts)', 'Data Analyst, Business Analyst…')}
          ${_apifyTagFieldHTML('titles_tier2', 'Tier 2 (12 pts)', 'Product Analyst, Reporting Analyst…')}
          ${_apifyTagFieldHTML('titles_tier3', 'Tier 3 (5 pts)', 'Operations Specialist…')}

          <div style="font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px">Skills</div>
          ${_apifyTagFieldHTML('skills_tier1', 'Tier 1 (10 pts each)', 'SQL, Python, Tableau…')}
          ${_apifyTagFieldHTML('skills_tier2', 'Tier 2 (6 pts each)', 'Power BI, Excel, machine learning…')}
          ${_apifyTagFieldHTML('skills_tier3', 'Tier 3 (3 pts each)', 'database management, A/B test…')}

          <div style="font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px">Experience Keywords</div>
          ${_apifyTagFieldHTML('keywords_tier1', 'Tier 1 (30 pts)', 'new grad, recent graduate…')}
          ${_apifyTagFieldHTML('keywords_tier2', 'Tier 2 (28 pts)', 'entry level, 0-2 years…')}
          ${_apifyTagFieldHTML('keywords_tier3', 'Tier 3 (+5 bonus)', "master's preferred, MSBA…")}

          <div style="font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px">Locations</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Remote/hybrid jobs bypass location scoring entirely (+8 pts regardless of city).</div>
          ${_apifyTagFieldHTML('locations_tier1', 'Tier 1 (9 pts)', 'Los Angeles, Santa Monica, Irvine, San Diego…')}
          ${_apifyTagFieldHTML('locations_tier2', 'Tier 2 (7 pts)', 'Dallas, Denver, Seattle…')}
          ${_apifyTagFieldHTML('locations_tier3', 'Tier 3 (5 pts)', 'Las Vegas, Henderson…')}

          <div style="margin-top:18px">
            <button type="button" onclick="Settings.toggleSection('ar-advanced-scoring')"
              style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);cursor:pointer;text-align:left">
              <span style="font-size:13px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em">Advanced Scoring Weights</span>
              <span id="ar-advanced-scoring-chevron" style="color:var(--gold);font-size:16px;line-height:1;transition:transform 0.2s ease;transform:rotate(-90deg)">v</span>
            </button>
            <div id="ar-advanced-scoring-panel" style="display:none;border:1px solid var(--border);border-top:0;border-radius:0 0 8px 8px;padding:14px 12px">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Exact point values used during scoring. Defaults work well for most searches.</div>
              ${_apifyScoringWeightFieldsHTML()}
            </div>
          </div>

          <div style="margin-top:18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveApifySettings()">Save LinkedIn Radar Settings</button>
            <span id="ar-settings-error" style="font-size:12px;color:var(--danger)"></span>
            <span id="ar-settings-ok" style="font-size:12px;color:var(--success)"></span>
          </div>
          </div>
        </div>

        <!-- Google Drive -->
        <div class="settings-section">
          ${_sectionHeaderHTML('google-drive-sync', 'Google Drive Sync')}
          <div id="google-drive-sync-panel" style="display:none">
          <div class="setting-row">
            <span class="setting-label">Status</span>
            <div class="drive-status-badge ${status.has_drive ? 'connected' : 'disconnected'}">
              ${status.has_drive ? '✓ Connected' : '✗ Not connected'}
            </div>
          </div>
          ${!status.has_drive ? `
          ${status.google_client_id ? `
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
              Sign in with the Google account where you want to save app data.
            </div>
          ` : `
            <div class="setting-row">
              <span class="setting-label">Client ID</span>
              <div class="setting-control">
                <input id="s-gclient-id" type="text" placeholder="123456789-xxx.apps.googleusercontent.com"
                  style="font-family:monospace;font-size:12px">
              </div>
            </div>
            <div class="setting-row">
              <span class="setting-label">Client Secret</span>
              <div class="setting-control">
                <input id="s-gclient-secret" type="password" placeholder="GOCSPX-..."
                  style="font-family:monospace;font-size:12px">
              </div>
            </div>
          `}
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.connectDrive()">Connect Google Drive</button>
          </div>` : `
          <div style="margin-top:4px">
            <button class="btn btn-ghost btn-sm" onclick="Settings.disconnectDrive()">Disconnect Drive</button>
          </div>`}
          </div>
        </div>

        <!-- Data -->
        <div class="settings-section">
          ${_sectionHeaderHTML('settings-data', 'Data')}
          <div id="settings-data-panel" style="display:none">
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="Settings.exportData()">Export All Data</button>
            <button class="btn btn-ghost btn-sm" onclick="Settings.chooseBackupFile()">Reload from Backup</button>
            <button class="btn btn-danger btn-sm" onclick="Settings.resetAll()">Reset Everything</button>
            <input id="backup-file-input" type="file" accept="application/json,.json" style="display:none"
              onchange="Settings.restoreBackup(this.files && this.files[0])">
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Export saves a JSON file of all your data. Reset clears localStorage — your config.json on disk is preserved.
          </div>
          </div>
        </div>
      </div>`;
    _loadJobSearchSettings();
  }

  function _sectionHeaderHTML(sectionId, title) {
    return `
      <button type="button" onclick="Settings.toggleSection('${sectionId}')"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:0;border-bottom:1px solid var(--border);padding:0 0 8px;margin-bottom:12px;color:var(--text);cursor:pointer;text-align:left">
        <span class="settings-section-title" style="border:0;padding:0;margin:0">${_esc(title)}</span>
        <span id="${sectionId}-chevron" style="color:var(--gold);font-size:18px;line-height:1;transition:transform 0.2s ease;transform:rotate(-90deg)">v</span>
      </button>`;
  }

  function saveProfile() {
    const updates = {
      name:               document.getElementById('s-name').value.trim(),
      student_email:      document.getElementById('s-student-email').value.trim(),
      school:             document.getElementById('s-school').value.trim(),
      grad_year:          document.getElementById('s-grad').value.trim(),
      major:              document.getElementById('s-major').value.trim(),
      target_roles:       document.getElementById('s-roles').value.split(',').map(s=>s.trim()).filter(Boolean),
      target_industries:  document.getElementById('s-industries').value.split(',').map(s=>s.trim()).filter(Boolean),
    };
    Storage.merge('profile', updates);
    UI.updateSidebar();
    UI.notify('Profile saved', 'success');
  }

  function saveParentEmails() {
    const updates = {
      parent1_name:  document.getElementById('s-p1-name').value.trim() || DEFAULT_CONTACTS.parent1_name,
      parent1_email: document.getElementById('s-p1-email').value.trim(),
      parent2_name:  document.getElementById('s-p2-name').value.trim() || DEFAULT_CONTACTS.parent2_name,
      parent2_email: document.getElementById('s-p2-email').value.trim(),
    };
    Storage.merge('profile', updates);
    UI.notify('Report emails saved', 'success');
  }

  function saveGaugeGoals() {
    const errorEl = document.getElementById('gauge-goals-error');
    if (errorEl) errorEl.textContent = '';

    const settings = {};
    for (const field of GAUGE_GOAL_FIELDS) {
      const raw = document.getElementById(`gauge-goal-${field.key}`)?.value;
      const value = parseInt(raw, 10);
      if (!Number.isFinite(value) || value < 1) {
        if (errorEl) errorEl.textContent = `${field.label} must be at least 1.`;
        UI.notify('Gauge goals must be positive whole numbers', 'error');
        return;
      }
      settings[field.key] = value;
    }

    Storage.set('gauge_settings', settings);
    const bandEl = document.getElementById('gauge-band-container');
    if (bandEl) bandEl.innerHTML = Gauges.renderBand();
    Gauges.refreshLiveCounts();
    UI.notify('Gauge goals saved', 'success');
  }

  async function saveApiKey() {
    const key = document.getElementById('s-apikey')?.value.trim();
    if (!key) { UI.notify('Enter the new access key first', 'error'); return; }
    if (!key.startsWith('sk-')) { UI.notify('Key should start with sk-', 'error'); return; }
    await Config.save({ anthropic_api_key: key });
    document.getElementById('s-apikey').value = '';
    UI.notify('Access key updated', 'success');
    render();
  }

  async function connectDrive() {
    const status = Config.get() || {};
    const clientId = status.google_client_id || document.getElementById('s-gclient-id')?.value.trim();
    const clientSecret = document.getElementById('s-gclient-secret')?.value.trim();
    if (!clientId) { UI.notify('Google Drive setup is missing. Ask Dad for the prepared package.', 'error'); return; }
    if (!status.google_client_id && !clientSecret) { UI.notify('Enter both Client ID and Secret', 'error'); return; }
    if (!status.google_client_id) await Config.save({ google_client_id: clientId, google_client_secret: clientSecret });
    UI.notify('Opening Google auth window...', 'info');
    try {
      const result = await Drive.startOAuth(clientId);
      if (!result.ok) throw new Error(result.error || 'Google Drive connection failed.');
      await Config.load();
      const connected = await Drive.init();
      if (!connected) throw new Error('Google Drive connection could not be verified.');
      const storageState = await SampleData.prepareStorage(true, { preserveLocal: true });
      if (!storageState.ready) throw new Error('Google Drive cleanup could not be completed.');
      await Storage.syncAllToDrive();
      UI.notify('Google Drive connected!', 'success');
      render();
    } catch (err) {
      UI.notify(`Drive auth failed: ${err.message}`, 'error');
    }
  }

  async function disconnectDrive() {
    if (!confirm('Disconnect Google Drive? Your local data is not affected.')) return;
    await Config.save({ google_access_token: '', google_refresh_token: '' });
    UI.notify('Google Drive disconnected', 'info');
    await Config.load();
    render();
  }

  function exportData() {
    _downloadBackup();
    UI.notify('Backup exported', 'success');
  }

  function chooseBackupFile() {
    document.getElementById('backup-file-input')?.click();
  }

  function _collectData() {
    return {
      config_status: Config.get() || {},
      theme: localStorage.getItem('jsc_theme') || 'light',
      last_view: sessionStorage.getItem('jsc_last_view') || 'dashboard',
      profile:    Storage.get('profile', {}),
      candidate_profile: Storage.get('candidate_profile', {}),
      progress:   Storage.get('progress', {}),
      milestones: Storage.get('milestones', {}),
      jobs:       Storage.get('jobs', {}),
      usc:        Storage.get('usc', {}),
      resume:     Storage.get('resume', {}),
      deep_dive:  Storage.get('deep_dive', {}),
      gauges:     Storage.get('gauges', {}),
      gauge_settings: Storage.get('gauge_settings', {}),
      job_target_tracker: Storage.get('job_target_tracker', {}),
      mission_discussions: {
        dossier:    Storage.get('mission_discussion_dossier', []),
        network:    Storage.get('mission_discussion_network', []),
        deploy:     Storage.get('mission_discussion_deploy', []),
        interview:  Storage.get('mission_discussion_interview', []),
        negotiate:  Storage.get('mission_discussion_negotiate', []),
        extraction: Storage.get('mission_discussion_extraction', []),
      },
      sessions:   Storage.get('sessions', {}),
      coach_current_session: Storage.get('coach_current_session', []),
      chat_memory: Storage.get('chat_memory', { summary: '', pending: [], updated_at: '' }),
    };
  }

  function _downloadBackup() {
    const version = _nextBackupVersion(true);
    const data = {
      exported: new Date().toISOString(),
      backup_version: version,
      filename_format: 'YYYYMMDD vX db JobSearchCoach.json',
      data: _collectData(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${_todayStamp()} v${version} db JobSearchCoach.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const data = backup.data || backup;
      if (!data || typeof data !== 'object') throw new Error('Backup file is empty.');
      _restoreKey('profile', data.profile);
      _restoreKey('candidate_profile', data.candidate_profile);
      _restoreKey('progress', data.progress);
      _restoreKey('milestones', data.milestones);
      _restoreKey('jobs', data.jobs);
      _restoreKey('usc', data.usc);
      _restoreKey('resume', data.resume);
      _restoreKey('deep_dive', data.deep_dive);
      _restoreKey('gauges', data.gauges);
      _restoreKey('gauge_settings', data.gauge_settings);
      _restoreKey('job_target_tracker', data.job_target_tracker);
      _restoreKey('sessions', data.sessions);
      _restoreKey('coach_current_session', data.coach_current_session);
      _restoreKey('chat_memory', data.chat_memory);
      const discussions = data.mission_discussions || {};
      _restoreKey('mission_discussion_dossier', discussions.dossier);
      _restoreKey('mission_discussion_network', discussions.network);
      _restoreKey('mission_discussion_deploy', discussions.deploy);
      _restoreKey('mission_discussion_interview', discussions.interview);
      _restoreKey('mission_discussion_negotiate', discussions.negotiate);
      _restoreKey('mission_discussion_extraction', discussions.extraction);
      if (data.theme) localStorage.setItem('jsc_theme', data.theme);
      if (data.last_view) sessionStorage.setItem('jsc_last_view', data.last_view);
      UI.notify('Backup restored. Reloading...', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      UI.notify(`Backup restore failed: ${err.message}`, 'error');
    } finally {
      const input = document.getElementById('backup-file-input');
      if (input) input.value = '';
    }
  }

  function _restoreKey(key, value) {
    if (value !== undefined) Storage.set(key, value);
  }

  async function resetAll() {
    if (!confirm("I'll do a backup and then clear all data except your setup information.")) return;
    _downloadBackup();
    SampleData.disableAfterReset();
    try {
      const profileResponse = await fetch('/api/jl/reset-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!profileResponse.ok) {
        const profileResult = await profileResponse.json().catch(() => ({}));
        throw new Error(profileResult.error || 'Job Search Profile reset failed');
      }
    } catch (err) {
      UI.notify(`Reset stopped: ${err.message}`, 'error');
      return;
    }
    const result = await SampleData.resetToEmpty();
    if (!result.ok) {
      UI.notify(`Local data cleared, but Drive cleanup must retry: ${result.failedKeys.join(', ')}`, 'error');
      return;
    }
    UI.notify('Backup created. Data cleared. Reloading...', 'info');
    setTimeout(() => location.reload(), 1500);
  }

  function toggleSection(sectionId) {
    const panel = document.getElementById(`${sectionId}-panel`);
    const chevron = document.getElementById(`${sectionId}-chevron`);
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
  }

  function handleTagKey(event, key) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const input = event.target;
    const values = _splitTags(input.value);
    if (!values.length) return;
    const current = candidateProfileDraft?.[key] || [];
    const normalized = new Set(current.map(v => v.toLowerCase()));
    values.forEach(value => {
      if (!normalized.has(value.toLowerCase())) {
        current.push(value);
        normalized.add(value.toLowerCase());
      }
    });
    candidateProfileDraft[key] = current;
    input.value = '';
    _renderTagList(key);
  }

  function removeProfileTag(key, index) {
    const current = candidateProfileDraft?.[key] || [];
    current.splice(index, 1);
    candidateProfileDraft[key] = current;
    _renderTagList(key);
  }

  function resetScoringWeight(key) {
    const field = SCORING_WEIGHT_FIELDS.find(item => item.key === key);
    const input = document.getElementById(`candidate-weight-${key}`);
    if (!field || !input) return;
    input.value = field.defaultValue;
  }

  async function saveJobSearchProfile() {
    const errorEl = document.getElementById('job-search-profile-error');
    if (errorEl) errorEl.textContent = '';

    const profile = _collectCandidateProfile();
    try {
      const response = await fetch('/api/jl/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'Could not save profile');
      }
      Storage.set('candidate_profile', profile);
      UI.notify('Profile saved', 'success');
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
      UI.notify('Profile save failed', 'error');
    }
  }

  async function saveJobSources() {
    const errorEl = document.getElementById('job-sources-error');
    if (errorEl) errorEl.textContent = '';

    try {
      const response = await fetch('/api/config/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: _collectJobSources() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'Could not save sources');
      }
      UI.notify('Sources saved', 'success');
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
      UI.notify('Source save failed', 'error');
    }
  }

  function toggleSourceKeyVisibility(key) {
    const input = document.getElementById(`source-${key}-key`);
    const button = document.getElementById(`source-${key}-show`);
    if (!input || !button) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Show' : 'Hide';
  }

  async function _loadJobSearchSettings() {
    const [profileResult, sourcesResult] = await Promise.allSettled([
      fetch('/api/jl/profile').then(r => r.json().then(data => ({ ok: r.ok, data }))),
      fetch('/api/config/sources').then(r => r.json().then(data => ({ ok: r.ok, data }))),
    ]);

    const syncedProfile = Storage.get('candidate_profile', {});
    if (_hasCandidateProfileData(syncedProfile)) {
      _applyCandidateProfile(syncedProfile);
    } else if (profileResult.status === 'fulfilled' && profileResult.value.ok && profileResult.value.data?.ok !== false) {
      _applyCandidateProfile(profileResult.value.data.profile || {});
    }
    if (sourcesResult.status === 'fulfilled' && sourcesResult.value.ok && sourcesResult.value.data?.ok !== false) {
      _applyJobSources(sourcesResult.value.data);
    }
    _loadApifySettings();
  }

  function _applyCandidateProfile(profile) {
    const localProfile = Storage.get('profile', {});
    candidateProfileDraft = _candidateProfileDraftFrom(profile, localProfile);
    PROFILE_TAG_FIELDS.forEach(field => _renderTagList(field.key));
    SCORING_WEIGHT_FIELDS.forEach(field => {
      const input = document.getElementById(`candidate-weight-${field.key}`);
      if (input) input.value = candidateProfileDraft.scoring_weights[field.key];
    });
  }

  function _applyJobSources(payload) {
    const sources = payload.sources || {};
    const health = payload.health || {};
    JOB_SOURCE_FIELDS.forEach(source => {
      const saved = sources[source.key] || {};
      const checkbox = document.getElementById(`source-${source.key}-enabled`);
      const keyInput = document.getElementById(`source-${source.key}-key`);
      const statusEl = document.getElementById(`source-${source.key}-status`);
      if (checkbox) checkbox.checked = !!saved.enabled;
      if (keyInput && source.requiresKey) keyInput.value = saved.api_key || '';
      if (statusEl) statusEl.textContent = _sourceStatusText(source, health);
    });
  }

  function _collectCandidateProfile() {
    const profile = Storage.get('profile', {});
    const collected = {
      name: profile.name || DEFAULT_CONTACTS.name,
      target_titles: [...(candidateProfileDraft?.target_roles || [])],
      target_roles: [...(candidateProfileDraft?.target_roles || [])],
      skills: [...(candidateProfileDraft?.skills || [])],
      must_have_keywords: [...(candidateProfileDraft?.must_have_keywords || [])],
      preferred_keywords: [...(candidateProfileDraft?.preferred_keywords || [])],
      excluded_keywords: [...(candidateProfileDraft?.excluded_keywords || [])],
      preferred_locations: [...(candidateProfileDraft?.preferred_locations || [])],
      affinity_schools: [...(candidateProfileDraft?.affinity_schools || [])],
      scoring_weights: {},
    };
    SCORING_WEIGHT_FIELDS.forEach(field => {
      const input = document.getElementById(`candidate-weight-${field.key}`);
      const value = Number(input?.value);
      collected.scoring_weights[field.key] = Number.isFinite(value) ? value : field.defaultValue;
    });
    return collected;
  }

  function _collectJobSources() {
    const sources = {};
    JOB_SOURCE_FIELDS.forEach(source => {
      sources[source.key] = {
        enabled: !!document.getElementById(`source-${source.key}-enabled`)?.checked,
      };
      if (source.requiresKey) {
        sources[source.key].api_key = document.getElementById(`source-${source.key}-key`)?.value.trim() || '';
      }
    });
    return sources;
  }

  function _loadCandidateProfileDraft(profile) {
    const saved = Storage.get('candidate_profile', {});
    return _candidateProfileDraftFrom(saved, profile);
  }

  function _hasCandidateProfileData(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return PROFILE_TAG_FIELDS.some(field => {
      const key = field.key === 'target_roles' && !Array.isArray(profile.target_roles)
        ? 'target_titles'
        : field.key;
      return Array.isArray(profile[key]) && profile[key].length > 0;
    }) || !!profile.scoring_weights;
  }

  function _candidateProfileDraftFrom(saved, profile) {
    const draft = {};
    PROFILE_TAG_FIELDS.forEach(field => {
      const savedValues = Array.isArray(saved[field.key]) ? saved[field.key] : (
        field.key === 'target_roles' && Array.isArray(saved.target_titles) ? saved.target_titles : []
      );
      const profileValues = Array.isArray(profile[field.key]) ? profile[field.key] : [];
      const defaultValues = DEFAULT_CANDIDATE_PROFILE[field.key] || [];
      const source = savedValues.length ? savedValues : (profileValues.length ? profileValues : defaultValues);
      draft[field.key] = [...source];
    });
    draft.scoring_weights = {};
    const savedWeights = saved.scoring_weights || {};
    SCORING_WEIGHT_FIELDS.forEach(field => {
      const savedValue = Number(savedWeights[field.key]);
      draft.scoring_weights[field.key] = Number.isFinite(savedValue) ? savedValue : field.defaultValue;
    });
    return draft;
  }

  // ── Apify / LinkedIn Radar ────────────────────────────────────────────────

  function handleApifyTagKey(event, key) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const input  = event.target;
    const values = _splitTags(input.value);
    if (!values.length) return;
    const current    = apifyConfigDraft?.[key] || [];
    const normalized = new Set(current.map(v => v.toLowerCase()));
    values.forEach(value => {
      if (!normalized.has(value.toLowerCase())) { current.push(value); normalized.add(value.toLowerCase()); }
    });
    if (apifyConfigDraft) apifyConfigDraft[key] = current;
    input.value = '';
    _apifyRenderTagList(key);
  }

  function removeApifyTag(key, index) {
    const current = apifyConfigDraft?.[key] || [];
    current.splice(index, 1);
    if (apifyConfigDraft) apifyConfigDraft[key] = current;
    _apifyRenderTagList(key);
  }

  function _apifyRenderTagList(key) {
    const list = document.getElementById(`apify-${key}-list`);
    if (list) list.innerHTML = _apifyTagListHTML(key);
  }

  function _apifyTagListHTML(key) {
    const values = apifyConfigDraft?.[key] || [];
    if (!values.length) {
      return `<span style="font-size:12px;color:var(--text-muted);font-style:italic">No tags yet</span>`;
    }
    return values.map((value, index) => `
      <span class="tag">
        <span>${_esc(value)}</span>
        <button type="button" class="tag-remove" onclick="Settings.removeApifyTag('${key}', ${index})"
          style="background:none;border:0;padding:0" aria-label="Remove">&times;</button>
      </span>`).join('');
  }

  function _apifyTagFieldHTML(key, label, placeholder) {
    return `<div class="setting-row" style="align-items:flex-start">
      <span class="setting-label" style="padding-top:8px">${_esc(label)}</span>
      <div class="setting-control">
        <div id="apify-${key}-list" class="tag-list" style="margin-top:0">${_apifyTagListHTML(key)}</div>
        <input id="apify-${key}-input" type="text" placeholder="${_esc(placeholder)}"
          onkeydown="Settings.handleApifyTagKey(event, '${key}')" style="margin-top:8px">
      </div>
    </div>`;
  }

  function _apifyScoringWeightFieldsHTML() {
    return APIFY_SCORING_FIELDS.map(field => {
      const val = apifyConfigDraft?.scoring?.[field.key] ?? field.defaultValue;
      return `<div class="setting-row">
        <span class="setting-label">${_esc(field.label)}</span>
        <div class="setting-control" style="max-width:110px">
          <input id="ar-scoring-${field.key}" type="number" value="${_esc(val)}">
        </div>
      </div>`;
    }).join('');
  }

  async function saveApifySettings() {
    const errEl = document.getElementById('ar-settings-error');
    const okEl  = document.getElementById('ar-settings-ok');
    if (errEl) errEl.textContent = '';
    if (okEl)  okEl.textContent  = '';

    const token = (document.getElementById('ar-apify-token')?.value || '').trim();
    const scoring = {};
    APIFY_SCORING_FIELDS.forEach(field => {
      const val = Number(document.getElementById(`ar-scoring-${field.key}`)?.value);
      scoring[field.key] = Number.isFinite(val) ? val : field.defaultValue;
    });

    const body = {
      apify_config: {
        role_keyword:              (document.getElementById('ar-role-keyword')?.value   || '').trim(),
        min_results:               Number(document.getElementById('ar-min-results')?.value)  || 50,
        score_excellent_threshold: Number(document.getElementById('ar-score-excellent')?.value) || 90,
        score_strong_threshold:    Number(document.getElementById('ar-score-strong')?.value)    || 70,
        titles:    { tier1: [...(apifyConfigDraft?.titles_tier1    || [])], tier2: [...(apifyConfigDraft?.titles_tier2    || [])], tier3: [...(apifyConfigDraft?.titles_tier3    || [])] },
        skills:    { tier1: [...(apifyConfigDraft?.skills_tier1    || [])], tier2: [...(apifyConfigDraft?.skills_tier2    || [])], tier3: [...(apifyConfigDraft?.skills_tier3    || [])] },
        keywords:  { tier1: [...(apifyConfigDraft?.keywords_tier1  || [])], tier2: [...(apifyConfigDraft?.keywords_tier2  || [])], tier3: [...(apifyConfigDraft?.keywords_tier3  || [])] },
        locations: { tier1: [...(apifyConfigDraft?.locations_tier1 || [])], tier2: [...(apifyConfigDraft?.locations_tier2 || [])], tier3: [...(apifyConfigDraft?.locations_tier3 || [])] },
        scoring,
      },
    };
    if (token) body.apify_token = token;

    try {
      const resp   = await fetch('/api/apify/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || result.ok === false) throw new Error(result.error || 'Save failed');
      if (token) {
        const tokenInput = document.getElementById('ar-apify-token');
        if (tokenInput) tokenInput.value = '';
        const statusEl = document.getElementById('ar-token-status');
        if (statusEl) statusEl.textContent = '✓ Token saved. Leave blank to keep it.';
      }
      if (okEl) { okEl.textContent = '✓ Saved'; setTimeout(() => { if (okEl) okEl.textContent = ''; }, 3000); }
      UI.notify('LinkedIn Radar settings saved', 'success');
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      UI.notify('Save failed', 'error');
    }
  }

  async function _loadApifySettings() {
    try {
      const resp = await fetch('/api/apify/config');
      if (!resp.ok) return;
      const payload = await resp.json();
      if (!payload.ok) return;
      const cfg = payload.config || {};

      apifyConfigDraft = {
        titles_tier1:    [...(cfg.titles?.tier1    || [])],
        titles_tier2:    [...(cfg.titles?.tier2    || [])],
        titles_tier3:    [...(cfg.titles?.tier3    || [])],
        skills_tier1:    [...(cfg.skills?.tier1    || [])],
        skills_tier2:    [...(cfg.skills?.tier2    || [])],
        skills_tier3:    [...(cfg.skills?.tier3    || [])],
        keywords_tier1:  [...(cfg.keywords?.tier1  || [])],
        keywords_tier2:  [...(cfg.keywords?.tier2  || [])],
        keywords_tier3:  [...(cfg.keywords?.tier3  || [])],
        locations_tier1: [...(cfg.locations?.tier1 || [])],
        locations_tier2: [...(cfg.locations?.tier2 || [])],
        locations_tier3: [...(cfg.locations?.tier3 || [])],
        scoring:         Object.assign({}, cfg.scoring || {}),
      };

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('ar-role-keyword',    cfg.role_keyword || 'Data Analyst');
      set('ar-min-results',     cfg.min_results  || 50);
      set('ar-score-excellent', cfg.score_excellent_threshold || 90);
      set('ar-score-strong',    cfg.score_strong_threshold    || 70);

      const statusEl = document.getElementById('ar-token-status');
      if (statusEl) statusEl.textContent = payload.has_token ? '✓ Token saved. Leave blank to keep it.' : 'No token saved yet.';

      APIFY_SCORING_FIELDS.forEach(field => {
        const el = document.getElementById(`ar-scoring-${field.key}`);
        if (el) el.value = apifyConfigDraft.scoring[field.key] ?? field.defaultValue;
      });

      const tagKeys = ['titles_tier1','titles_tier2','titles_tier3','skills_tier1','skills_tier2','skills_tier3','keywords_tier1','keywords_tier2','keywords_tier3','locations_tier1','locations_tier2','locations_tier3'];
      tagKeys.forEach(k => _apifyRenderTagList(k));
    } catch {}
  }

  function _tagFieldHTML(field) {
    return `
      <div class="setting-row" style="align-items:flex-start">
        <span class="setting-label" style="padding-top:8px">${field.label}</span>
        <div class="setting-control">
          <div id="candidate-${field.key}-list" class="tag-list" style="margin-top:0">
            ${_tagListHTML(field.key)}
          </div>
          <input id="candidate-${field.key}-input" type="text"
            placeholder="${_esc(field.placeholder)}"
            onkeydown="Settings.handleTagKey(event, '${field.key}')"
            style="margin-top:8px">
        </div>
      </div>`;
  }

  function _tagListHTML(key) {
    const values = candidateProfileDraft?.[key] || [];
    if (!values.length) {
      return `<span style="font-size:12px;color:var(--text-muted);font-style:italic">No tags yet</span>`;
    }
    return values.map((value, index) => `
      <span class="tag">
        <span>${_esc(value)}</span>
        <button type="button" class="tag-remove" onclick="Settings.removeProfileTag('${key}', ${index})"
          style="background:none;border:0;padding:0" aria-label="Remove ${_esc(value)}">&times;</button>
      </span>`).join('');
  }

  function _weightFieldHTML(field) {
    const value = candidateProfileDraft?.scoring_weights?.[field.key] ?? field.defaultValue;
    return `
      <div class="setting-row">
        <span class="setting-label">${field.label}</span>
        <div class="setting-control" style="display:flex;align-items:center;gap:10px">
          <input id="candidate-weight-${field.key}" type="number" value="${_esc(value)}" style="max-width:100px">
          <button type="button" onclick="Settings.resetScoringWeight('${field.key}')"
            style="background:none;border:0;color:var(--gold);font-size:12px;cursor:pointer;padding:0">
            Reset to default
          </button>
        </div>
      </div>`;
  }

  function _gaugeGoalFieldHTML(field) {
    const saved = Storage.get('gauge_settings', {});
    const savedValue = parseInt(saved[field.key], 10);
    const value = Number.isFinite(savedValue) && savedValue > 0 ? savedValue : field.defaultValue;
    return `
      <div class="setting-row">
        <span class="setting-label">${field.label}</span>
        <div class="setting-control" style="max-width:140px">
          <input id="gauge-goal-${field.key}" type="number" min="1" step="1" value="${_esc(value)}">
        </div>
      </div>`;
  }

  function _jobSourceFieldHTML(source) {
    const keyField = source.requiresKey ? `
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <input id="source-${source.key}-key" type="password" placeholder="${source.key === 'adzuna' ? 'Adzuna app key' : 'API key'}"
          autocomplete="off" style="font-family:monospace;font-size:12px">
        <button id="source-${source.key}-show" type="button" class="btn btn-ghost btn-sm"
          onclick="Settings.toggleSourceKeyVisibility('${source.key}')">Show</button>
      </div>` : `
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">No API key required</div>`;

    return `
      <div class="setting-row" style="align-items:flex-start;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">
        <span class="setting-label" style="padding-top:2px">
          <label style="display:flex;align-items:center;gap:8px;color:var(--text)">
            <input id="source-${source.key}-enabled" type="checkbox">
            ${source.label}
          </label>
        </span>
        <div class="setting-control">
          <div style="font-size:12px;color:var(--text-muted);line-height:1.45">${source.description}</div>
          ${keyField}
          <div id="source-${source.key}-status" style="font-size:11px;color:var(--text-muted);margin-top:8px">
            Last run: not loaded yet
          </div>
        </div>
      </div>`;
  }

  function _sourceStatusText(source, health) {
    const items = Array.isArray(health.sources) ? health.sources : [];
    const match = items.find(item => {
      const label = String(item.label || '').toLowerCase();
      const id = String(item.id || item.source_id || item.source || '').toLowerCase();
      return label === source.label.toLowerCase() || id === source.key.toLowerCase();
    });
    if (!match) {
      return `Last run: ${health.finished_at_utc ? _formatDateTime(health.finished_at_utc) : 'not yet run'}`;
    }
    const status = match.status || 'unknown';
    const count = Number.isFinite(Number(match.incoming)) ? `, ${Number(match.incoming)} found` : '';
    const added = Number.isFinite(Number(match.added)) ? `, ${Number(match.added)} added` : '';
    const error = match.error ? ` - ${match.error}` : '';
    return `Last run: ${status}${count}${added}${error}`;
  }

  function _formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'not yet run';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function _renderTagList(key) {
    const list = document.getElementById(`candidate-${key}-list`);
    if (list) list.innerHTML = _tagListHTML(key);
  }

  function _splitTags(value) {
    return String(value || '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }

  function _todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  function _nextBackupVersion(increment) {
    const today = _todayStamp();
    const key = 'jsc_backup_version';
    let info = {};
    try { info = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const current = info.date === today ? Number(info.version || 0) : 0;
    const next = current + 1;
    if (increment) localStorage.setItem(key, JSON.stringify({ date: today, version: next }));
    return next;
  }

  function _esc(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    render,
    saveProfile,
    saveParentEmails,
    saveGaugeGoals,
    saveApiKey,
    connectDrive,
    disconnectDrive,
    exportData,
    chooseBackupFile,
    restoreBackup,
    resetAll,
    toggleSection,
    handleTagKey,
    removeProfileTag,
    handleApifyTagKey,
    removeApifyTag,
    saveApifySettings,
    resetScoringWeight,
    saveJobSearchProfile,
    saveJobSources,
    toggleSourceKeyVisibility,
    __testHasCandidateProfileData: _hasCandidateProfileData,
    __testCollectData: _collectData,
  };
})();
