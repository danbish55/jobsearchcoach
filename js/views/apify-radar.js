/* LinkedIn Radar view — powered by Apify */
const ApifyRadar = (() => {
  let _jobs         = [];
  let _filterText   = '';
  let _filterState  = 'all';
  let _scraping     = false;
  let _lastFetchAt  = null;
  let _cache        = null;
  let _cacheKey     = '';

  // ── Styles ──────────────────────────────────────────────────────────────

  function _ensureStyles() {
    if (document.getElementById('apify-radar-style')) return;
    const style = document.createElement('style');
    style.id = 'apify-radar-style';
    style.textContent = `
      #apify-radar-content .ar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 18px;
      }
      #apify-radar-content .ar-title { font-size: 20px; font-weight: 700; }
      #apify-radar-content .ar-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
      #apify-radar-content .ar-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 14px;
      }
      #apify-radar-content .ar-search {
        flex: 1;
        min-width: 180px;
        max-width: 320px;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--card-bg);
        color: var(--text);
        font-size: 13px;
      }
      #apify-radar-content .ar-filter-btn {
        padding: 5px 12px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-muted);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      #apify-radar-content .ar-filter-btn.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }
      #apify-radar-content .ar-count {
        font-size: 12px;
        color: var(--text-muted);
        margin-left: auto;
        white-space: nowrap;
      }
      #apify-radar-content .ar-table-wrap {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      #apify-radar-content .ar-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        min-width: 820px;
      }
      #apify-radar-content .ar-table th {
        background: rgba(255,255,255,0.04);
        padding: 9px 10px;
        text-align: left;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      #apify-radar-content .ar-table td {
        padding: 9px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        vertical-align: middle;
      }
      #apify-radar-content .ar-table tr:last-child td { border-bottom: 0; }
      #apify-radar-content .ar-table tr.ar-row-excellent { background: rgba(46,204,113,0.07); }
      #apify-radar-content .ar-table tr.ar-row-strong   { background: rgba(255,204,0,0.05); }
      #apify-radar-content .ar-table tr.ar-row-approved { opacity: 0.7; }
      #apify-radar-content .ar-table tr.ar-row-rejected { opacity: 0.4; }

      #apify-radar-content .ar-score-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        min-width: 36px;
        text-align: center;
      }
      #apify-radar-content .ar-score-pill.excellent { background: rgba(46,204,113,0.22); color: #2ecc71; }
      #apify-radar-content .ar-score-pill.strong    { background: rgba(255,204,0,0.18);  color: #ffc107; }
      #apify-radar-content .ar-score-pill.moderate  { background: rgba(255,255,255,0.07); color: var(--text-muted); }

      #apify-radar-content .ar-state-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      #apify-radar-content .ar-state-pill.pending  { background: rgba(255,255,255,0.07); color: var(--text-muted); }
      #apify-radar-content .ar-state-pill.approved { background: rgba(46,204,113,0.18); color: #2ecc71; }
      #apify-radar-content .ar-state-pill.rejected { background: rgba(231,76,60,0.18);  color: #e74c3c; }

      #apify-radar-content .ar-job-title a {
        color: var(--text);
        text-decoration: none;
        font-weight: 600;
      }
      #apify-radar-content .ar-job-title a:hover { color: var(--gold); text-decoration: underline; }
      #apify-radar-content .ar-company  { color: var(--text-muted); font-size: 12px; }
      #apify-radar-content .ar-location { color: var(--text-muted); font-size: 12px; }
      #apify-radar-content .ar-actions  { display: flex; gap: 5px; flex-wrap: nowrap; }
      #apify-radar-content .ar-btn {
        padding: 3px 9px;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-muted);
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }
      #apify-radar-content .ar-btn:hover       { border-color: var(--gold); color: var(--gold); }
      #apify-radar-content .ar-btn.approve:hover { border-color: #2ecc71; color: #2ecc71; }
      #apify-radar-content .ar-btn.reject:hover  { border-color: #e74c3c; color: #e74c3c; }
      #apify-radar-content .ar-btn.active-approve { border-color: #2ecc71; color: #2ecc71; background: rgba(46,204,113,0.1); }
      #apify-radar-content .ar-btn.active-reject  { border-color: #e74c3c; color: #e74c3c; background: rgba(231,76,60,0.1); }

      #apify-radar-content .ar-fire { margin-left: 4px; }
      #apify-radar-content .ar-empty {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-muted);
        font-size: 15px;
      }
      #apify-radar-content .ar-empty-sub {
        font-size: 12px;
        margin-top: 8px;
        color: var(--text-muted);
        opacity: 0.7;
      }
      #apify-radar-content .ar-scrape-spinner {
        display: inline-block;
        width: 12px; height: 12px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: var(--text);
        border-radius: 50%;
        animation: ar-spin 0.7s linear infinite;
        vertical-align: middle;
        margin-right: 5px;
      }
      @keyframes ar-spin { to { transform: rotate(360deg); } }
      #apify-radar-content .ar-rank { color: var(--text-muted); font-variant-numeric: tabular-nums; }
      #apify-radar-content .ar-salary { font-size: 12px; color: #2ecc71; }
      #apify-radar-content .ar-posted { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
      #apify-radar-content .ar-applicants { font-variant-numeric: tabular-nums; font-size: 12px; }
      #apify-radar-content .ar-breakdown-tip {
        font-size: 11px; color: var(--text-muted); cursor: help;
        border-bottom: 1px dashed var(--text-muted);
      }
      body.light #apify-radar-content .ar-table th { background: rgba(0,0,0,0.04); }
      body.light #apify-radar-content .ar-table td { border-bottom-color: rgba(0,0,0,0.06); }
      body.light #apify-radar-content .ar-table tr.ar-row-excellent { background: rgba(46,204,113,0.06); }
      body.light #apify-radar-content .ar-table tr.ar-row-strong   { background: rgba(255,204,0,0.06); }
    `;
    document.head.appendChild(style);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    _ensureStyles();
    const container = document.getElementById('apify-radar-content');
    if (!container) return;
    container.innerHTML = `
      <div class="ar-header">
        <div>
          <div class="ar-title">Job Board Scraper</div>
          <div class="ar-subtitle" id="ar-subtitle">Loading…</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" id="ar-rescrape-btn" onclick="ApifyRadar.reScrape()">📡 Re-Scrape LinkedIn</button>
        </div>
      </div>
      <div class="ar-controls">
        <input class="ar-search" id="ar-search" type="text" placeholder="Search title, company, location…"
          oninput="ApifyRadar.applyFilter()" value="">
        <button class="ar-filter-btn active" id="ar-f-all"      onclick="ApifyRadar.setStateFilter('all')">All</button>
        <button class="ar-filter-btn"        id="ar-f-pending"  onclick="ApifyRadar.setStateFilter('pending_review')">Pending</button>
        <button class="ar-filter-btn"        id="ar-f-approved" onclick="ApifyRadar.setStateFilter('approved')">Approved</button>
        <button class="ar-filter-btn"        id="ar-f-rejected" onclick="ApifyRadar.setStateFilter('rejected')">Rejected</button>
        <span class="ar-count" id="ar-count"></span>
      </div>
      <div id="ar-body"></div>`;
    _loadJobs();
  }

  async function _loadJobs() {
    try {
      const resp = await fetch('/api/apify/output');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Load failed');
      _jobs = Array.isArray(data) ? data : [];
      _lastFetchAt = _jobs.length ? 'cached' : null;
      _renderBody();
    } catch (err) {
      _setSubtitle('Could not load jobs — ' + err.message);
      document.getElementById('ar-body').innerHTML =
        `<div class="ar-empty">No data yet.<div class="ar-empty-sub">Click Re-Scrape LinkedIn to fetch fresh jobs.</div></div>`;
    }
  }

  function _renderBody() {
    const filtered = _filteredJobs();
    _updateSubtitle(filtered.length);
    _renderJobTable(filtered);
  }

  function _filteredJobs() {
    const key = `${_filterText}|${_filterState}`;
    if (key === _cacheKey && _cache) return _cache;
    const text = _filterText.toLowerCase();
    const result = _jobs.filter(job => {
      if (_filterState !== 'all' && job.approval_state !== _filterState) return false;
      if (!text) return true;
      return (
        (job.title    || '').toLowerCase().includes(text) ||
        (job.company  || '').toLowerCase().includes(text) ||
        (job.location || '').toLowerCase().includes(text)
      );
    });
    _cache    = result;
    _cacheKey = key;
    return result;
  }

  function _invalidateCache() { _cache = null; _cacheKey = ''; }

  function _updateSubtitle(visibleCount) {
    const total = _jobs.length;
    if (!total) {
      _setSubtitle('No jobs loaded yet. Click Re-Scrape to fetch from LinkedIn.');
      return;
    }
    const pending  = _jobs.filter(j => j.approval_state === 'pending_review').length;
    const approved = _jobs.filter(j => j.approval_state === 'approved').length;
    _setSubtitle(
      `${total} jobs · ${pending} pending · ${approved} approved · Showing ${visibleCount}`
    );
    const countEl = document.getElementById('ar-count');
    if (countEl) countEl.textContent = `${visibleCount} of ${total}`;
  }

  function _setSubtitle(text) {
    const el = document.getElementById('ar-subtitle');
    if (el) el.textContent = text;
  }

  function _renderJobTable(filtered) {
    const body = document.getElementById('ar-body');
    if (!body) return;
    if (!filtered.length) {
      body.innerHTML = `<div class="ar-empty">No jobs match your filters.<div class="ar-empty-sub">Try a different search or state filter.</div></div>`;
      return;
    }
    const rows = filtered.map((job, idx) => _jobRowHTML(job, idx + 1)).join('');
    body.innerHTML = `
      <div class="ar-table-wrap">
        <table class="ar-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Score</th>
              <th>Job Title</th>
              <th>Company</th>
              <th>Location</th>
              <th>Type</th>
              <th>Level</th>
              <th>Salary</th>
              <th>Applicants</th>
              <th>Posted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="ar-tbody">${rows}</tbody>
        </table>
      </div>`;
  }

  function _jobRowHTML(job, rank) {
    const score   = job.score || 0;
    const state   = job.approval_state || 'pending_review';
    const bd      = job.score_breakdown || {};

    const scoreCls = score >= 90 ? 'excellent' : score >= 70 ? 'strong' : 'moderate';
    const rowCls   = [
      score >= 90 ? 'ar-row-excellent' : score >= 70 ? 'ar-row-strong' : '',
      state === 'approved' ? 'ar-row-approved' : state === 'rejected' ? 'ar-row-rejected' : '',
    ].filter(Boolean).join(' ');

    const stateCls   = state === 'approved' ? 'approved' : state === 'rejected' ? 'rejected' : 'pending';
    const stateLabel = state === 'approved' ? 'Approved' : state === 'rejected' ? 'Rejected' : 'Pending';

    const applicants = job.applicantsCount != null ? job.applicantsCount : '—';
    const fire       = (job.applicantsCount || 0) >= 200 ? '<span class="ar-fire" title="200+ applicants">🔥</span>' : '';

    const salary  = job.salary  ? `<span class="ar-salary">${_esc(job.salary)}</span>` : '<span style="color:var(--text-muted)">—</span>';
    const posted  = _formatPosted(job.postedAt);
    const title   = job.url
      ? `<a href="${_esc(job.url)}" target="_blank" rel="noopener">${_esc(job.title || 'Untitled')}</a>`
      : _esc(job.title || 'Untitled');

    const tipText = `Skills ${bd.skills||0} · Exp ${bd.experience||0} · Title ${bd.trajectory||0} · Pref ${bd.preference||0}`;

    const approveActive = state === 'approved' ? 'active-approve' : '';
    const rejectActive  = state === 'rejected' ? 'active-reject'  : '';

    return `<tr class="${rowCls}" id="ar-row-${_esc(job.id)}">
      <td class="ar-rank">${rank}</td>
      <td>
        <span class="ar-score-pill ${scoreCls}" title="${tipText}">${score}</span>
      </td>
      <td class="ar-job-title">${title}</td>
      <td class="ar-company">${_esc(job.company || '—')}</td>
      <td class="ar-location">${_esc(job.location || '—')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${_esc(job.employmentType || '—')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${_esc(job.seniorityLevel || '—')}</td>
      <td>${salary}</td>
      <td class="ar-applicants">${applicants}${fire}</td>
      <td class="ar-posted">${posted}</td>
      <td><span class="ar-state-pill ${stateCls}">${stateLabel}</span></td>
      <td class="ar-actions">
        <button class="ar-btn approve ${approveActive}" onclick="ApifyRadar.approveJob('${_esc(job.id)}')" title="Approve">✓</button>
        <button class="ar-btn reject ${rejectActive}"  onclick="ApifyRadar.rejectJob('${_esc(job.id)}')"  title="Reject">✗</button>
        <button class="ar-btn"                         onclick="ApifyRadar.deleteJob('${_esc(job.id)}')"  title="Delete">🗑</button>
      </td>
    </tr>`;
  }

  // ── State transitions ────────────────────────────────────────────────────

  async function approveJob(jobId) {
    await _transition(jobId, 'approved');
  }

  async function rejectJob(jobId) {
    await _transition(jobId, 'rejected');
  }

  async function _transition(jobId, newState) {
    const job = _jobs.find(j => j.id === jobId);
    if (!job) return;

    const prevState   = job.approval_state;
    const nextState   = job.approval_state === newState ? 'pending_review' : newState;
    job.approval_state = nextState;
    _invalidateCache();
    _renderBody();

    try {
      const resp = await fetch('/api/apify/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: jobId, state: nextState }),
      });
      if (!resp.ok) throw new Error('Server error');
    } catch {
      job.approval_state = prevState;
      _invalidateCache();
      _renderBody();
      UI.notify('Could not save state', 'error');
    }
  }

  async function deleteJob(jobId) {
    const job = _jobs.find(j => j.id === jobId);
    if (!job) return;

    const prevJobs = [..._jobs];
    _jobs = _jobs.filter(j => j.id !== jobId);
    _invalidateCache();
    _renderBody();

    try {
      const resp = await fetch('/api/apify/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: jobId }),
      });
      if (!resp.ok) throw new Error('Server error');
    } catch {
      _jobs = prevJobs;
      _invalidateCache();
      _renderBody();
      UI.notify('Could not delete job', 'error');
    }
  }

  // ── Re-Scrape ────────────────────────────────────────────────────────────

  async function reScrape() {
    if (_scraping) return;
    _scraping = true;
    const btn = document.getElementById('ar-rescrape-btn');
    if (btn) btn.innerHTML = '<span class="ar-scrape-spinner"></span> Scraping LinkedIn… (up to 5 min)';
    if (btn) btn.disabled = true;
    _setSubtitle('Scraping LinkedIn via Apify — please wait…');

    try {
      const resp = await fetch('/api/apify/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await resp.json();
      if (!resp.ok || data.ok === false) throw new Error(data.error || 'Scrape failed');
      UI.notify(`Scraped ${data.count} jobs from LinkedIn`, 'success');
      await _loadJobs();
    } catch (err) {
      UI.notify('Scrape failed: ' + err.message, 'error');
      _setSubtitle('Scrape failed — ' + err.message);
    } finally {
      _scraping = false;
      if (btn) { btn.innerHTML = '📡 Re-Scrape LinkedIn'; btn.disabled = false; }
    }
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  function applyFilter() {
    const input = document.getElementById('ar-search');
    _filterText = (input ? input.value : '') || '';
    _invalidateCache();
    _renderBody();
  }

  function setStateFilter(state) {
    _filterState = state;
    _invalidateCache();
    ['all', 'pending_review', 'approved', 'rejected'].forEach(s => {
      const id  = s === 'pending_review' ? 'ar-f-pending' : `ar-f-${s}`;
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', s === state);
    });
    _renderBody();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _formatPosted(raw) {
    if (!raw) return '—';
    const s = String(raw).trim();
    if (/ago|hour|day|week|month/i.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    render,
    approveJob,
    rejectJob,
    deleteJob,
    reScrape,
    applyFilter,
    setStateFilter,
  };
})();
