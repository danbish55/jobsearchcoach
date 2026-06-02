/* Job Leads view */
const JobLeads = (() => {
  const SOURCE_IDS = ['adzuna', 'indeed', 'the_muse', 'builtin_la'];
  const SOURCE_LABELS = {
    adzuna: 'adzuna',
    indeed: 'indeed',
    the_muse: 'the_muse',
    builtin_la: 'builtin_la',
  };

  let _leads = [];
  let _health = null;
  let _loading = false;
  let _running = false;
  let _error = '';
  let _tierFilter = 'all';
  let _stateFilter = 'all';
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
            ${_running ? 'Refreshing...' : 'Refresh Job Leads'}
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
            State
            <select id="job-leads-state-filter" onchange="JobLeads.setStateFilter(this.value)">
              ${_option('all', 'All', _stateFilter)}
              ${_option('pending_review', 'Pending', _stateFilter)}
              ${_option('approved', 'Approved', _stateFilter)}
              ${_option('rejected', 'Rejected', _stateFilter)}
              ${_option('applied', 'Applied', _stateFilter)}
            </select>
          </label>
          <div class="job-leads-count">${_filteredLeads().length} of ${_leads.length} leads</div>
        </div>

        <div id="job-leads-body">
          ${_bodyHTML()}
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
      _health = health;
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

  function setTierFilter(value) {
    _tierFilter = value || 'all';
    _renderBodyOnly();
    _updateCount();
  }

  function setStateFilter(value) {
    _stateFilter = value || 'all';
    _renderBodyOnly();
    _updateCount();
  }

  function openJob(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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

  function _bodyHTML() {
    if (_loading || _running) {
      return `<div class="card job-leads-loading">
        <div class="job-leads-spinner"></div>
        <div>${_running ? 'Running JobLeadsTool cycle...' : 'Loading job leads...'}</div>
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

    return `<div class="job-leads-grid">${leads.map(_leadCardHTML).join('')}</div>`;
  }

  function _leadCardHTML(item) {
    const lead = item.lead || item;
    const leadId = _leadId(item);
    const score = _score(item);
    const tier = item.tier || _tierFromScore(score);
    const state = _leadState(item);
    return `
      <article class="card job-lead-card" data-lead-id="${_escAttr(leadId)}">
        <div class="job-lead-top">
          <span class="job-lead-score ${_tierClass(tier)}">${score}</span>
          <span class="job-lead-pill ${_stateClass(state)}">${_stateLabel(state)}</span>
        </div>
        <div class="job-lead-company">${_esc(lead.company || 'Unknown company')}</div>
        <div class="job-lead-role">${_esc(lead.title || lead.role || 'Untitled role')}</div>
        <div class="job-lead-meta">
          <span>${lead.location ? _esc(lead.location) : '&mdash;'}</span>
          <span>${_esc(lead.source || item.source || 'source')}</span>
        </div>
        <div class="job-lead-detail-row">
          <span>Salary</span><strong>${lead.salary ? _esc(lead.salary) : '&mdash;'}</strong>
        </div>
        <div class="job-lead-detail-row">
          <span>Posted</span><strong>${lead.posted_at ? _esc(_formatDate(lead.posted_at)) : '&mdash;'}</strong>
        </div>
        <div class="job-lead-actions">
          <button class="btn btn-primary btn-sm" onclick="JobLeads.openJob('${_escAttr(lead.url || '')}')" ${lead.url ? '' : 'disabled'}>Open Job</button>
          <span class="job-lead-source-tag">${_esc(lead.source || item.source || 'JL')}</span>
        </div>
        ${_reviewActionsHTML(item)}
        ${_actionErrors[leadId] ? `<div class="job-lead-inline-error">${_esc(_actionErrors[leadId])}</div>` : ''}
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

  function _filteredLeads() {
    return _leads
      .filter(item => _tierFilter === 'all' || (item.tier || _tierFromScore(_score(item))) === _tierFilter)
      .filter(item => {
        const lead = item.lead || item;
        const state = _leadState(item);
        return _stateFilter === 'all' || state === _stateFilter;
      });
  }

  function _normalizeLeads(payload) {
    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map(item => ({ ...item, score: _score(item), tier: item.tier || _tierFromScore(_score(item)) }))
      .sort((a, b) => _score(b) - _score(a));
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
      ]
    );
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
    const skills = Array.isArray(profile.skills)
      ? profile.skills.join(', ')
      : (profile.skills || profile.target_skills || '');
    const targetRoles = Array.isArray(profile.target_roles)
      ? profile.target_roles.join(', ')
      : (profile.target_roles || '');

    const system = `You are helping Corinne, a recent USC Marshall School of Business MSBA graduate, write a tailored cover letter.

Candidate profile:
- Name: ${profile.name || 'Corinne'}
- Degree: MSBA, USC Marshall School of Business
- Skills: ${skills || 'data analytics, SQL, dashboards, business intelligence'}
- Target roles: ${targetRoles || 'Data Analyst, Business Intelligence Analyst, Product Analyst'}

Write a professional, specific, and concise cover letter for the following job.
Do not use generic filler phrases. Reference the specific company and role.
Length: 3 paragraphs. Tone: confident, data-driven, direct.`;

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
    return letter;
  }

  async function confirmApplied() {
    if (!_activeApplyLeadId) return;
    _setApplyStatus('Recording application...');
    try {
      const activeLeadId = _activeApplyLeadId;
      const updated = await _fetchJSON('/api/jl/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: activeLeadId }),
      });
      const index = _leads.findIndex(item => _leadId(item) === activeLeadId);
      let appliedLead = updated;
      if (index >= 0) {
        _leads[index] = _mergeUpdatedLead(_leads[index], updated);
        appliedLead = _leads[index];
        _recordJscApplication(appliedLead);
        _renderBodyOnly();
        _updateCount();
      }
      _setApplyStatus('Application recorded.');
      const lead = appliedLead.lead || appliedLead;
      UI.notify(`Application recorded for ${lead.title || lead.role || 'role'} at ${lead.company || 'company'}`, 'success');
      _clearPendingApply(activeLeadId);
      UI.closeModal();
      _activeApplyLeadId = '';
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('duplicate application')) {
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
      role: lead.title,
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

  function acknowledgeDuplicateApply() {
    _setApplyStatus('Duplicate override will be connected in the final apply sync step.', true);
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
    return [
      `Name: ${profile.name || 'Corinne'}`,
      `Email: ${profile.email || profile.student_email || ''}`,
      `Phone: ${profile.phone || ''}`,
      `LinkedIn: ${profile.linkedin || ''}`,
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
    const sources = _sourceHealthItems();
    return `Last updated: ${timestamp ? _formatDateTime(timestamp) : 'not yet run'} | ${_leads.length} leads | Sources: ${sources}`;
  }

  function _sourceHealthItems() {
    const sourceRows = Array.isArray(_health?.sources) ? _health.sources : [];
    return SOURCE_IDS.map(id => {
      const row = sourceRows.find(item => _sourceKey(item) === id);
      const ok = !!row && row.status !== 'error' && Number(row.incoming || row.added || 0) > 0;
      return `<span class="${ok ? 'job-leads-source-ok' : 'job-leads-source-bad'}">${SOURCE_LABELS[id]} ${ok ? '&#10003;' : '&#10005;'}</span>`;
    }).join(' ');
  }

  function _sourceKey(item) {
    return String(item?.source_id || item?.id || item?.source || item?.label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
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

  function _ensureStyles() {
    if (document.getElementById('job-leads-style')) return;
    const style = document.createElement('style');
    style.id = 'job-leads-style';
    style.textContent = `
      .job-leads-page { display:flex; flex-direction:column; gap:16px; }
      .job-leads-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
      .job-leads-health { margin-top:8px; color:var(--text-muted); font-size:12px; line-height:1.5; }
      .job-leads-source-ok { color:var(--success); margin-right:8px; white-space:nowrap; }
      .job-leads-source-bad { color:var(--danger); margin-right:8px; white-space:nowrap; }
      .job-leads-filter-row { display:flex; gap:12px; align-items:end; flex-wrap:wrap; }
      .job-leads-filter-row label { display:flex; flex-direction:column; gap:4px; color:var(--text-muted); font-size:12px; font-weight:700; }
      .job-leads-filter-row select { min-width:130px; }
      .job-leads-count { margin-left:auto; color:var(--text-muted); font-size:13px; padding-bottom:8px; }
      .job-leads-pending-apply-banner { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid rgba(184,137,29,0.5); border-radius:8px; background:rgba(184,137,29,0.12); color:var(--text); }
      .job-leads-pending-apply-banner strong { display:block; margin-bottom:3px; }
      .job-leads-pending-apply-status { margin-top:5px; font-size:12px; color:var(--text-muted); }
      .job-leads-pending-apply-status.success { color:var(--success); }
      .job-leads-pending-apply-status.error { color:var(--danger); }
      .job-leads-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
      .job-lead-card { display:flex; flex-direction:column; gap:10px; min-height:230px; }
      .job-lead-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
      .job-lead-score { display:inline-flex; align-items:center; justify-content:center; min-width:44px; height:30px; border-radius:999px; font-weight:900; color:#fff; }
      .job-lead-score.tier-one { background:var(--success); }
      .job-lead-score.tier-two { background:#b8891d; }
      .job-lead-score.tier-three { background:#6b7280; }
      .job-lead-pill { border-radius:999px; padding:4px 8px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .state-pending-review { background:rgba(59,130,246,0.18); color:#60a5fa; }
      .state-approved { background:rgba(34,197,94,0.18); color:var(--success); }
      .state-rejected { background:rgba(239,68,68,0.18); color:var(--danger); }
      .state-applied { background:rgba(168,85,247,0.18); color:#c084fc; }
      .job-lead-company { font-size:17px; font-weight:900; color:var(--text); }
      .job-lead-role { color:var(--text); line-height:1.35; }
      .job-lead-meta { display:flex; justify-content:space-between; gap:8px; color:var(--text-muted); font-size:12px; }
      .job-lead-detail-row { display:flex; justify-content:space-between; gap:10px; color:var(--text-muted); font-size:12px; border-top:1px solid var(--border); padding-top:8px; }
      .job-lead-detail-row strong { color:var(--text); text-align:right; }
      .job-lead-actions { margin-top:auto; display:flex; justify-content:space-between; gap:8px; align-items:center; }
      .job-lead-review-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .job-lead-approve-btn { background:var(--success); border-color:var(--success); color:#fff; }
      .job-lead-reject-btn { background:var(--danger); border-color:var(--danger); color:#fff; }
      .job-lead-apply-btn { background:var(--gold); border-color:var(--gold); color:#111827; }
      .job-lead-inline-error { color:var(--danger); font-size:12px; line-height:1.35; border-top:1px solid var(--border); padding-top:8px; }
      .job-lead-apply-modal { display:flex; flex-direction:column; gap:16px; min-width:min(560px, calc(100vw - 56px)); }
      .job-lead-apply-section { border:1px solid var(--border); border-radius:8px; padding:14px; background:rgba(255,255,255,0.03); }
      body.light .job-lead-apply-section { background:rgba(255,255,255,0.72); }
      .job-lead-apply-section-title { color:var(--gold); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
      .job-lead-apply-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .job-lead-apply-note { margin:10px 0 0; color:var(--text); line-height:1.5; }
      .job-lead-apply-status { min-height:18px; margin-top:10px; color:var(--text-muted); font-size:13px; line-height:1.45; }
      .job-lead-apply-status.success { color:var(--success); }
      .job-lead-apply-status.error { color:var(--danger); }
      .job-lead-cover-loading { display:flex; align-items:center; gap:10px; color:var(--text-muted); margin-bottom:10px; }
      .job-lead-cover-text { width:100%; min-height:180px; resize:vertical; margin-bottom:10px; }
      .hidden { display:none !important; }
      .job-lead-source-tag { color:var(--gold); font-size:11px; font-weight:800; text-transform:uppercase; }
      .job-leads-loading, .job-leads-error { display:flex; align-items:center; justify-content:center; min-height:180px; gap:12px; text-align:center; }
      .job-leads-error { flex-direction:column; color:var(--text); }
      .job-leads-spinner { width:24px; height:24px; border-radius:50%; border:3px solid var(--border); border-top-color:var(--gold); animation:jobLeadsSpin 0.8s linear infinite; }
      @keyframes jobLeadsSpin { to { transform:rotate(360deg); } }
      @media (max-width:760px) {
        .job-leads-header { flex-direction:column; }
        .job-leads-count { margin-left:0; }
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
    openJob,
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
  };
})();
