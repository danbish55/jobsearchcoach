/* Job Leads view */
const JobLeads = (() => {
  const SOURCE_LABELS = {
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    usajobs: 'USAJOBS',
    adzuna: 'Adzuna',
    indeed_rss: 'Indeed RSS',
    the_muse: 'The Muse',
    built_in_la: 'Built In LA',
    manual: 'Added Manually',
  };
  const STATE_ABBREVIATIONS = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
    missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
    'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
    texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
    'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
  };
  const COUNTY_STATE_HINTS = {
    'los angeles county': 'CA',
    'orange county': 'CA',
    'san diego county': 'CA',
    'riverside county': 'CA',
    'ventura county': 'CA',
    'tarrant county': 'TX',
    'dallas county': 'TX',
    'travis county': 'TX',
    'king county': 'WA',
    'pierce county': 'WA',
    'multnomah county': 'OR',
    'washington county': 'OR',
    'denver county': 'CO',
    'boulder county': 'CO',
    'salt lake county': 'UT',
    'clark county': 'NV',
  };

  let _leads = [];
  let _health = null;
  let _loading = false;
  let _running = false;
  let _error = '';
  let _tierFilter = 'all';
  let _stateFilter = 'all';
  let _sourceFilter = 'all';
  let _siteFilter = 'all';
  let _searchQuery = '';
  let _searchDebounceTimer = null;
  let _filteredLeadsCache = null;
  let _filteredLeadsCacheKey = '';
  let _sortKey = 'score';
  let _sortDirection = 'desc';
  let _lastLoadedAt = '';
  const _transitioning = new Set();
  const _actionErrors = {};
  let _activeApplyLeadId = '';

  function render() {
    _ensureStyles();
    const container = document.getElementById('leads-content');
    if (!container) return;

    container.innerHTML = `
      <div class="job-leads-page">
        <div class="job-leads-header">
          <div>
            <div class="view-title">Job Leads</div>
            <div class="view-subtitle">Review scored job leads from JobLeadsTool.</div>
            <div class="job-leads-health">${_healthSummary()}</div>
          </div>
          <button id="job-leads-refresh-btn" class="btn btn-primary btn-sm" onclick="JobLeads.refresh()" ${_loading || _running ? 'disabled' : ''}>
            ${_running ? 'Reloading...' : 'Reload'}
          </button>
          <button class="btn btn-primary btn-sm job-leads-manual-btn" onclick="JobLeads.openManualJobModal()" ${_loading || _running ? 'disabled' : ''}>
            ＋ Add Job Manually
          </button>
        </div>

        ${_pendingApplyBannerHTML()}

        <div class="job-leads-filter-row">
          <label>
            Tier
            <select id="job-leads-tier-filter" onchange="JobLeads.setTierFilter(this.value)">
              ${_option('all', 'All', _tierFilter)}
              ${_option('tier_1', 'Tier 1', _tierFilter)}
              ${_option('tier_2', 'Tier 2', _tierFilter)}
              ${_option('tier_3', 'Tier 3', _tierFilter)}
            </select>
          </label>
          <label>
            Status
            <select id="job-leads-state-filter" onchange="JobLeads.setStateFilter(this.value)">
              ${_option('all', 'All', _stateFilter)}
              ${_option('pending_review', 'Pending', _stateFilter)}
              ${_option('approved', 'Approved', _stateFilter)}
              ${_option('rejected', 'Rejected', _stateFilter)}
              ${_option('applied', 'Applied', _stateFilter)}
            </select>
          </label>
          <label>
            Source
            <select id="job-leads-source-filter" onchange="JobLeads.setSourceFilter(this.value)">
              ${_sourceFilterOptionsHTML()}
            </select>
          </label>
          <label>
            Site
            <select id="job-leads-site-filter" onchange="JobLeads.setSiteFilter(this.value)">
              ${_option('all', 'All', _siteFilter)}
              ${_option('remote', 'Remote', _siteFilter)}
              ${_option('hybrid', 'Hybrid', _siteFilter)}
              ${_option('on-site', 'On-site', _siteFilter)}
            </select>
          </label>
          <label class="job-leads-search-label">
            Search
            <input
              id="job-leads-search"
              type="search"
              placeholder="Search company, role, location..."
              value="${_escAttr(_searchQuery)}"
              oninput="JobLeads.setSearchQuery(this.value)"
              onkeydown="JobLeads.handleSearchKeydown(event, this.value)"
            >
          </label>
          <div class="job-leads-count">${_filteredLeads().length} of ${_leads.length} leads</div>
        </div>

        <div class="job-leads-list" role="table" aria-label="Job leads">
          <div class="job-leads-row job-leads-row-head" role="row">
            ${_sortHeaderHTML('score', 'Score')}
            ${_sortHeaderHTML('company', 'Company')}
            ${_sortHeaderHTML('role', 'Role')}
            ${_sortHeaderHTML('city', 'City/ST')}
            ${_sortHeaderHTML('level', 'Level / Type')}
            ${_sortHeaderHTML('salary', 'Salary')}
            ${_sortHeaderHTML('posted', 'Posted')}
            <div>Actions / Source</div>
          </div>
          <div id="job-leads-body" class="job-leads-body-scroll">
            ${_bodyHTML()}
          </div>
        </div>
      </div>`;

    if (!_loading && !_running && !_error && !_leads.length) {
      load();
    }
  }

  async function load() {
    _loading = true;
    _error = '';
    _renderBodyOnly();
    try {
      const [leads, health] = await Promise.all([
        _fetchJSON('/api/jl-output?view=scored'),
        _fetchJSON('/api/jl-output?view=health').catch(() => null),
      ]);
      _leads = _normalizeLeads(leads);
      _invalidateLeadFilters();
      _health = health;
      _lastLoadedAt = new Date().toISOString();
    } catch (err) {
      _error = err.message || 'Unknown error';
    } finally {
      _loading = false;
      render();
    }
  }

  async function refresh() {
    _running = true;
    _error = '';
    render();
    try {
      const result = await _fetchJSON('/api/jl/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (result.success === false) {
        throw new Error(result.error || 'Refresh failed');
      }
      await load();
    } catch (err) {
      _error = err.message || 'Refresh failed';
      _running = false;
      render();
      return;
    }
    _running = false;
    render();
  }

  function _invalidateLeadFilters() {
    _filteredLeadsCache = null;
    _filteredLeadsCacheKey = '';
  }

  function _filterCacheKey() {
    return [
      _tierFilter,
      _stateFilter,
      _sourceFilter,
      _siteFilter,
      _searchQuery,
      _sortKey,
      _sortDirection,
      _leads.length,
    ].join('|');
  }

  function setTierFilter(value) {
    _tierFilter = value || 'all';
    _invalidateLeadFilters();
    _renderBodyOnly();
    _updateCount();
  }

  function setStateFilter(value) {
    _stateFilter = value || 'all';
    _invalidateLeadFilters();
    _renderBodyOnly();
    _updateCount();
  }

  function setSourceFilter(value) {
    _sourceFilter = value || 'all';
    _invalidateLeadFilters();
    _renderBodyOnly();
    _updateCount();
  }

  function setSiteFilter(value) {
    _siteFilter = value || 'all';
    _invalidateLeadFilters();
    _renderBodyOnly();
    _updateCount();
  }

  function setSearchQuery(value) {
    _searchQuery = String(value || '');
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      _invalidateLeadFilters();
      _renderBodyOnly();
      _updateCount();
    }, 200);
  }

  function handleSearchKeydown(event, value) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    clearTimeout(_searchDebounceTimer);
    _searchQuery = String(value || '');
    _invalidateLeadFilters();
    _renderBodyOnly();
    _updateCount();
  }

  function setSort(key) {
    if (_sortKey === key) {
      _sortDirection = _sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      _sortKey = key;
      _sortDirection = key === 'score' || key === 'posted' ? 'desc' : 'asc';
    }
    _invalidateLeadFilters();
    _renderBodyOnly();
  }

  function openJob(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // USC networking helper: two tiers of ToS-compliant searches and warm-intro paths.
  // Tier A: pre-filtered LinkedIn/Google searches. Tier B: official USC alumni channels.
  // We only construct URLs the user clicks — nothing is scraped or stored.
  const _USC_SCHOOL = 'University of Southern California';
  const _USC_ALUMNI_URL = 'https://www.linkedin.com/school/university-of-southern-california/people/';
  const _USC_TROJAN_NETWORK = 'https://careers.usc.edu/experiences/trojan-network-find-a-mentor/';
  const _USC_CONNECTSC = 'https://usc.joinhandshake.com/';
  const _USC_ALUMNI_ASSOC = 'https://alumni.usc.edu/';
  const _USC_MARSHALL_LI_GROUP = 'https://www.linkedin.com/groups/25827/';

  function findUscConnections(company) {
    const name = String(company || '').trim();
    if (!name) return;
    // School alumni page with company keyword pre-loaded — searches *within* USC
    // alumni for the company name. Much stronger than the general people search.
    const alumniFiltered = `${_USC_ALUMNI_URL}?keywords=${encodeURIComponent(name)}`;
    // Broad LinkedIn search as a fallback — quoted terms tighten matching
    const peopleSearch = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`”${name}” “University of Southern California”`)}&origin=GLOBAL_SEARCH_HEADER`;
    // Google dork — current employees
    const googleCurrent = `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in “${name}” “University of Southern California”`)}`;
    // Google dork — alumni who've moved on (catches past employees too)
    const googleAlumni = `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in “USC” OR “University of Southern California” “${name}”`)}`;
    const handshakeSearch = `${_USC_CONNECTSC}employers/${encodeURIComponent(name)}`;

    const body = `
      <div class=”job-lead-usc-modal”>
        <div class=”job-lead-usc-section”>
          <div class=”job-lead-usc-section-label”>Tier A &mdash; Find USC Trojans at ${_esc(name)}</div>
          <p class=”job-lead-usc-intro”>These open pre-filtered searches directly on LinkedIn and Google — nothing is scraped or stored.</p>
          <a class=”btn btn-primary job-lead-usc-link” href=”${_escAttr(alumniFiltered)}” target=”_blank” rel=”noopener noreferrer”>
            🎓 USC Alumni — filtered to “${_esc(name)}” <span class=”job-lead-usc-hint”>Searches within USC alumni for this company — most precise</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(peopleSearch)}” target=”_blank” rel=”noopener noreferrer”>
            🔍 LinkedIn people search — ${_esc(name)} + USC <span class=”job-lead-usc-hint”>Broader search; catches mentions of USC outside the education field</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(googleCurrent)}” target=”_blank” rel=”noopener noreferrer”>
            🌐 Google — current USC employees at ${_esc(name)} <span class=”job-lead-usc-hint”>Indexes public LinkedIn profiles; often finds people LinkedIn search misses</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(googleAlumni)}” target=”_blank” rel=”noopener noreferrer”>
            🌐 Google — USC alumni (current &amp; past) at ${_esc(name)} <span class=”job-lead-usc-hint”>Casts a wider net — includes people who've since left the company</span>
          </a>
        </div>

        <div class=”job-lead-usc-divider”></div>

        <div class=”job-lead-usc-section”>
          <div class=”job-lead-usc-section-label”>Tier B &mdash; Warm Intro Paths</div>
          <p class=”job-lead-usc-intro”>USC's official channels let you request intros from alumni who <em>opted in</em> to help recent grads. A warm intro from here beats a cold LinkedIn message by a wide margin.</p>
          <a class=”btn job-lead-usc-link job-lead-usc-trojan-btn” href=”${_escAttr(_USC_TROJAN_NETWORK)}” target=”_blank” rel=”noopener noreferrer”>
            🤝 Trojan Network &mdash; Find a USC Mentor <span class=”job-lead-usc-hint”>(search by industry, then filter for ${_esc(name)} or its sector)</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(handshakeSearch)}” target=”_blank” rel=”noopener noreferrer”>
            🎯 connectSC / Handshake &mdash; ${_esc(name)} <span class=”job-lead-usc-hint”>(USC's career platform — events, alumni contacts, and job postings at this employer)</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(_USC_MARSHALL_LI_GROUP)}” target=”_blank” rel=”noopener noreferrer”>
            👥 USC Marshall Alumni LinkedIn Group <span class=”job-lead-usc-hint”>(post asking if anyone works at ${_esc(name)} — alumni in this group opted in to help)</span>
          </a>
          <a class=”btn btn-ghost job-lead-usc-link” href=”${_escAttr(_USC_ALUMNI_ASSOC)}” target=”_blank” rel=”noopener noreferrer”>
            🏛️ USC Alumni Association <span class=”job-lead-usc-hint”>(Trojan Directory search — searchable alumni database by company and industry)</span>
          </a>
        </div>
      </div>`;

    UI.showModal(`USC connections — ${_esc(name)}`, body, [
      { id: 'usc-close', label: 'Close', class: 'btn-ghost' },
    ]);
    document.querySelector('#active-modal .modal')?.classList.add('job-lead-usc-shell');
  }

  function openManualJobModal() {
    const body = `
      <div class="job-lead-manual-modal">
        <div class="job-lead-manual-tip">
          Tip: Have the job posting open in your browser. Paste the URL above and click Submit — we'll try to fetch it automatically. If you see an error, just copy everything on the job page and paste it into the Job Description box below.
        </div>
        <div id="job-lead-manual-error" class="job-lead-manual-error hidden"></div>
        <label class="job-lead-manual-field">
          <span>Job Posting URL</span>
          <input id="manual-job-url" type="url" placeholder="Paste the URL from your browser address bar">
        </label>
        <label class="job-lead-manual-field">
          <span>Job Description (paste if URL doesn't work)</span>
          <textarea id="manual-job-raw-text" rows="8" placeholder="If the page couldn't be fetched automatically, paste the full job description text here including title, company, location, and requirements"></textarea>
        </label>
        <label class="job-lead-manual-field">
          <span>Job Title <em>(optional override)</em></span>
          <input id="manual-job-title" type="text">
        </label>
        <label class="job-lead-manual-field">
          <span>Company Name <em>(optional override)</em></span>
          <input id="manual-job-company" type="text">
        </label>
        <label class="job-lead-manual-field">
          <span>Location <em>(optional override)</em></span>
          <input id="manual-job-location" type="text">
        </label>
      </div>`;
    UI.showModal('Add Job Manually', body, [
      { id: 'submit-manual-job', label: 'Submit', class: 'btn-primary', close: false, action: () => submitManualJob() },
      { id: 'cancel-manual-job', label: 'Cancel', class: 'btn-ghost' },
    ]);
    document.querySelector('#active-modal .modal')?.classList.add('job-lead-manual-shell');
  }

  async function submitManualJob() {
    const button = document.getElementById('modal-btn-submit-manual-job');
    const error = document.getElementById('job-lead-manual-error');
    const payload = {
      url: document.getElementById('manual-job-url')?.value?.trim() || '',
      raw_text: document.getElementById('manual-job-raw-text')?.value?.trim() || '',
      title: document.getElementById('manual-job-title')?.value?.trim() || '',
      company: document.getElementById('manual-job-company')?.value?.trim() || '',
      location: document.getElementById('manual-job-location')?.value?.trim() || '',
    };
    if (error) {
      error.textContent = '';
      error.classList.add('hidden');
    }
    if (!payload.url && !payload.raw_text) {
      _setManualJobError('Paste a job URL or paste the job description text.');
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting...';
    }
    try {
      const result = await _fetchJSON('/api/jl/add-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result.success === false) throw new Error(result.error || 'Could not add manual job.');
      UI.closeModal();
      await load();
      UI.notify('Manual job added to leads.', 'success');
    } catch (err) {
      _setManualJobError(err.message || 'Could not add manual job.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Submit';
      }
    }
  }

  function _setManualJobError(message) {
    const error = document.getElementById('job-lead-manual-error');
    if (!error) return;
    error.textContent = `${message} You can keep this window open, paste the posting text below, and click Submit again.`;
    error.classList.remove('hidden');
  }

  async function applyLead(leadId) {
    const item = _leads.find(candidate => _leadId(candidate) === leadId);
    if (!item) return;
    const lead = item.lead || item;

    openJob(lead.url || '');
    try {
      await _copyText(_profileClipboardText());
      UI.notify('Profile info copied to clipboard', 'success');
    } catch {
      UI.notify('Could not copy profile info automatically', 'error');
    }
    _showApplyModal(item);
  }

  async function approveLead(leadId) {
    await _transitionLead(leadId, 'approved');
  }

  async function rejectLead(leadId) {
    await _transitionLead(leadId, 'rejected');
  }

  async function deleteLead(leadId) {
    const index = _leads.findIndex(item => _leadId(item) === leadId);
    if (index < 0 || _transitioning.has(leadId)) return;

    const lead = _leads[index].lead || _leads[index];
    const label = `${lead.title || lead.role || 'this role'} at ${lead.company || 'this company'}`;
    if (!confirm(`Delete ${label} from Job Leads? This hides it from future JL refreshes too.`)) return;

    const previousItem = _leads[index];
    delete _actionErrors[leadId];
    _transitioning.add(leadId);
    _leads.splice(index, 1);
    _renderBodyOnly();
    _updateCount();

    try {
      await _fetchJSON('/api/jl/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      UI.notify('Job lead deleted.', 'success');
    } catch (err) {
      _leads.splice(index, 0, previousItem);
      _actionErrors[leadId] = err.message || 'Could not delete this lead.';
    } finally {
      _transitioning.delete(leadId);
      _renderBodyOnly();
      _updateCount();
    }
  }

  function _bodyHTML() {
    if (_loading || _running) {
      return `<div class="card job-leads-loading">
        <div class="job-leads-spinner"></div>
        <div>${_running ? 'Running JobLeadsTool cycle... Please be patient - this takes a while.' : 'Loading job leads...'}</div>
      </div>`;
    }

    if (_error) {
      return `<div class="card job-leads-error">
        <div>Could not load leads. ${_esc(_error)}.</div>
        <button class="btn btn-primary btn-sm" onclick="JobLeads.load()">Retry</button>
      </div>`;
    }

    const leads = _filteredLeads();
    if (!leads.length) {
      return `<div class="empty-state">
        <div class="empty-state-icon">JL</div>
        <div class="empty-state-text">No leads yet.<br>Click Refresh Job Leads to fetch the latest listings.</div>
      </div>`;
    }

    return leads.map(_leadCardHTML).join('');
  }

  function _leadCardHTML(item, index) {
    const lead = item.lead || item;
    const leadId = _leadId(item);
    const score = _score(item);
    const tier = item.tier || _tierFromScore(score);
    const state = _leadState(item);
    const source = _displaySource(lead.source || item.source || 'JL');
    const role = lead.title || lead.role || 'Untitled role';
    const company = lead.company || 'Unknown company';
    const city = _cityFromLocation(lead.location);
    const description = _truncate(_plainText(lead.description), 190);
    return `
      <article class="card job-lead-card job-leads-row ${index % 2 ? 'alternate' : ''}" data-lead-id="${_escAttr(leadId)}" role="row">
        <div class="job-lead-score-cell" role="cell">
          <div class="job-lead-score-row">
            <span class="job-lead-score ${_tierClass(tier)}">${score}</span>
            ${_redFlagHTML(item)}
          </div>
          <span class="job-lead-pill ${_stateClass(state)}">${_stateLabel(state)}</span>
        </div>
        <div class="job-lead-company" role="cell">${_esc(company)}</div>
        <div class="job-lead-role-cell" role="cell">
          <div class="job-lead-role">${_esc(role)}</div>
          <div class="job-lead-description">${description ? _esc(description) : _esc(source)}</div>
        </div>
        <div class="job-lead-city" role="cell">${_cityCellHTML(lead.location, city)}</div>
        <div class="job-lead-level" role="cell">
          <div><strong>Level:</strong> ${_esc(_displayLevel(lead))}</div>
          <div><strong>Type:</strong> ${_esc(_displayJobType(lead))}</div>
        </div>
        <div class="job-lead-salary" role="cell">${_salaryHTML(lead.salary)}</div>
        <div class="job-lead-posted" role="cell">${lead.posted_at ? _esc(_formatDate(lead.posted_at)) : '&mdash;'}</div>
        <div class="job-lead-actions-cell" role="cell">
          <div class="job-lead-actions">
            <button class="btn btn-primary btn-sm" onclick="JobLeads.openJob('${_escAttr(lead.url || '')}')" ${lead.url ? '' : 'disabled'}>Open Job</button>
            <button class="btn btn-sm job-lead-usc-btn" onclick="JobLeads.findUscConnections('${_escAttr(company)}')" ${company && company !== 'Unknown company' ? '' : 'disabled'} title="Find USC alumni who work at this company">🎓 USC</button>
            ${_reviewActionsHTML(item)}
            <button class="btn btn-sm job-lead-source-btn" type="button" aria-label="Source: ${_escAttr(source)}">${_esc(source)}</button>
            <button class="btn btn-sm job-lead-delete-btn" onclick="JobLeads.deleteLead('${_escAttr(leadId)}')" ${_transitioning.has(leadId) ? 'disabled' : ''}>Delete</button>
          </div>
          ${_actionErrors[leadId] ? `<div class="job-lead-inline-error">${_esc(_actionErrors[leadId])}</div>` : ''}
        </div>
      </article>`;
  }

  function _reviewActionsHTML(item) {
    const leadId = _leadId(item);
    if (!leadId) return '';
    const state = _leadState(item);
    const disabled = _transitioning.has(leadId) ? 'disabled' : '';
    const busyLabel = _transitioning.has(leadId) ? 'Updating...' : '';

    if (state === 'pending_review') {
      return `<div class="job-lead-review-actions">
        <button class="btn btn-sm job-lead-approve-btn" onclick="JobLeads.approveLead('${_escAttr(leadId)}')" ${disabled}>
          ${busyLabel || 'Approve'}
        </button>
        <button class="btn btn-sm job-lead-reject-btn" onclick="JobLeads.rejectLead('${_escAttr(leadId)}')" ${disabled}>
          Reject
        </button>
      </div>`;
    }

    if (state === 'approved') {
      return `<div class="job-lead-review-actions">
        <button class="btn btn-sm job-lead-apply-btn" onclick="JobLeads.applyLead('${_escAttr(leadId)}')">Apply</button>
        <button class="btn btn-sm job-lead-reject-btn" onclick="JobLeads.rejectLead('${_escAttr(leadId)}')" ${disabled}>
          ${busyLabel || 'Reject'}
        </button>
      </div>`;
    }

    return '';
  }

  function _redFlagHTML(item) {
    const flags = Array.isArray(item?.red_flags) ? item.red_flags : [];
    if (!flags.length) return '';
    const reasons = flags.map(_redFlagReason).filter(Boolean);
    if (!reasons.length) return '';
    const title = reasons.join('\n');
    return `<span class="job-lead-red-flag" tabindex="0" role="img" aria-label="${_escAttr(title)}">
      <span aria-hidden="true">🚩</span>
      <span class="job-lead-red-flag-tooltip">${reasons.map(reason => `<span>${_esc(reason)}</span>`).join('')}</span>
    </span>`;
  }

  function _redFlagReason(flag) {
    const reasons = {
      staffing_agency: 'Posted by a staffing agency or body shop — you may not be hired directly by the end employer.',
      cth_intermediary: 'Contract-to-hire through a third party — conversion to full-time is not guaranteed and may take 12+ months.',
      low_hourly_rate: 'Hourly rate detected that annualizes below $100K — verify total compensation before applying.',
      vague_conversion: 'Posting uses vague conversion language — ask for a written conversion timeline before accepting.',
    };
    return reasons[flag] || '';
  }

  function _salaryHTML(value) {
    const text = String(value || '').trim();
    if (!text) return '&mdash;';
    const range = _splitSalaryRange(text);
    if (!range) return _esc(_formatSalaryValue(text));
    return `<span class="job-lead-salary-range"><span>${_esc(_formatSalaryValue(range[0]))} -</span><span>${_esc(_formatSalaryValue(range[1]))}</span></span>`;
  }

  function _splitSalaryRange(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.+?)\s*(?:—|–|-|\bto\b)\s*(.+)$/i);
    if (!match) return null;
    const low = match[1].trim();
    const high = match[2].trim();
    if (!low || !high) return null;
    return [low, high];
  }

  function _formatSalaryValue(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const cleaned = text.replace(/,/g, '');
    const match = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)(k)?/i);
    if (!match) return text;
    const rawNumber = Number(match[1]);
    if (!Number.isFinite(rawNumber)) return text;
    const amount = match[2] ? rawNumber * 1000 : rawNumber;
    if (amount < 1000) return text;
    const formatted = `$${Math.round(amount).toLocaleString('en-US')}`;
    return text.replace(match[0], formatted);
  }

  function _sortHeaderHTML(key, label) {
    const active = _sortKey === key;
    const arrow = !active ? '' : _sortDirection === 'asc' ? ' ↑' : ' ↓';
    return `<button class="job-leads-sort-header ${active ? 'active' : ''}" type="button" onclick="JobLeads.setSort('${_escAttr(key)}')" aria-label="Sort by ${_escAttr(label)}">${_esc(label)}${arrow}</button>`;
  }

  function _sortLeads(leads) {
    const sorted = [...leads];
    sorted.sort((a, b) => {
      const aValue = _sortValue(a, _sortKey);
      const bValue = _sortValue(b, _sortKey);
      let result = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue;
      } else {
        result = String(aValue || '').localeCompare(String(bValue || ''), undefined, { sensitivity: 'base', numeric: true });
      }
      if (result === 0 && _sortKey !== 'score') {
        result = _score(a) - _score(b);
      }
      return _sortDirection === 'asc' ? result : -result;
    });
    return sorted;
  }

  function _sortValue(item, key) {
    const lead = item.lead || item;
    if (key === 'score') return _score(item);
    if (key === 'company') return lead.company || '';
    if (key === 'role') return lead.title || lead.role || '';
    if (key === 'city') return _cityFromLocation(lead.location);
    if (key === 'level') return `${_displayLevel(lead)} ${_displayJobType(lead)}`;
    if (key === 'salary') return lead.salary || '';
    if (key === 'posted') {
      const value = Date.parse(lead.posted_at || '');
      return Number.isFinite(value) ? value : 0;
    }
    return '';
  }

  function _filteredLeads() {
    const cacheKey = _filterCacheKey();
    if (_filteredLeadsCache && _filteredLeadsCacheKey === cacheKey) {
      return _filteredLeadsCache;
    }
    const filtered = _leads
      .filter(item => _tierFilter === 'all' || (item.tier || _tierFromScore(_score(item))) === _tierFilter)
      .filter(item => {
        const state = _leadState(item);
        return _stateFilter === 'all' || state === _stateFilter;
      })
      .filter(item => {
        if (_sourceFilter === 'all') return true;
        return _sourceFilterKey(item) === _sourceFilter;
      })
      .filter(item => {
        if (_siteFilter === 'all') return true;
        const wt = String((item.lead || item).work_type || '').toLowerCase();
        if (_siteFilter === 'remote')  return wt === 'remote' || wt.includes('remote');
        if (_siteFilter === 'hybrid')  return wt === 'hybrid' || wt.includes('hybrid');
        if (_siteFilter === 'on-site') return wt === 'on-site' || wt === 'on site' || !wt || wt === 'not listed';
        return true;
      })
      .filter(item => {
        const query = _searchQuery.trim().toLowerCase();
        if (!query) return true;
        return _searchText(item).includes(query);
      });
    const sorted = _sortLeads(filtered);
    _filteredLeadsCache = sorted;
    _filteredLeadsCacheKey = cacheKey;
    return sorted;
  }

  function _searchText(item) {
    const lead = item.lead || item;
    return [
      lead.company,
      lead.title || lead.role,
      lead.location,
      lead.source || item.source,
      lead.salary,
      lead.description,
      item.tier || _tierFromScore(_score(item)),
      _leadState(item),
      _displaySource(lead.source || item.source || 'JL'),
    ]
      .map(value => String(value || '').toLowerCase())
      .join(' ');
  }

  function _sourceFilterOptionsHTML() {
    const options = _activeSourceOptions();
    if (_sourceFilter !== 'all' && !options.some(option => option.key === _sourceFilter)) {
      _sourceFilter = 'all';
    }
    return [
      _option('all', 'All Sources', _sourceFilter),
      ...options.map(option => _option(option.key, option.label, _sourceFilter)),
    ].join('');
  }

  function _activeSourceOptions() {
    const sources = new Map();
    _leads.forEach(item => {
      const key = _sourceFilterKey(item);
      if (!key || sources.has(key)) return;
      const lead = item.lead || item;
      sources.set(key, _displaySource(lead.source || item.source || 'JL'));
    });
    return [...sources.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }

  function _sourceFilterKey(item) {
    const lead = item.lead || item;
    return String(lead.source || item.source || 'JL')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function _normalizeLeads(payload) {
    const rows = Array.isArray(payload) ? payload : [];
    return rows.map(item => ({ ...item, score: _score(item), tier: item.tier || _tierFromScore(_score(item)) }));
  }

  async function _fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || response.statusText || 'Request failed');
    }
    return data;
  }

  async function _transitionLead(leadId, newState) {
    const index = _leads.findIndex(item => _leadId(item) === leadId);
    if (index < 0 || _transitioning.has(leadId)) return;

    const previousState = _leadState(_leads[index]);
    const previousItem = JSON.parse(JSON.stringify(_leads[index]));
    delete _actionErrors[leadId];
    _transitioning.add(leadId);
    _setLeadState(_leads[index], newState);
    _renderBodyOnly();
    _updateCount();

    try {
      const endpoint = newState === 'approved' ? '/api/jl/approve' : '/api/jl/reject';
      const updated = await _fetchJSON(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      _leads[index] = _mergeUpdatedLead(_leads[index], updated);
      delete _actionErrors[leadId];
    } catch (err) {
      _leads[index] = previousItem;
      _setLeadState(_leads[index], previousState);
      _actionErrors[leadId] = err.message || 'Could not update this lead.';
    } finally {
      _transitioning.delete(leadId);
      _renderBodyOnly();
      _updateCount();
    }
  }

  function _showApplyModal(item) {
    const lead = item.lead || item;
    _activeApplyLeadId = _leadId(item);
    UI.showModal(
      `Applying to ${_esc(lead.title || lead.role || 'role')} at ${_esc(lead.company || 'company')}`,
      `<div class="job-lead-apply-modal">
        <section class="job-lead-apply-section">
          <div class="job-lead-apply-section-title">Quick Actions</div>
          <div class="job-lead-apply-actions">
            <button class="btn btn-primary btn-sm" onclick="JobLeads.openResumeFolder()">Open Resume Folder</button>
            <button class="btn btn-gold btn-sm" onclick="JobLeads.draftCoverLetter()">Draft Cover Letter</button>
          </div>
          <p class="job-lead-apply-note">Profile info copied to clipboard &#10003;</p>
          <div class="job-lead-apply-instructions">
            <strong>Suggested application flow:</strong>
            <ol>
              <li>Draft the cover letter here and save a copy if you want to keep it.</li>
              <li>Open the job posting, then follow the employer's application steps.</li>
              <li>Select the best resume from the resume folder and paste the cover letter if the form asks for one.</li>
              <li>Submit on the job site first, then come back here and click "Yes, I Applied."</li>
            </ol>
          </div>
        </section>

        <section id="job-lead-cover-letter-section" class="job-lead-apply-section hidden">
          <div class="job-lead-apply-section-title">Cover Letter</div>
          <div id="job-lead-cover-loading" class="job-lead-cover-loading hidden">
            <span class="job-leads-spinner"></span>
            <span>Drafting cover letter...</span>
          </div>
          <textarea id="job-lead-cover-text" class="job-lead-cover-text" readonly></textarea>
          <div class="job-lead-apply-actions">
            <button class="btn btn-primary btn-sm" onclick="JobLeads.copyCoverLetter()">Copy</button>
            <button class="btn btn-ghost btn-sm" onclick="JobLeads.saveCoverLetter()">Save to Drive</button>
          </div>
        </section>

        <section class="job-lead-apply-section">
          <div class="job-lead-apply-section-title">Confirmation</div>
          <p class="job-lead-apply-note">Once you have submitted the application, record it here.</p>
          <div id="job-lead-apply-status" class="job-lead-apply-status"></div>
        </section>
      </div>`,
      [
        { id: 'applied', label: 'Yes, I Applied', class: 'btn-primary', close: false, action: () => confirmApplied() },
        { id: 'close', label: 'Not Yet - Close', class: 'btn-ghost', action: () => closeApplyModal(true) },
      ],
      { closeOnBackdrop: false }
    );
    document.querySelector('#active-modal .modal')?.classList.add('job-lead-apply-shell');
  }

  async function openResumeFolder() {
    _setApplyStatus('Opening resume folder...');
    try {
      const result = await _fetchJSON('/api/open-folder?type=resumes');
      _setApplyStatus(result.path ? `Resume folder opened: ${result.path}` : 'Resume folder opened.');
    } catch (err) {
      _setApplyStatus(`Could not open resume folder. ${err.message || ''}`.trim(), true);
    }
  }

  async function draftCoverLetter() {
    const section = document.getElementById('job-lead-cover-letter-section');
    const loading = document.getElementById('job-lead-cover-loading');
    const text = document.getElementById('job-lead-cover-text');
    if (section) section.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    if (text) text.value = '';

    try {
      const item = _leads.find(candidate => _leadId(candidate) === _activeApplyLeadId);
      const coverLetter = await _generateCoverLetter(item);
      if (text) text.value = coverLetter;
      _setApplyStatus('Cover letter drafted.');
    } catch (err) {
      if (text) text.value = '';
      _setApplyStatus(err.message || 'Could not draft cover letter.', true);
    } finally {
      if (loading) loading.classList.add('hidden');
    }
  }

  async function copyCoverLetter() {
    const text = document.getElementById('job-lead-cover-text')?.value || '';
    if (!text.trim()) {
      _setApplyStatus('No cover letter draft to copy yet.', true);
      return;
    }
    try {
      await _copyText(text);
      _setApplyStatus('Cover letter copied.');
    } catch {
      _setApplyStatus('Could not copy cover letter.', true);
    }
  }

  function saveCoverLetter() {
    const text = document.getElementById('job-lead-cover-text')?.value || '';
    if (!text.trim()) {
      _setApplyStatus('No cover letter draft to save yet.', true);
      return;
    }
    const item = _leads.find(candidate => _leadId(candidate) === _activeApplyLeadId);
    const lead = item?.lead || item || {};
    const stored = Storage.get('cover_letters', { items: [] });
    const entry = {
      id: `cover_${Date.now()}`,
      lead_id: _activeApplyLeadId,
      company: lead.company || '',
      role: lead.title || lead.role || '',
      created_at: new Date().toISOString(),
      text,
    };
    stored.items = [entry, ...(stored.items || [])];
    Storage.set('cover_letters', stored);
    _setApplyStatus('Cover letter saved to Drive.');
  }

  async function _generateCoverLetter(item) {
    if (!item) throw new Error('No active lead selected.');
    const lead = item.lead || item;
    const profile = Storage.get('profile', {});
    const contact = _candidateContactDetails(profile);
    const skills = Array.isArray(profile.skills)
      ? profile.skills.join(', ')
      : (profile.skills || profile.target_skills || '');
    const targetRoles = Array.isArray(profile.target_roles)
      ? profile.target_roles.join(', ')
      : (profile.target_roles || '');

    const system = `You are helping Corinne, a recent USC Marshall School of Business MSBA graduate, write a tailored cover letter.

Candidate profile:
- Full name: ${contact.name}
- Last name: ${contact.lastName}
- Email: ${contact.email || 'not available'}
- Phone: ${contact.phone || 'not available'}
- LinkedIn: ${contact.linkedin || 'not available'}
- Degree: MSBA, USC Marshall School of Business
- Skills: ${skills || 'data analytics, SQL, dashboards, business intelligence'}
- Target roles: ${targetRoles || 'Data Analyst, Business Intelligence Analyst, Product Analyst'}

Write a professional, specific, and concise cover letter for the following job.
Start with a simple contact header using the available exact candidate details above.
If email, phone, or LinkedIn is not available, omit that missing field entirely.
Sign the letter with the candidate's full name.
Never use placeholders such as [Last Name], [Email], [Phone], [LinkedIn], or "your phone number".
Do not use generic filler phrases. Reference the specific company and role.
Avoid AI-sounding polish, generic enthusiasm, and formulaic phrasing where possible.
Do not use em dashes or long dashes. Use commas, periods, or parentheses instead.
Length: 3 paragraphs. Tone: professional, confident, human, data-driven, and direct.`;

    const user = `Job details:
Company: ${lead.company || ''}
Role: ${lead.title || lead.role || ''}
Location: ${lead.location || ''}
Description: ${lead.description || ''}`;

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Config.claudeModel(),
        max_tokens: 900,
        stream: false,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || 'Cover letter generation failed');
    }

    const payload = await response.json();
    const letter = (payload.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('\n')
      .trim();
    if (!letter) throw new Error('Claude returned an empty cover letter.');
    return _fillCoverLetterPlaceholders(letter, contact);
  }

  function _candidateContactDetails(profile = {}) {
    const resume = Storage.get('resume', {});
    const resumeText = String(resume.resume_text || '');
    const name = _firstFilled(profile.name, _extractResumeName(resumeText), 'Corinne Bish');
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    const lastName = _firstFilled(profile.last_name, profile.lastName, nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    const email = _firstFilled(profile.email, profile.student_email, _extractEmail(resumeText));
    const phone = _firstFilled(profile.phone, profile.mobile, profile.cell, _extractPhone(resumeText));
    const linkedin = _normalizeLinkedIn(_firstFilled(profile.linkedin, profile.linkedin_url, profile.linkedIn, _extractLinkedIn(resumeText)));
    return { name, lastName, email, phone, linkedin };
  }

  function _firstFilled(...values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) return text;
    }
    return '';
  }

  function _extractResumeName(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  }

  function _extractEmail(text) {
    return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  }

  function _extractPhone(text) {
    return String(text || '').match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || '';
  }

  function _extractLinkedIn(text) {
    return String(text || '').match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]+\/?/i)?.[0] || '';
  }

  function _normalizeLinkedIn(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    if (/^(?:www\.)?linkedin\.com\//i.test(text)) return `https://${text.replace(/^www\./i, 'www.')}`;
    return text;
  }

  function _fillCoverLetterPlaceholders(letter, contact) {
    const replacements = {
      'Full Name': contact.name,
      Name: contact.name,
      'First Last': contact.name,
      'Last Name': contact.lastName,
      Email: contact.email,
      'Email Address': contact.email,
      Phone: contact.phone,
      'Phone Number': contact.phone,
      LinkedIn: contact.linkedin,
      'LinkedIn URL': contact.linkedin,
    };
    let filled = letter;
    Object.entries(replacements).forEach(([label, value]) => {
      if (!value) return;
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filled = filled.replace(new RegExp(`\\[${escaped}\\]`, 'gi'), value);
    });
    return filled;
  }

  async function confirmApplied(overrideDuplicate = false) {
    if (!_activeApplyLeadId) return;
    _setApplyStatus(overrideDuplicate ? 'Recording duplicate override...' : 'Recording application...');
    try {
      const activeLeadId = _activeApplyLeadId;
      const updated = await _fetchJSON('/api/jl/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: activeLeadId, override_duplicate: overrideDuplicate }),
      });
      const index = _leads.findIndex(item => _leadId(item) === activeLeadId);
      let appliedLead = updated;
      if (index >= 0) {
        _leads[index] = _mergeUpdatedLead(_leads[index], updated);
        _setLeadState(_leads[index], 'applied');
        appliedLead = _leads[index];
        _invalidateLeadFilters();
        _renderBodyOnly();
        _updateCount();
      }
      _recordJscApplication(appliedLead);
      _setApplyStatus('Application recorded.');
      const lead = appliedLead.lead || appliedLead;
      UI.notify(`Application recorded for ${lead.title || lead.role || 'role'} at ${lead.company || 'company'}`, 'success');
      _clearPendingApply(activeLeadId);
      UI.closeModal();
      _activeApplyLeadId = '';
    } catch (err) {
      if (!overrideDuplicate && String(err.message || '').toLowerCase().includes('duplicate application')) {
        _showDuplicateApplyMessage();
        return;
      }
      _setApplyStatus(err.message || 'Could not record application.', true);
    }
  }

  function _recordJscApplication(item) {
    const lead = item.lead || item;
    Jobs.addApplication({
      company: lead.company,
      source_lead_id: _leadId(item),
      role: lead.title || lead.role,
      date: new Date().toISOString().split('T')[0],
      status: 'applied',
      url: lead.url,
      notes: `JL Score: ${_score(item)} | Tier: ${item.tier || _tierFromScore(_score(item))} | Source: ${lead.source || item.source || ''}`,
    });
  }

  async function confirmPendingApply() {
    const pending = _pendingApply();
    if (!pending?.lead_id) return;
    _activeApplyLeadId = pending.lead_id;
    const item = _leads.find(candidate => _leadId(candidate) === pending.lead_id);
    _setPendingApplyBannerStatus('Recording application...');
    try {
      const updated = await _fetchJSON('/api/jl/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: pending.lead_id }),
      });
      const index = _leads.findIndex(candidate => _leadId(candidate) === pending.lead_id);
      const appliedLead = index >= 0 ? _mergeUpdatedLead(_leads[index], updated) : updated;
      if (index >= 0) {
        _leads[index] = appliedLead;
        _setLeadState(_leads[index], 'applied');
        _invalidateLeadFilters();
      }
      _recordJscApplication(appliedLead || item || updated);
      _clearPendingApply(pending.lead_id);
      _activeApplyLeadId = '';
      render();
      const lead = (appliedLead?.lead || appliedLead || item?.lead || item || {});
      UI.notify(`Application recorded for ${lead.title || lead.role || pending.role || 'role'} at ${lead.company || pending.company || 'company'}`, 'success');
    } catch (err) {
      _setPendingApplyBannerStatus(err.message || 'Could not record application.', true);
    }
  }

  function dismissPendingApply() {
    _clearPendingApply();
    render();
  }

  function closeApplyModal(recordPending = true) {
    if (recordPending && _activeApplyLeadId) {
      const item = _leads.find(candidate => _leadId(candidate) === _activeApplyLeadId);
      const lead = item?.lead || item || {};
      localStorage.setItem('jsc_pending_apply', JSON.stringify({
        lead_id: _activeApplyLeadId,
        company: lead.company || '',
        role: lead.title || lead.role || '',
        timestamp: new Date().toISOString(),
      }));
    }
    _activeApplyLeadId = '';
  }

  function _pendingApplyBannerHTML() {
    const pending = _pendingApply();
    if (!pending?.lead_id) return '';
    return `<div class="job-leads-pending-apply-banner" id="job-leads-pending-apply-banner">
      <div>
        <strong>You opened ${_esc(pending.role || 'this role')} at ${_esc(pending.company || 'this company')}.</strong>
        <span>Did you apply?</span>
        <div id="job-leads-pending-apply-status" class="job-leads-pending-apply-status"></div>
      </div>
      <div class="job-lead-apply-actions">
        <button class="btn btn-primary btn-sm" onclick="JobLeads.confirmPendingApply()">Yes</button>
        <button class="btn btn-ghost btn-sm" onclick="JobLeads.dismissPendingApply()">No</button>
      </div>
    </div>`;
  }

  function _pendingApply() {
    try {
      return JSON.parse(localStorage.getItem('jsc_pending_apply') || 'null');
    } catch {
      return null;
    }
  }

  function _clearPendingApply(leadId = '') {
    const pending = _pendingApply();
    if (!leadId || pending?.lead_id === leadId) {
      localStorage.removeItem('jsc_pending_apply');
    }
  }

  function _setPendingApplyBannerStatus(message, isError = false) {
    const el = document.getElementById('job-leads-pending-apply-status');
    if (!el) return;
    el.className = `job-leads-pending-apply-status ${isError ? 'error' : 'success'}`;
    el.textContent = message;
  }

  function _showDuplicateApplyMessage() {
    const status = document.getElementById('job-lead-apply-status');
    if (!status) return;
    const item = _leads.find(candidate => _leadId(candidate) === _activeApplyLeadId);
    const lead = item?.lead || item || {};
    status.className = 'job-lead-apply-status error';
    status.innerHTML = `
      <div>You may have already applied to a similar role at ${_esc(lead.company || 'this company')}. Are you sure?</div>
      <div class="job-lead-apply-actions">
        <button class="btn btn-primary btn-sm" onclick="JobLeads.acknowledgeDuplicateApply()">Confirm</button>
        <button class="btn btn-ghost btn-sm" onclick="JobLeads.cancelDuplicateApply()">Cancel</button>
      </div>`;
  }

  async function acknowledgeDuplicateApply() {
    await confirmApplied(true);
  }

  function cancelDuplicateApply() {
    _setApplyStatus('Duplicate application not recorded.');
  }

  function _setApplyStatus(message, isError = false) {
    const el = document.getElementById('job-lead-apply-status');
    if (!el) return;
    el.className = `job-lead-apply-status ${isError ? 'error' : 'success'}`;
    el.textContent = message;
  }

  async function _copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function _profileClipboardText() {
    const profile = Storage.get('profile', {});
    const contact = _candidateContactDetails(profile);
    return [
      `Name: ${contact.name}`,
      `Last Name: ${contact.lastName}`,
      `Email: ${contact.email}`,
      `Phone: ${contact.phone}`,
      `LinkedIn: ${contact.linkedin}`,
    ].join('\n');
  }

  function _mergeUpdatedLead(current, updated) {
    const payload = updated && typeof updated === 'object' ? updated : {};
    const merged = { ...current, ...payload };
    if (current.lead || payload.lead) {
      merged.lead = { ...(current.lead || {}), ...(payload.lead || {}) };
    }
    const state = _leadState(payload);
    if (state) _setLeadState(merged, state);
    return merged;
  }

  function _healthSummary() {
    const timestamp = _health?.finished_at_utc || _health?.updated_at || _health?.last_updated || null;
    return `<div class="job-leads-health-meta">Last updated: ${timestamp ? _formatDateTime(timestamp) : 'not yet run'} | ${_leads.length} leads</div>`;
  }

  function _jlConnectionHTML() {
    const timestamp = _health?.finished_at_utc || _health?.updated_at || _health?.last_updated || _lastLoadedAt || null;
    const connected = !_error && !_loading && !_running && _leads.length > 0;
    return `<div class="job-leads-connection ${connected ? 'connected' : ''}">
      <div>
        <strong>${connected ? 'Live JL feed connected' : 'JL feed status'}</strong>
        <span>${connected ? `${_leads.length} scored leads loaded from JobLeadsTool.` : 'Reload leads to pull the latest scored output.'}</span>
      </div>
      <div class="job-leads-connection-meta">${timestamp ? `Last JL run: ${_formatDateTime(timestamp)}` : 'No JL run timestamp yet'}</div>
    </div>`;
  }

  function _displaySource(value) {
    const key = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return SOURCE_LABELS[key] || String(value || 'JL').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function _displayLevel(lead) {
    const explicit = String(lead?.level || '').trim();
    if (explicit) return explicit;
    const title = String(lead?.title || lead?.role || '').toLowerCase();
    if (/(intern|internship)/.test(title)) return 'Internship';
    if (/(entry level|early career|new grad|graduate|junior|jr\.)/.test(title)) return 'Entry Level';
    if (/(associate|coordinator)/.test(title)) return 'Associate';
    return 'Not listed';
  }

  function _displayJobType(lead) {
    const explicit = String(lead?.job_type || lead?.work_type || '').trim();
    const title = String(lead?.title || lead?.role || '').toLowerCase();
    const types = [];
    if (/(intern|internship)/.test(title)) types.push('Internship');
    else if (/(contract|contractor|temporary)/.test(title)) types.push('Contract');
    if (explicit) {
      types.push(explicit);
    } else {
      const locL = String(lead?.location || '').toLowerCase();
      if (/remote|telework/.test(locL)) types.push('Remote');
      else if (locL) types.push('On-site');
    }
    return types.length ? types.join(' / ') : 'Not listed';
  }

  function _renderBodyOnly() {
    const body = document.getElementById('job-leads-body');
    if (body) body.innerHTML = _bodyHTML();
  }

  function _updateCount() {
    const count = document.querySelector('.job-leads-count');
    if (count) count.textContent = `${_filteredLeads().length} of ${_leads.length} leads`;
  }

  function _score(item) {
    const value = Number(item.score || item.fit_score || 0);
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  function _leadId(item) {
    const lead = item?.lead && typeof item.lead === 'object' ? item.lead : item;
    return String(lead?.id || item?.id || '');
  }

  function _leadState(item) {
    const lead = item?.lead && typeof item.lead === 'object' ? item.lead : item;
    return lead?.approval_state || item?.approval_state || 'pending_review';
  }

  function _setLeadState(item, state) {
    if (!item) return;
    if (item.lead && typeof item.lead === 'object') {
      item.lead.approval_state = state;
    }
    item.approval_state = state;
  }

  function _tierFromScore(score) {
    if (score >= 70) return 'tier_1';
    if (score >= 45) return 'tier_2';
    return 'tier_3';
  }

  function _tierClass(tier) {
    return tier === 'tier_1' ? 'tier-one' : tier === 'tier_2' ? 'tier-two' : 'tier-three';
  }

  function _stateClass(state) {
    return `state-${String(state || 'pending_review').replace(/_/g, '-')}`;
  }

  function _stateLabel(state) {
    return String(state || 'pending_review').replace(/_/g, ' ');
  }

  function _option(value, label, selected) {
    return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
  }

  function _formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function _formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function _cityFromLocation(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(remote|hybrid|flexible \/ remote|united states)$/i.test(text)) return text;
    const parts = text.split(',').map(part => part.trim()).filter(Boolean);
    const city = parts[0] || text;
    const state = _stateAbbreviationFromLocationParts(parts);
    return state ? `${city}, ${state}` : city;
  }

  // The location names a place (more than just a city) but we couldn't resolve a
  // state from it — e.g. an ambiguous county like "Bedford, Hillsborough County".
  function _stateUndetermined(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/remote|telework|hybrid|flexible/i.test(text)) return false;
    if (/^(united states|us|usa|nationwide|location not specified)$/i.test(text)) return false;
    const parts = text.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return false; // a bare city isn't the county-exception case
    return !_stateAbbreviationFromLocationParts(parts);
  }

  function _cityCellHTML(rawLocation, city) {
    if (!city) return '&mdash;';
    if (_stateUndetermined(rawLocation)) {
      return `${_esc(city)}<div class="job-lead-city-note">State cannot be determined</div>`;
    }
    return _esc(city);
  }

  function _stateAbbreviationFromLocationParts(parts) {
    for (let index = 1; index < parts.length; index += 1) {
      const part = parts[index].replace(/\b(united states|usa|us)\b/ig, '').trim();
      if (/^[A-Z]{2}$/.test(part)) return part;
      const normalized = part.toLowerCase();
      if (STATE_ABBREVIATIONS[normalized]) return STATE_ABBREVIATIONS[normalized];
      if (COUNTY_STATE_HINTS[normalized]) return COUNTY_STATE_HINTS[normalized];
    }
    return '';
  }

  function _plainText(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _truncate(value, maxLength) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
  }

  function _ensureStyles() {
    if (document.getElementById('job-leads-style')) return;
    const style = document.createElement('style');
    style.id = 'job-leads-style';
    style.textContent = `
      .job-leads-page { display:flex; flex-direction:column; gap:16px; }
      .job-leads-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
      .job-leads-header > button { margin-left:8px; }
      .job-leads-header > button + button { margin-left:0; }
      .job-leads-health { margin-top:8px; color:var(--text-muted); font-size:14px; line-height:1.5; }
      .job-leads-health-meta { margin-bottom:5px; }
      .job-leads-filter-row { display:flex; gap:12px; align-items:end; flex-wrap:wrap; }
      .job-leads-filter-row label { display:flex; flex-direction:column; gap:4px; color:var(--text-muted); font-size:14px; font-weight:700; }
      .job-leads-filter-row select { min-width:130px; }
      .job-leads-search-label { flex:1 1 260px; max-width:420px; }
      .job-leads-search-label input { width:100%; min-width:220px; }
      .job-leads-count { margin-left:auto; color:var(--text-muted); font-size:15px; padding-bottom:8px; }
      .job-leads-pending-apply-banner { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid rgba(184,137,29,0.5); border-radius:8px; background:rgba(184,137,29,0.12); color:var(--text); }
      .job-leads-pending-apply-banner strong { display:block; margin-bottom:3px; }
      .job-leads-pending-apply-status { margin-top:5px; font-size:14px; color:var(--text-muted); }
      .job-leads-pending-apply-status.success { color:var(--success); }
      .job-leads-pending-apply-status.error { color:var(--danger); }
      .job-leads-connection { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 14px; border:1px solid var(--border); border-radius:8px; background:rgba(255,255,255,0.03); color:var(--text); }
      body.light .job-leads-connection { background:rgba(255,255,255,0.72); }
      .job-leads-connection.connected { border-color:rgba(34,197,94,0.35); background:rgba(34,197,94,0.08); }
      .job-leads-connection strong { display:block; color:var(--text); font-size:15px; margin-bottom:2px; }
      .job-leads-connection span { color:var(--text-muted); font-size:14px; }
      .job-leads-connection-meta { color:var(--text-muted); font-size:14px; white-space:nowrap; }
      .job-leads-list { display:flex; flex-direction:column; gap:0; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.025); }
      body.light .job-leads-list { background:rgba(255,255,255,0.72); }
      .job-leads-body-scroll { overflow-y:auto; max-height:calc(100vh - 260px); }
      .job-leads-row { display:grid; grid-template-columns:70px minmax(125px,0.95fr) minmax(240px,1.55fr) minmax(95px,0.7fr) minmax(92px,0.68fr) minmax(84px,0.62fr) minmax(82px,0.58fr) minmax(188px,210px); gap:12px; align-items:center; }
      .job-leads-row-head { padding:10px 14px; color:var(--text-muted); font-size:12px; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; background:rgba(0,0,0,0.16); border-bottom:1px solid var(--border); }
      body.light .job-leads-row-head { background:rgba(61,75,90,0.08); }
      .job-leads-sort-header { appearance:none; border:0; background:transparent; color:inherit; font:inherit; letter-spacing:inherit; text-transform:inherit; text-align:left; padding:0; cursor:pointer; }
      .job-leads-sort-header:hover, .job-leads-sort-header.active { color:var(--gold); }
      .job-lead-card { border:0; border-radius:0; box-shadow:none; padding:13px 14px; min-height:0; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.018); }
      .job-lead-card:last-child { border-bottom:0; }
      .job-lead-card.alternate { background:rgba(255,255,255,0.045); }
      body.light .job-lead-card { background:rgba(255,255,255,0.62); }
      body.light .job-lead-card.alternate { background:rgba(61,75,90,0.045); }
      .job-lead-score-cell { display:flex; flex-direction:column; align-items:flex-start; gap:7px; }
      .job-lead-score-row { display:flex; align-items:center; gap:7px; position:relative; }
      .job-lead-score { display:inline-flex; align-items:center; justify-content:center; min-width:44px; height:30px; border-radius:999px; font-weight:900; color:#fff; }
      .job-lead-score.tier-one { background:var(--success); }
      .job-lead-score.tier-two { background:#b8891d; }
      .job-lead-score.tier-three { background:#6b7280; }
      .job-lead-red-flag { position:relative; display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:999px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.28); cursor:help; line-height:1; font-size:14px; }
      .job-lead-red-flag-tooltip { position:absolute; z-index:20; left:0; top:calc(100% + 8px); display:none; width:min(320px, 70vw); padding:10px 12px; border-radius:8px; border:1px solid rgba(239,68,68,0.35); background:var(--card-bg); color:var(--text); box-shadow:0 14px 32px rgba(0,0,0,0.28); font-size:12px; line-height:1.45; font-weight:600; }
      .job-lead-red-flag-tooltip span { display:block; }
      .job-lead-red-flag-tooltip span + span { margin-top:7px; padding-top:7px; border-top:1px solid var(--border); }
      .job-lead-red-flag:hover .job-lead-red-flag-tooltip,
      .job-lead-red-flag:focus .job-lead-red-flag-tooltip { display:block; }
      .job-lead-pill { border-radius:999px; padding:4px 8px; font-size:12px; font-weight:800; text-transform:uppercase; }
      .state-pending-review { background:rgba(59,130,246,0.18); color:#60a5fa; }
      .state-approved { background:rgba(34,197,94,0.18); color:var(--success); }
      .state-rejected { background:rgba(239,68,68,0.18); color:var(--danger); }
      .state-applied { background:rgba(168,85,247,0.18); color:#c084fc; }
      .job-lead-company { font-size:14px; font-weight:700; color:var(--text); line-height:1.22; }
      .job-lead-role-cell { min-width:0; }
      .job-lead-role { color:var(--text); line-height:1.38; font-size:16px; }
      .job-lead-description { color:var(--text-muted); font-size:14px; line-height:1.35; margin-top:4px; }
      .job-lead-meta { display:flex; justify-content:space-between; gap:8px; color:var(--text-muted); font-size:14px; }
      .job-lead-detail-row { display:flex; justify-content:space-between; gap:10px; color:var(--text-muted); font-size:14px; border-top:1px solid var(--border); padding-top:8px; }
      .job-lead-detail-row strong { color:var(--text); text-align:right; }
      .job-lead-city, .job-lead-level, .job-lead-salary, .job-lead-posted { color:var(--text); font-size:14px; line-height:1.35; }
      .job-lead-city-note { color:var(--gold, #d97706); font-size:11px; line-height:1.3; margin-top:2px; }
      .job-lead-level, .job-lead-salary, .job-lead-posted { color:var(--text-muted); }
      .job-lead-level strong { color:var(--text); font-weight:800; }
      .job-lead-salary-range { display:inline-flex; flex-direction:column; gap:2px; line-height:1.25; }
      .job-lead-actions-cell { min-width:0; justify-self:end; width:min(100%, 260px); }
      .job-lead-actions { display:flex; flex-direction:row; justify-content:flex-end; gap:4px; align-items:center; flex-wrap:wrap; }
      .job-lead-review-actions { display:flex; flex-direction:row; gap:4px; align-items:center; flex-wrap:wrap; }
      .job-lead-actions .btn { max-width:80px; font-size:12px; padding:4px 8px; }
      .job-lead-actions .btn.btn-primary { max-width:80px; }
      .job-lead-approve-btn { background:var(--success); border-color:var(--success); color:#fff; }
      .job-lead-reject-btn { background:var(--danger); border-color:var(--danger); color:#fff; }
      .job-lead-apply-btn { background:var(--gold); border-color:var(--gold); color:#111827; }
      .job-lead-delete-btn { background:transparent; border-color:var(--danger); color:var(--danger); }
      .job-lead-delete-btn:hover { background:rgba(239,68,68,0.12); border-color:var(--danger); color:var(--danger); }
      .job-lead-source-btn { background:#d97706; border-color:#d97706; color:#fff; cursor:default; max-width:116px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .job-lead-source-btn:hover { background:#d97706; border-color:#d97706; color:#fff; }
      .job-lead-usc-btn { background:#990000; border-color:#990000; color:#ffcc00; font-weight:800; }
      .job-lead-usc-btn:hover:not(:disabled) { background:#7a0000; border-color:#7a0000; color:#ffcc00; }
      .job-lead-usc-shell { width:min(560px, calc(100vw - 56px)); max-width:min(560px, calc(100vw - 56px)); max-height:calc(100vh - 56px); display:flex; flex-direction:column; }
      .job-lead-usc-shell .modal-body { min-height:0; overflow-y:auto; }
      .job-lead-usc-modal { display:flex; flex-direction:column; gap:0; }
      .job-lead-usc-section { display:flex; flex-direction:column; gap:8px; padding:4px 0 8px; }
      .job-lead-usc-section-label { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.09em; color:var(--gold); margin-bottom:2px; }
      .job-lead-usc-divider { border:0; border-top:1px solid var(--border); margin:8px 0; }
      .job-lead-usc-intro { margin:0 0 2px; color:var(--text); line-height:1.5; font-size:14px; }
      .job-lead-usc-link { display:block; text-align:left; text-decoration:none; line-height:1.4; }
      .job-lead-usc-hint { display:block; font-size:12px; font-weight:500; opacity:0.82; margin-top:2px; }
      .job-lead-usc-trojan-btn { background:#990000; border-color:#990000; color:#ffcc00; font-weight:800; }
      .job-lead-usc-trojan-btn:hover { background:#7a0000; border-color:#7a0000; color:#ffcc00; }
      .job-lead-inline-error { color:var(--danger); font-size:14px; line-height:1.35; margin-top:8px; text-align:right; }
      .job-lead-apply-shell { width:min(920px, calc(100vw - 56px)); max-width:min(920px, calc(100vw - 56px)); max-height:calc(100vh - 56px); display:flex; flex-direction:column; }
      .job-lead-apply-shell .modal-title { flex-shrink:0; }
      .job-lead-apply-shell .modal-body { min-height:0; overflow-y:auto; padding-right:8px; }
      .job-lead-apply-shell .modal-footer { flex-shrink:0; }
      .job-lead-apply-modal { display:flex; flex-direction:column; gap:16px; width:100%; min-width:0; }
      .job-lead-apply-section { border:1px solid var(--border); border-radius:8px; padding:14px; background:rgba(255,255,255,0.03); }
      body.light .job-lead-apply-section { background:rgba(255,255,255,0.72); }
      .job-lead-apply-section-title { color:var(--gold); font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
      .job-lead-apply-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .job-lead-apply-note { margin:10px 0 0; color:var(--text); line-height:1.5; }
      .job-lead-apply-instructions { margin-top:12px; color:var(--text); line-height:1.5; font-size:15px; }
      .job-lead-apply-instructions strong { color:var(--gold); }
      .job-lead-apply-instructions ol { margin:8px 0 0 20px; padding:0; }
      .job-lead-apply-instructions li { margin:4px 0; }
      .job-lead-apply-status { min-height:18px; margin-top:10px; color:var(--text-muted); font-size:15px; line-height:1.45; }
      .job-lead-apply-status.success { color:var(--success); }
      .job-lead-apply-status.error { color:var(--danger); }
      .job-lead-cover-loading { display:flex; align-items:center; gap:10px; color:var(--text-muted); margin-bottom:10px; }
      .job-lead-cover-text { width:100%; box-sizing:border-box; min-height:320px; max-height:calc(100vh - 360px); overflow:auto; resize:vertical; margin-bottom:10px; white-space:pre-wrap; }
      .job-lead-manual-shell { width:min(760px, calc(100vw - 56px)); max-width:min(760px, calc(100vw - 56px)); max-height:calc(100vh - 56px); display:flex; flex-direction:column; }
      .job-lead-manual-shell .modal-body { min-height:0; overflow-y:auto; padding-right:8px; }
      .job-lead-manual-modal { display:flex; flex-direction:column; gap:13px; }
      .job-lead-manual-tip { border:1px solid rgba(59,130,246,0.28); border-radius:8px; background:rgba(59,130,246,0.1); color:var(--text); padding:11px 12px; line-height:1.45; font-size:14px; }
      .job-lead-manual-error { border:1px solid rgba(239,68,68,0.35); border-radius:8px; background:rgba(239,68,68,0.1); color:var(--danger); padding:10px 12px; line-height:1.45; font-size:14px; }
      .job-lead-manual-field { display:flex; flex-direction:column; gap:5px; color:var(--text); font-weight:800; }
      .job-lead-manual-field span { font-size:14px; }
      .job-lead-manual-field em { color:var(--text-muted); font-style:normal; font-weight:600; }
      .job-lead-manual-field input,
      .job-lead-manual-field textarea { width:100%; box-sizing:border-box; }
      .job-lead-manual-field textarea { resize:vertical; min-height:180px; }
      .hidden { display:none !important; }
      .job-leads-loading, .job-leads-error { display:flex; align-items:center; justify-content:center; min-height:180px; gap:12px; text-align:center; }
      .job-leads-error { flex-direction:column; color:var(--text); }
      .job-leads-spinner { width:24px; height:24px; border-radius:50%; border:3px solid var(--border); border-top-color:var(--gold); animation:jobLeadsSpin 0.8s linear infinite; }
      @keyframes jobLeadsSpin { to { transform:rotate(360deg); } }
      @media (max-width:1420px) {
        .job-leads-row-head { display:none; }
        .job-lead-card.job-leads-row {
          grid-template-columns:70px minmax(120px,0.85fr) minmax(220px,1.45fr) minmax(140px,180px);
          grid-template-areas:
            "score company role actions"
            "score city role actions"
            "score level salary actions"
            "score posted posted actions";
          gap:8px 12px;
          align-items:start;
          padding:12px 14px;
        }
        .job-lead-score-cell { grid-area:score; }
        .job-lead-company { grid-area:company; min-width:0; font-size:18px; }
        .job-lead-role-cell { grid-area:role; }
        .job-lead-city { grid-area:city; }
        .job-lead-level { grid-area:level; }
        .job-lead-salary { grid-area:salary; }
        .job-lead-posted { grid-area:posted; }
        .job-lead-actions-cell { grid-area:actions; justify-self:end; width:124px; }
        .job-lead-city::before { content:"City/ST: "; color:var(--text-muted); font-weight:800; }
        .job-lead-salary::before { content:"Salary: "; color:var(--text-muted); font-weight:800; }
        .job-lead-posted::before { content:"Posted: "; color:var(--text-muted); font-weight:800; }
        .job-lead-actions { justify-content:flex-end; align-items:center; flex-direction:row; flex-wrap:wrap; }
        .job-lead-actions .btn, .job-lead-review-actions .btn { width:auto; max-width:90px; font-size:12px; padding:4px 6px; }
        .job-lead-review-actions { flex-direction:column; align-items:flex-end; }
      }
      @media (max-width:980px) {
        .job-lead-card.job-leads-row {
          grid-template-columns:66px minmax(0,1fr);
          grid-template-areas:
            "score company"
            "score role"
            "score city"
            "score level"
            "score salary"
            "score posted"
            "actions actions";
        }
        .job-lead-actions-cell { justify-self:start; width:auto; max-width:100%; }
        .job-lead-actions { justify-content:flex-start; align-items:center; flex-direction:row; }
        .job-lead-actions .btn, .job-lead-review-actions .btn { width:auto; max-width:116px; }
        .job-lead-review-actions { flex-direction:row; align-items:center; }
      }
      @media (max-width:760px) {
        .job-leads-header { flex-direction:column; }
        .job-leads-header > button { margin-left:0; }
        .job-leads-count { margin-left:0; }
        .job-leads-connection { flex-direction:column; align-items:flex-start; }
        .job-leads-connection-meta { white-space:normal; }
        .job-leads-row-head { display:none; }
        .job-lead-card.job-leads-row { grid-template-columns:1fr; grid-template-areas:"score" "company" "role" "city" "level" "salary" "posted" "actions"; gap:9px; }
        .job-lead-card { padding:14px; }
        .job-lead-score-cell { flex-direction:row; align-items:center; }
        .job-lead-actions-cell { justify-self:start; width:auto; }
        .job-lead-actions { justify-content:flex-start; }
        .job-lead-inline-error { text-align:left; }
      }
    `;
    document.head.appendChild(style);
  }

  function _esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _escAttr(value) {
    return _esc(value).replace(/'/g, '&#39;');
  }

  return {
    render,
    load,
    refresh,
    setTierFilter,
    setStateFilter,
    setSourceFilter,
    setSiteFilter,
    setSearchQuery,
    handleSearchKeydown,
    setSort,
    openJob,
    findUscConnections,
    openManualJobModal,
    submitManualJob,
    applyLead,
    openResumeFolder,
    draftCoverLetter,
    copyCoverLetter,
    saveCoverLetter,
    confirmApplied,
    confirmPendingApply,
    closeApplyModal,
    dismissPendingApply,
    acknowledgeDuplicateApply,
    cancelDuplicateApply,
    approveLead,
    rejectLead,
    deleteLead,
    __testRecordJscApplication: _recordJscApplication,
  };
})();
