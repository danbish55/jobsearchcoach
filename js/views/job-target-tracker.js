/* Job Target Tracker view */
const JobTargetTracker = (() => {
  const STORAGE_KEY = 'job_target_tracker';
  let _activeTier = 'all';
  let _chat = [];

  const COMPANIES = {
    tier1: [
      ['Google', 'Venice / Playa Vista', 'L3 DA ~$162K total comp', 'https://careers.google.com', 'Data Analyst'],
      ['Meta', 'Playa Vista', 'Strong MIS signal', 'https://www.metacareers.com', 'Data Analyst'],
      ['Snap', 'Santa Monica', 'Product analytics - psych minor fits', 'https://careers.snap.com', 'Product Analyst'],
      ['Amazon', 'Culver City', 'Search Business Intelligence Engineer', 'https://www.amazon.jobs', 'Business Intelligence Engineer'],
      ['Apple', 'Culver City', 'Lower volume, strong comp', 'https://jobs.apple.com', 'Data Analyst'],
      ['TikTok / ByteDance', 'Culver City', '~$152K avg total comp', 'https://careers.tiktok.com', 'Data Analyst'],
      ['Netflix', 'Hollywood', 'Data & Insights track', 'https://jobs.netflix.com', 'Data Analyst'],
      ['Hulu', 'Santa Monica', 'Disney umbrella - better entry comp', 'https://careers.hulu.com', 'Analytics'],
      ['Deloitte S&A', 'Downtown LA', 'Strategy & Analytics practice only', 'https://jobs2.deloitte.com', 'Analytics Consultant'],
      ['PwC Strategy&', 'LA', 'Analytics track specifically', 'https://www.pwc.com/us/en/careers.html', 'Analytics'],
      ['EY Parthenon', 'LA', 'Smaller cohort, high quality', 'https://www.ey.com/en_us/careers', 'Analytics'],
      ['KPMG Lighthouse', 'LA', 'Data & Analytics practice', 'https://jobs.kpmg.us', 'Data Analytics'],
      ['Accenture', 'LA', 'Applied Intelligence practice', 'https://www.accenture.com/us-en/careers', 'Data Analyst'],
      ['SpaceX', 'Hawthorne', 'US citizenship is a real filter', 'https://www.spacex.com/careers', 'Data Analyst'],
      ['Northrop Grumman', 'El Segundo', 'Citizenship advantage', 'https://www.northropgrumman.com/careers', 'Data Analyst'],
      ['Boeing', 'El Segundo', 'Clearance-track roles', 'https://jobs.boeing.com', 'Business Intelligence'],
      ['Raytheon', 'El Segundo', 'Defense analytics', 'https://careers.rtx.com', 'Data Analyst'],
      ['ServiceTitan', 'Glendale', 'Strong enterprise SaaS data culture', 'https://www.servicetitan.com/careers', 'Data Analyst'],
      ['GoodRx', 'Santa Monica', 'Healthcare data - MIS fits well', 'https://www.goodrx.com/jobs', 'Data Analyst'],
      ['Disney', 'Burbank / Glendale', '~$138K total comp median - proper track only', 'https://jobs.disneycareers.com', 'Data Analyst'],
    ],
    tier2: [
      ['Big 4 General Analyst', 'LA', 'Not S&A premium - watch comp', 'https://jobs2.deloitte.com', 'Analyst'],
      ['Kaiser Permanente', 'Pasadena / Downtown', 'Healthcare analytics pays well', 'https://jobs.kaiserpermanente.org', 'Data Analyst'],
      ['Cedars-Sinai', 'West Hollywood', 'Near your apartment', 'https://www.cedars-sinai.org/careers.html', 'Analytics'],
      ['Providence', 'Burbank', 'Healthcare system', 'https://jobs.providence.org', 'Data Analyst'],
      ['Capital Group', 'Downtown / Irvine', 'Investment analytics, strong comp', 'https://www.capitalgroup.com/individual/careers.html', 'Analytics'],
      ['City National Bank', 'Downtown LA', 'Financial services', 'https://www.cnb.com/about-us/careers.html', 'Data Analyst'],
      ['Procore', 'LA', 'Verify comp on Levels.fyi first', 'https://careers.procore.com', 'Data Analyst'],
    ],
    tier3: [
      ['NBCUniversal', 'Universal City', 'Studio entry - prestige, below floor', 'https://www.nbcunicareers.com', 'Analytics'],
      ['Warner Bros Discovery', 'Burbank', 'Studio entry - prestige, below floor', 'https://careers.wbd.com', 'Data Analyst'],
      ['Sony Pictures', 'Culver City', 'Studio entry - prestige, below floor', 'https://www.sonypictures.com/corp/careers.html', 'Analytics'],
      ['LA Lakers', 'El Segundo', 'Famously underpaid - year 2-3 move', 'https://www.nba.com/lakers/careers', 'Analytics'],
      ['LA Dodgers', 'Dodger Stadium', 'Famously underpaid - year 2-3 move', 'https://www.mlb.com/dodgers/careers', 'Analytics'],
      ['LA Rams', 'Inglewood', 'Famously underpaid - year 2-3 move', 'https://www.therams.com/team/front-office/careers/', 'Analytics'],
    ],
  };

  function render() {
    const el = document.getElementById('job-target-tracker-content');
    if (!el) return;
    el.innerHTML = `
      <div class="target-shell">
        <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">Back to Dashboard</button>
        <div class="target-header">
          <div>
            <div class="target-title">Job Target Tracker</div>
            <p>Your curated target list sorted by realistic comp band. Work through Tier 1 first, then use alumni and LinkedIn searches to create warm paths into the companies.</p>
            <div class="target-callout">70% of jobs are never publicly posted. Use the links to find open roles, then use your network to get a referral.</div>
          </div>
        </div>
        ${_resourcesHTML()}
        <div class="target-toolbar">
          <input id="target-search" type="text" placeholder="Search companies..." oninput="JobTargetTracker.applyFilters()">
          ${_filterButton('all', 'All Tiers')}
          ${_filterButton('tier1', 'Tier 1 Only')}
          ${_filterButton('tier2', 'Tier 2 Only')}
          ${_filterButton('tier3', 'Tier 3 Only')}
        </div>
        ${_tierHTML('tier1', 'Tier 1', '$115K+ likely', 'Clears your comfort floor confidently - apply here first and hardest')}
        ${_tierHTML('tier2', 'Tier 2', '$100-115K', 'At or near floor - viable with strong mobility story')}
        ${_tierHTML('tier3', 'Tier 3', '$75-95K typical', 'Informational interviews and year 2-3 moves only')}
        <div class="card target-chat-card">
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

  function _filterButton(tier, label) {
    return `<button class="target-filter ${_activeTier === tier ? 'active' : ''}" onclick="JobTargetTracker.filterTier('${tier}')">${label}</button>`;
  }

  function _resourcesHTML() {
    const links = [
      { icon: '🔗', label: 'Comp Research', url: 'https://www.levels.fyi/?compare=Google,Meta,Amazon&track=Data%20Analyst' },
      { icon: '🔗', label: 'Active LA Listings', url: 'https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=Los%20Angeles%2C%20CA&f_E=2' },
      { icon: '🔗', label: 'Glassdoor Salaries', url: 'https://www.glassdoor.com/Salaries/los-angeles-data-analyst-salary-SRCH_IL.0,11_IM508_KO12,24.htm' },
    ];
    return `<div class="target-resources" data-resource-section>
      <div class="resource-section-header"><span>Resources</span></div>
      <div class="resource-card-row">
        ${links.map(link => `
          <a class="resource-card" href="${_escAttr(link.url)}" target="_blank" rel="noopener noreferrer" title="${_escAttr(link.url)}">
            <span class="resource-card-icon">${_esc(link.icon)}</span>
            <span class="resource-card-label">${_esc(link.label)}</span>
          </a>
        `).join('')}
      </div>
    </div>`;
  }

  function _tierHTML(tier, label, badge, desc) {
    return `<section class="target-tier ${tier}" id="target-${tier}">
      <div class="target-tier-label">
        <h2>${label}</h2>
        <span>${badge}</span>
        <p>${desc}</p>
      </div>
      <div class="target-company-grid">
        ${COMPANIES[tier].map(c => _cardHTML({ name: c[0], location: c[1], note: c[2], careers: c[3], li: c[4] }, tier)).join('')}
      </div>
    </section>`;
  }

  function _cardHTML(company, tier) {
    const state = _state()[company.name] || { notes: '' };
    const liUrl = _linkedInUrl(company.name, company.li);
    return `<div class="target-company-card" data-tier="${tier}" data-name="${_esc(company.name.toLowerCase())}">
      <div class="target-company-info">
        <div class="target-company-name">${_esc(company.name)}</div>
        <div class="target-company-meta">${_esc(company.location)}</div>
        <div class="target-company-note">${_esc(company.note)}</div>
      </div>
      <input class="target-notes-input" type="text" value="${_esc(state.notes || '')}" placeholder="Notes: role, contact, next step..."
        onblur="JobTargetTracker.updateNotes('${_escAttr(company.name)}', this.value)">
      <div class="target-search-links">
        <a class="target-search-link linkedin" href="${liUrl}" target="_blank" rel="noopener">LinkedIn Jobs</a>
        <a class="target-search-link careers" href="${company.careers}" target="_blank" rel="noopener">Careers Page</a>
      </div>
    </div>`;
  }

  function _state() {
    return Storage.get(STORAGE_KEY, {});
  }

  function _save(state) {
    Storage.set(STORAGE_KEY, state);
  }

  function updateNotes(key, value) {
    const state = _state();
    if (!state[key]) state[key] = {};
    state[key].notes = value;
    _save(state);
  }

  function filterTier(tier) {
    _activeTier = tier;
    document.querySelectorAll('.target-filter').forEach(btn => btn.classList.remove('active'));
    const buttons = [...document.querySelectorAll('.target-filter')];
    const idx = ['all', 'tier1', 'tier2', 'tier3'].indexOf(tier);
    if (buttons[idx]) buttons[idx].classList.add('active');
    applyFilters();
  }

  function applyFilters() {
    const q = (document.getElementById('target-search')?.value || '').toLowerCase();
    document.querySelectorAll('.target-company-card').forEach(card => {
      const matchTier = _activeTier === 'all' || card.dataset.tier === _activeTier;
      const matchName = (card.dataset.name || '').includes(q);
      card.style.display = matchTier && matchName ? '' : 'none';
    });
    document.querySelectorAll('.target-tier').forEach(section => {
      const visible = [...section.querySelectorAll('.target-company-card')].some(card => card.style.display !== 'none');
      section.style.display = visible ? '' : 'none';
    });
  }

  async function sendChat() {
    const input = document.getElementById('target-chat-input');
    const btn = document.getElementById('target-chat-send');
    const text = input?.value.trim();
    if (!text) return;

    input.value = '';
    _chat.push({ role: 'user', content: text });
    _renderChat(true);
    if (btn) btn.disabled = true;

    const fallback = 'Start with Tier 1 companies where the role title and compensation are most aligned. Pick one company, find two relevant roles, then look for a warm connection before applying.';
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Config.claudeModel(),
          max_tokens: 400,
          stream: false,
          system: 'You are a focused job search coach. The user is on the Job Target Tracker page. Answer specifically and briefly about company targeting, compensation, role search strategy, referrals, and next actions.',
          messages: _chat.slice(-8),
        }),
      });
      if (!r.ok) throw new Error('coach unavailable');
      const data = await r.json();
      _chat.push({ role: 'assistant', content: data.content?.[0]?.text || fallback });
    } catch {
      _chat.push({ role: 'assistant', content: fallback });
    }

    if (btn) btn.disabled = false;
    _renderChat();
  }

  function _renderChat(loading = false) {
    const el = document.getElementById('target-chat-messages');
    if (!el) return;
    const starter = _chat.length ? '' : `<div class="target-chat-msg assistant">Ask me anything about these companies: comp ranges, culture, role titles, or how to approach a company you're unsure about.</div>`;
    el.innerHTML = starter + _chat.map(m => `<div class="target-chat-msg ${m.role}">${_esc(m.content)}</div>`).join('') +
      (loading ? '<div class="target-chat-msg assistant thinking">Thinking...</div>' : '');
    el.scrollTop = el.scrollHeight;
  }

  function _linkedInUrl(company, role) {
    const params = new URLSearchParams({ keywords: `${company} ${role}`, location: 'Los Angeles, CA', f_TPR: 'r2592000' });
    return `https://www.linkedin.com/jobs/search/?${params}`;
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(str) {
    return _esc(str).replace(/'/g, '&#39;');
  }

  return { render, updateNotes, filterTier, applyFilters, sendChat };
})();
