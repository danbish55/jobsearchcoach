/* Job Target Tracker — compact row layout with alumni scan */
const JobTargetTracker = (() => {
  const STORAGE_KEY    = 'job_target_tracker';
  const ALUMNI_CACHE   = 'jtt_alumni_cache';
  const CUSTOM_KEY     = 'jtt_custom_companies';
  let _activeTier      = 'all';
  let _scanningSet     = new Set(); // company names currently being scanned
  let _expandedSet     = new Set(); // alumni panels currently open
  let _chat            = [];

  // ── Hardcoded company list ────────────────────────────────────────────────

  const COMPANIES = {
    tier1: [
      { name: 'Google',            location: 'Venice / Playa Vista', note: 'L3 DA ~$162K total comp',              careers: 'https://careers.google.com',                     role: 'Data Analyst' },
      { name: 'Meta',              location: 'Playa Vista',          note: 'Strong MIS signal',                     careers: 'https://www.metacareers.com',                    role: 'Data Analyst' },
      { name: 'Snap',              location: 'Santa Monica',         note: 'Product analytics — psych minor fits',  careers: 'https://careers.snap.com',                       role: 'Product Analyst' },
      { name: 'Amazon',            location: 'Culver City',          note: 'Search BIE track',                      careers: 'https://www.amazon.jobs',                        role: 'Business Intelligence Engineer' },
      { name: 'Apple',             location: 'Culver City',          note: 'Lower volume, strong comp',             careers: 'https://jobs.apple.com',                         role: 'Data Analyst' },
      { name: 'TikTok / ByteDance',location: 'Culver City',          note: '~$152K avg total comp',                 careers: 'https://careers.tiktok.com',                     role: 'Data Analyst' },
      { name: 'Netflix',           location: 'Hollywood',            note: 'Data & Insights track',                 careers: 'https://jobs.netflix.com',                       role: 'Data Analyst' },
      { name: 'Hulu',              location: 'Santa Monica',         note: 'Disney umbrella — better entry comp',   careers: 'https://careers.hulu.com',                       role: 'Analytics' },
      { name: 'Deloitte S&A',      location: 'Downtown LA',          note: 'Strategy & Analytics practice only',    careers: 'https://jobs2.deloitte.com',                     role: 'Analytics Consultant' },
      { name: 'PwC Strategy&',     location: 'LA',                   note: 'Analytics track specifically',          careers: 'https://www.pwc.com/us/en/careers.html',         role: 'Analytics' },
      { name: 'EY Parthenon',      location: 'LA',                   note: 'Smaller cohort, high quality',          careers: 'https://www.ey.com/en_us/careers',               role: 'Analytics' },
      { name: 'KPMG Lighthouse',   location: 'LA',                   note: 'Data & Analytics practice',             careers: 'https://jobs.kpmg.us',                           role: 'Data Analytics' },
      { name: 'Accenture',         location: 'LA',                   note: 'Applied Intelligence practice',         careers: 'https://www.accenture.com/us-en/careers',        role: 'Data Analyst' },
      { name: 'SpaceX',            location: 'Hawthorne',            note: 'US citizenship is a real filter',       careers: 'https://www.spacex.com/careers',                 role: 'Data Analyst' },
      { name: 'Northrop Grumman',  location: 'El Segundo',           note: 'Citizenship advantage',                 careers: 'https://www.northropgrumman.com/careers',        role: 'Data Analyst' },
      { name: 'Boeing',            location: 'El Segundo',           note: 'Clearance-track roles',                 careers: 'https://jobs.boeing.com',                        role: 'Business Intelligence' },
      { name: 'Raytheon',          location: 'El Segundo',           note: 'Defense analytics',                     careers: 'https://careers.rtx.com',                        role: 'Data Analyst' },
      { name: 'ServiceTitan',      location: 'Glendale',             note: 'Strong enterprise SaaS data culture',   careers: 'https://www.servicetitan.com/careers',           role: 'Data Analyst' },
      { name: 'GoodRx',            location: 'Santa Monica',         note: 'Healthcare data — MIS fits well',       careers: 'https://www.goodrx.com/jobs',                    role: 'Data Analyst' },
      { name: 'Disney',            location: 'Burbank / Glendale',   note: '~$138K median — proper analytics track only', careers: 'https://jobs.disneycareers.com',          role: 'Data Analyst' },
    ],
    tier2: [
      { name: 'Kaiser Permanente', location: 'Pasadena / Downtown',  note: 'Healthcare analytics pays well',        careers: 'https://jobs.kaiserpermanente.org',              role: 'Data Analyst' },
      { name: 'Cedars-Sinai',      location: 'West Hollywood',       note: 'Near your apartment',                   careers: 'https://www.cedars-sinai.org/careers.html',     role: 'Analytics' },
      { name: 'Providence',        location: 'Burbank',              note: 'Healthcare system',                     careers: 'https://jobs.providence.org',                    role: 'Data Analyst' },
      { name: 'Capital Group',     location: 'Downtown / Irvine',    note: 'Investment analytics, strong comp',     careers: 'https://www.capitalgroup.com/individual/careers.html', role: 'Analytics' },
      { name: 'City National Bank',location: 'Downtown LA',          note: 'Financial services',                    careers: 'https://www.cnb.com/about-us/careers.html',     role: 'Data Analyst' },
      { name: 'Procore',           location: 'LA',                   note: 'Verify comp on Levels.fyi first',       careers: 'https://careers.procore.com',                    role: 'Data Analyst' },
    ],
    tier3: [
      { name: 'NBCUniversal',      location: 'Universal City',       note: 'Studio entry — prestige, below floor',  careers: 'https://www.nbcunicareers.com',                  role: 'Analytics' },
      { name: 'Warner Bros Discovery', location: 'Burbank',          note: 'Studio entry — prestige, below floor',  careers: 'https://careers.wbd.com',                        role: 'Data Analyst' },
      { name: 'Sony Pictures',     location: 'Culver City',          note: 'Studio entry — prestige, below floor',  careers: 'https://www.sonypictures.com/corp/careers.html', role: 'Analytics' },
      { name: 'LA Lakers',         location: 'El Segundo',           note: 'Underpaid — year 2–3 move',             careers: 'https://www.nba.com/lakers/careers',             role: 'Analytics' },
      { name: 'LA Dodgers',        location: 'Dodger Stadium',       note: 'Underpaid — year 2–3 move',             careers: 'https://www.mlb.com/dodgers/careers',            role: 'Analytics' },
      { name: 'LA Rams',           location: 'Inglewood',            note: 'Underpaid — year 2–3 move',             careers: 'https://www.therams.com/team/front-office/careers/', role: 'Analytics' },
    ],
  };

  const TIER_META = {
    tier1: { label: 'Tier 1', badge: '$115K+',      color: '#9D2235', desc: 'Apply here first and hardest' },
    tier2: { label: 'Tier 2', badge: '$100–115K',   color: '#f59e0b', desc: 'Viable with strong mobility story' },
    tier3: { label: 'Tier 3', badge: '$75–95K',     color: '#888',    desc: 'Info interviews and year 2–3 moves' },
  };

  const STATUSES = ['—', 'Researching', 'Applied', 'Interviewing', 'Closed'];
  const STATUS_COLORS = { '—': '', 'Researching': '#3b82f6', 'Applied': '#f59e0b', 'Interviewing': '#22c55e', 'Closed': '#6b7280' };

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _esc(str)     { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _escAttr(str) { return _esc(str).replace(/'/g,'&#39;'); }
  function _state()      { return Storage.get(STORAGE_KEY, {}); }
  function _save(state)  { Storage.set(STORAGE_KEY, state); }
  function _alumniCache(){ return Storage.get(ALUMNI_CACHE, {}); }
  function _saveAlumniCache(c){ Storage.set(ALUMNI_CACHE, c); }
  function _customCompanies(){ return Storage.get(CUSTOM_KEY, []); }
  function _apifyToken() { return 'APIFY_TOKEN_REMOVED'; }
  function _liCookie()   { return Storage.get('linkedin_li_at', ''); }

  function _allCompanies(tier) {
    const hardcoded = COMPANIES[tier] || [];
    const custom    = _customCompanies().filter(c => c.tier === tier);
    return [...hardcoded, ...custom];
  }

  function _linkedInUrl(name, role) {
    const p = new URLSearchParams({ keywords: `${name} ${role}`, location: 'Los Angeles, CA', f_TPR: 'r2592000' });
    return `https://www.linkedin.com/jobs/search/?${p}`;
  }

  function _timeAgo(ts) {
    if (!ts) return '';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs  < 24)  return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const el = document.getElementById('job-target-tracker-content');
    if (!el) return;
    el.innerHTML = `
      <style>
        .jtt-shell { max-width: 960px; margin: 0 auto; padding: 20px 16px; }
        .jtt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; }
        .jtt-title  { font-size: 22px; font-weight: 700; color: var(--text); }
        .jtt-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        .jtt-callout { background: rgba(157,34,53,0.07); border-left: 3px solid #9D2235; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

        .jtt-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
        .jtt-search  { flex: 1; min-width: 160px; max-width: 260px; padding: 7px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg); color: var(--text); font-size: 13px; }
        .jtt-filter  { padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; background: var(--card-bg); color: var(--text-muted); transition: all 140ms; }
        .jtt-filter:hover, .jtt-filter.active { border-color: #9D2235; color: #9D2235; background: rgba(157,34,53,0.07); }
        .jtt-no-cookie { padding: 10px 14px; background: rgba(245,158,11,0.1); border: 1px solid #f59e0b; border-radius: 8px; font-size: 12px; color: var(--text-muted); }
        .jtt-no-cookie a { color: #f59e0b; font-weight: 600; cursor: pointer; }

        .jtt-tier { margin-bottom: 24px; }
        .jtt-tier-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px 8px 0 0; border: 1px solid var(--border); background: var(--card-bg); }
        .jtt-tier-label  { font-size: 13px; font-weight: 700; color: var(--text); }
        .jtt-tier-badge  { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; color: #fff; }
        .jtt-tier-desc   { font-size: 12px; color: var(--text-muted); margin-left: auto; }

        .jtt-table  { border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
        .jtt-row    { display: grid; grid-template-columns: 3px 1fr 120px 80px 100px auto; align-items: center; gap: 0; border-bottom: 1px solid var(--border); background: var(--card-bg); transition: background 140ms; }
        .jtt-row:last-child { border-bottom: none; }
        .jtt-row:hover  { background: var(--card-hover); }
        .jtt-row.hidden { display: none; }
        .jtt-tier-stripe { align-self: stretch; min-height: 48px; }
        .jtt-row-main   { display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; min-width: 0; }
        .jtt-co-name    { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jtt-co-meta    { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jtt-co-location { padding: 10px 8px; font-size: 11px; color: var(--text-muted); }
        .jtt-co-status  { padding: 10px 8px; }
        .jtt-status-pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
        .jtt-co-actions { padding: 8px 10px 8px 4px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .jtt-btn        { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text-muted); cursor: pointer; white-space: nowrap; transition: all 140ms; text-decoration: none; display: inline-block; }
        .jtt-btn:hover  { border-color: var(--gold); color: var(--gold); }
        .jtt-btn.alumni { border-color: #0A66C2; color: #0A66C2; }
        .jtt-btn.alumni:hover { background: rgba(10,102,194,0.08); }
        .jtt-btn.alumni.scanning { opacity: 0.6; cursor: default; }
        .jtt-btn.warm   { background: rgba(34,197,94,0.12); border-color: #22c55e; color: #22c55e; }

        .jtt-alumni-panel { border-bottom: 1px solid var(--border); background: rgba(10,102,194,0.04); padding: 12px 14px 12px 20px; display: none; }
        .jtt-alumni-panel.open { display: block; }
        .jtt-alumni-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .jtt-alumni-title  { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0A66C2; }
        .jtt-alumni-meta   { font-size: 11px; color: var(--text-muted); margin-left: auto; }
        .jtt-alumni-rescan { font-size: 11px; color: #0A66C2; cursor: pointer; font-weight: 600; }
        .jtt-alumni-list   { display: flex; flex-direction: column; gap: 6px; }
        .jtt-alumni-person { display: flex; align-items: center; gap: 10px; font-size: 12px; }
        .jtt-alumni-name   { font-weight: 600; color: var(--text); }
        .jtt-alumni-hl     { color: var(--text-muted); font-size: 11px; }
        .jtt-alumni-school { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; color: #fff; flex-shrink: 0; }
        .jtt-alumni-school.usc { background: #9D2235; }
        .jtt-alumni-school.ua  { background: #003B73; }
        .jtt-alumni-link   { color: #0A66C2; text-decoration: none; font-size: 11px; flex-shrink: 0; }
        .jtt-alumni-link:hover { text-decoration: underline; }
        .jtt-alumni-empty  { font-size: 12px; color: var(--text-muted); font-style: italic; }

        .jtt-add-row { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-top: 1px dashed var(--border); flex-wrap: wrap; }
        .jtt-add-row input, .jtt-add-row select { padding: 5px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--card-bg); color: var(--text); font-size: 12px; }
        .jtt-add-row input { flex: 1; min-width: 100px; }

        .jtt-chat-card { margin-top: 24px; }
        .jtt-resources { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .jtt-resource  { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-muted); text-decoration: none; transition: all 140ms; }
        .jtt-resource:hover { border-color: var(--gold); color: var(--gold); }
      </style>

      <div class="jtt-shell">
        <div class="jtt-header">
          <div>
            <div class="jtt-title">Job Target Tracker</div>
            <div class="jtt-subtitle">LA-area targets sorted by realistic comp. Work Tier 1 first, hardest.</div>
          </div>
        </div>

        <div class="jtt-callout">70% of jobs are never publicly posted. Use alumni connections to create a warm path before applying cold.</div>

        ${_cookieWarningHTML()}

        <div class="jtt-resources">
          <a class="jtt-resource" href="https://www.levels.fyi/?compare=Google,Meta,Amazon&track=Data%20Analyst" target="_blank" rel="noopener">📊 Comp Research</a>
          <a class="jtt-resource" href="https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=Los%20Angeles%2C%20CA&f_E=2" target="_blank" rel="noopener">🔍 Active LA Listings</a>
          <a class="jtt-resource" href="https://www.glassdoor.com/Salaries/los-angeles-data-analyst-salary-SRCH_IL.0,11_IM508_KO12,24.htm" target="_blank" rel="noopener">💵 Glassdoor Salaries</a>
        </div>

        <div class="jtt-toolbar">
          <input id="jtt-search" class="jtt-search" type="text" placeholder="Search companies..." oninput="JobTargetTracker.applyFilters()">
          ${['all','tier1','tier2','tier3'].map((t,i) => `<button class="jtt-filter ${_activeTier===t?'active':''}" onclick="JobTargetTracker.filterTier('${t}')">${['All Tiers','Tier 1','Tier 2','Tier 3'][i]}</button>`).join('')}
        </div>

        ${Object.keys(COMPANIES).map(tier => _tierHTML(tier)).join('')}

        <div class="card jtt-chat-card">
          <div class="card-title">Ask About Your Target List</div>
          <div class="target-chat-messages" id="target-chat-messages"></div>
          <div class="target-chat-row">
            <input id="target-chat-input" type="text" placeholder="Ask about a company, tier, comp range..."
              onkeydown="if(event.key==='Enter') JobTargetTracker.sendChat()">
            <button class="btn btn-primary" id="target-chat-send" onclick="JobTargetTracker.sendChat()">Ask</button>
          </div>
        </div>
      </div>`;

    _renderChat();
    applyFilters();
  }

  function _cookieWarningHTML() {
    if (_liCookie()) return '';
    return `<div class="jtt-no-cookie">
      ⚠️ Alumni scanning requires your LinkedIn cookie.
      <a onclick="App.navigate('settings')">Add it in Settings → LinkedIn Alumni</a> to enable the Alumni button on each company.
    </div><br>`;
  }

  function _tierHTML(tier) {
    const meta      = TIER_META[tier];
    const companies = _allCompanies(tier);
    return `
      <div class="jtt-tier" id="jtt-${tier}" data-tier="${tier}">
        <div class="jtt-tier-header">
          <span class="jtt-tier-label">${meta.label}</span>
          <span class="jtt-tier-badge" style="background:${meta.color}">${meta.badge}</span>
          <span class="jtt-tier-desc">${meta.desc}</span>
        </div>
        <div class="jtt-table">
          ${companies.map(c => _rowHTML(c, tier)).join('')}
          ${_addRowHTML(tier)}
        </div>
      </div>`;
  }

  function _rowHTML(company, tier) {
    const state   = _state()[company.name] || {};
    const status  = state.status  || '—';
    const warm    = state.warm    || false;
    const cache   = _alumniCache()[company.name];
    const hasScan = cache && cache.alumni && cache.alumni.length > 0;
    const isScanning = _scanningSet.has(company.name);
    const isExpanded = _expandedSet.has(company.name);
    const color   = TIER_META[tier].color;
    const liUrl   = _linkedInUrl(company.name, company.role);
    const hasCookie = !!_liCookie();

    const statusColor = STATUS_COLORS[status] || '';
    const statusStyle = statusColor
      ? `background:${statusColor}20;border-color:${statusColor};color:${statusColor}`
      : 'background:var(--card-hover);border-color:var(--border);color:var(--text-muted)';

    const alumniCount = hasScan ? cache.alumni.length : '';
    const alumniLabel = isScanning ? '⏳ Scanning…'
      : hasScan      ? `👥 ${alumniCount} found`
      : '👥 Alumni';

    return `
      <div class="jtt-row" data-tier="${tier}" data-name="${_escAttr(company.name.toLowerCase())}" id="jtt-row-${_rowId(company.name)}">
        <div class="jtt-tier-stripe" style="background:${color}"></div>
        <div class="jtt-row-main">
          <div class="jtt-co-name">${_esc(company.name)}</div>
          <div class="jtt-co-meta">${_esc(company.note)}</div>
        </div>
        <div class="jtt-co-location">${_esc(company.location)}</div>
        <div class="jtt-co-status">
          <span class="jtt-status-pill" style="${statusStyle}"
            onclick="JobTargetTracker.cycleStatus('${_escAttr(company.name)}')"
            title="Click to change status">${_esc(status)}</span>
        </div>
        <div class="jtt-co-actions">
          ${hasCookie
            ? `<button class="jtt-btn alumni ${isScanning ? 'scanning' : ''}" ${isScanning ? 'disabled' : ''}
                onclick="JobTargetTracker.scanAlumni('${_escAttr(company.name)}')">${alumniLabel}</button>`
            : ''}
          <button class="jtt-btn ${warm ? 'warm' : ''}" onclick="JobTargetTracker.toggleWarm('${_escAttr(company.name)}')" title="${warm ? 'Warm path — click to clear' : 'Mark as warm path'}">
            ${warm ? '🔥 Warm' : '🤝'}
          </button>
          <a class="jtt-btn" href="${_escAttr(liUrl)}" target="_blank" rel="noopener" title="LinkedIn Jobs">LI</a>
          <a class="jtt-btn" href="${_escAttr(company.careers)}" target="_blank" rel="noopener" title="Careers page">Careers</a>
        </div>
      </div>
      <div class="jtt-alumni-panel ${isExpanded && hasScan ? 'open' : ''}" id="jtt-alumni-${_rowId(company.name)}">
        ${hasScan ? _alumniPanelInnerHTML(company.name, cache) : ''}
      </div>`;
  }

  function _rowId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  function _alumniPanelInnerHTML(name, cache) {
    const { alumni, ts, schools } = cache;
    const schoolLabel = (s) => {
      if (!s) return '';
      const sl = s.toLowerCase();
      if (sl.includes('marshall') || sl.includes('usc')) return '<span class="jtt-alumni-school usc">USC</span>';
      if (sl.includes('eller') || sl.includes('arizona')) return '<span class="jtt-alumni-school ua">UA</span>';
      return '';
    };
    return `
      <div class="jtt-alumni-header">
        <span class="jtt-alumni-title">Alumni at ${_esc(name)}</span>
        <span class="jtt-alumni-meta">Scanned ${_timeAgo(ts)}</span>
        <span class="jtt-alumni-rescan" onclick="JobTargetTracker.scanAlumni('${_escAttr(name)}')">↻ Rescan</span>
      </div>
      <div class="jtt-alumni-list">
        ${alumni.length === 0
          ? '<div class="jtt-alumni-empty">No recent USC/Eller alumni found at this company.</div>'
          : alumni.map(p => `
            <div class="jtt-alumni-person">
              ${schoolLabel(p.school)}
              <span class="jtt-alumni-name">${_esc(p.name)}</span>
              <span class="jtt-alumni-hl">${_esc(p.headline)}</span>
              ${p.profileUrl ? `<a class="jtt-alumni-link" href="${_escAttr(p.profileUrl)}" target="_blank" rel="noopener">View →</a>` : ''}
            </div>`).join('')}
      </div>`;
  }

  function _addRowHTML(tier) {
    return `
      <div class="jtt-add-row" id="jtt-add-${tier}">
        <input type="text"   id="jtt-add-name-${tier}"     placeholder="Company name">
        <input type="text"   id="jtt-add-location-${tier}" placeholder="Location (e.g. Santa Monica)">
        <input type="text"   id="jtt-add-careers-${tier}"  placeholder="Careers URL">
        <button class="btn btn-ghost btn-sm" onclick="JobTargetTracker.addCompany('${tier}')">+ Add</button>
      </div>`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function cycleStatus(name) {
    const state  = _state();
    const cur    = state[name]?.status || '—';
    const idx    = STATUSES.indexOf(cur);
    const next   = STATUSES[(idx + 1) % STATUSES.length];
    if (!state[name]) state[name] = {};
    state[name].status = next;
    _save(state);
    _refreshRow(name);
  }

  function toggleWarm(name) {
    const state = _state();
    if (!state[name]) state[name] = {};
    state[name].warm = !state[name].warm;
    _save(state);
    _refreshRow(name);
  }

  function _refreshRow(name) {
    // Find which tier this company belongs to and re-render just the row + alumni panel
    for (const tier of Object.keys(COMPANIES)) {
      const all = _allCompanies(tier);
      const co  = all.find(c => c.name === name);
      if (co) {
        const rowEl = document.getElementById(`jtt-row-${_rowId(name)}`);
        const panelEl = document.getElementById(`jtt-alumni-${_rowId(name)}`);
        if (!rowEl) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = _rowHTML(co, tier);
        rowEl.replaceWith(tmp.children[0]);
        if (panelEl) panelEl.replaceWith(tmp.children[0]);
        return;
      }
    }
  }

  function addCompany(tier) {
    const name     = document.getElementById(`jtt-add-name-${tier}`)?.value.trim();
    const location = document.getElementById(`jtt-add-location-${tier}`)?.value.trim();
    const careers  = document.getElementById(`jtt-add-careers-${tier}`)?.value.trim();
    if (!name) { UI.notify('Enter a company name', 'error'); return; }
    const custom = _customCompanies();
    if ([...Object.values(COMPANIES).flat(), ...custom].some(c => c.name.toLowerCase() === name.toLowerCase())) {
      UI.notify('That company is already on the list', 'error'); return;
    }
    custom.push({ name, location: location || 'LA', note: '', careers: careers || '', role: 'Data Analyst', tier });
    Storage.set(CUSTOM_KEY, custom);
    UI.notify(`${name} added to ${TIER_META[tier].label}`, 'success');
    render();
  }

  // ── Alumni scan ───────────────────────────────────────────────────────────

  async function scanAlumni(name) {
    if (_scanningSet.has(name)) return;
    const cookie = _liCookie();
    if (!cookie) { UI.notify('Add your LinkedIn cookie in Settings → LinkedIn Alumni first', 'error'); return; }

    _scanningSet.add(name);
    _expandedSet.add(name);
    _refreshRow(name);

    try {
      const startResp = await fetch('/api/apify/alumni/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: name, cookie, token: _apifyToken(), maxAlumni: 50 }),
      });
      const startData = await startResp.json();
      if (!startData.ok) throw new Error(startData.error || 'Failed to start scan');

      const { runId } = startData;
      const alumni = await _pollAlumni(runId);

      const cache = _alumniCache();
      cache[name] = { alumni, ts: Date.now(), schools: ['USC Marshall', 'UofA Eller'] };
      _saveAlumniCache(cache);
    } catch (err) {
      UI.notify(`Alumni scan failed: ${err.message}`, 'error');
    } finally {
      _scanningSet.delete(name);
      _refreshRow(name);
    }
  }

  async function _pollAlumni(runId, attempts = 0) {
    const token = _apifyToken();
    if (attempts > 60) throw new Error('Scan timed out after 5 minutes');
    await new Promise(r => setTimeout(r, 5000));
    const resp = await fetch(`/api/apify/alumni/poll?runId=${encodeURIComponent(runId)}&token=${encodeURIComponent(token)}`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Poll failed');
    if (data.status === 'running') return _pollAlumni(runId, attempts + 1);
    return data.alumni || [];
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  function filterTier(tier) {
    _activeTier = tier;
    document.querySelectorAll('.jtt-filter').forEach((btn, i) => {
      btn.classList.toggle('active', ['all','tier1','tier2','tier3'][i] === tier);
    });
    applyFilters();
  }

  function applyFilters() {
    const q = (document.getElementById('jtt-search')?.value || '').toLowerCase();
    document.querySelectorAll('.jtt-row').forEach(row => {
      const matchTier = _activeTier === 'all' || row.dataset.tier === _activeTier;
      const matchName = (row.dataset.name || '').includes(q);
      row.classList.toggle('hidden', !(matchTier && matchName));
      const id     = row.id.replace('jtt-row-', '');
      const panel  = document.getElementById(`jtt-alumni-${id}`);
      if (panel) panel.style.display = (matchTier && matchName && panel.classList.contains('open')) ? 'block' : (matchTier && matchName ? '' : 'none');
    });
    document.querySelectorAll('.jtt-tier').forEach(section => {
      const visible = [...section.querySelectorAll('.jtt-row:not(.hidden)')].length > 0;
      section.style.display = (_activeTier === 'all' || section.dataset.tier === _activeTier) && (visible || !q) ? '' : 'none';
    });
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function sendChat() {
    const input = document.getElementById('target-chat-input');
    const btn   = document.getElementById('target-chat-send');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    _chat.push({ role: 'user', content: text });
    ChatMemory.appendMessage('user', text, 'job-target-tracker');
    _renderChat(true);
    if (btn) btn.disabled = true;
    const fallback = 'Start with Tier 1 companies where the role title and compensation are most aligned. Pick one company, find two relevant roles, then look for a warm connection before applying.';
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Config.claudeModel(), max_tokens: 400, stream: false,
          system: `${Claude.buildSystemPrompt()}\n\nThe user is on the Job Target Tracker page. Answer specifically and briefly about company targeting, compensation, role search strategy, referrals, and next actions.`,
          messages: _chat.slice(-8),
        }),
      });
      const data  = await r.json();
      const reply = r.ok ? (data.content?.[0]?.text || fallback) : fallback;
      _chat.push({ role: 'assistant', content: reply });
      ChatMemory.appendMessage('assistant', reply, 'job-target-tracker');
    } catch {
      _chat.push({ role: 'assistant', content: fallback });
      ChatMemory.appendMessage('assistant', fallback, 'job-target-tracker');
    }
    if (btn) btn.disabled = false;
    _renderChat();
  }

  function _renderChat(loading = false) {
    const el = document.getElementById('target-chat-messages');
    if (!el) return;
    const starter = _chat.length ? '' : `<div class="target-chat-msg assistant">Ask me anything about these companies: comp ranges, culture, role titles, or how to approach a company you're unsure about.</div>`;
    el.innerHTML = starter + _chat.map(m => `<div class="target-chat-msg ${m.role}">${_esc(m.content)}</div>`).join('') +
      (loading ? '<div class="target-chat-msg assistant thinking">Thinking…</div>' : '');
    el.scrollTop = el.scrollHeight;
  }

  return { render, cycleStatus, toggleWarm, addCompany, scanAlumni, filterTier, applyFilters, sendChat };
})();
