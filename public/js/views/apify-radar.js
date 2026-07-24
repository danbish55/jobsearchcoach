/* LinkedIn Radar view — powered by Apify */
const ApifyRadar = (() => {
  let _jobs        = [];
  let _filterText  = '';
  let _filterState = 'all';
  let _sortBy      = 'score';
  let _sortDir     = 'desc';
  let _scraping         = false;
  let _cache            = null;
  let _cacheKey         = '';
  let _resizing         = null;
  let _activeApplyJobId = '';
  const _colWidths      = {};   // col key → saved px width (survives re-renders)

  // ── Styles ───────────────────────────────────────────────────────────────

  function _ensureStyles() {
    if (document.getElementById('apify-radar-style')) return;
    const s = document.createElement('style');
    s.id = 'apify-radar-style';
    s.textContent = `

      /* ── Layout ── */
      #apify-radar-content .ar-header {
        display: flex; align-items: center; justify-content: space-between;
        flex-wrap: wrap; gap: 10px; margin-bottom: 18px;
      }
      #apify-radar-content .ar-title  { font-size: 20px; font-weight: 700; }
      #apify-radar-content .ar-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
      #apify-radar-content .ar-controls {
        display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px;
      }
      #apify-radar-content .ar-search {
        flex: 1; min-width: 180px; max-width: 320px;
        padding: 6px 10px; border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--card-bg); color: var(--text); font-size: 13px;
      }
      #apify-radar-content .ar-filter-btn {
        padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border);
        background: transparent; color: var(--text-muted); font-size: 12px;
        cursor: pointer; transition: all 0.15s;
      }
      #apify-radar-content .ar-filter-btn.active {
        background: var(--accent); color: #fff; border-color: var(--accent);
      }
      #apify-radar-content .ar-count {
        font-size: 12px; color: var(--text-muted); margin-left: auto; white-space: nowrap;
      }

      /* ── Table wrapper — scrolls both axes; sticky header lives here ── */
      #apify-radar-content .ar-table-wrap {
        overflow: auto;
        max-height: calc(100vh - 210px);
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      /* ── Table ── */
      #apify-radar-content .ar-table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        font-size: 13px;
        min-width: 1100px;
      }

      /* ── Sticky header ── */
      #apify-radar-content .ar-table th {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #1e1e1e;          /* matches app dark bg exactly */
        padding: 9px 10px;
        text-align: left;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        border-bottom: 2px solid var(--border);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        user-select: none;
      }
      body.light #apify-radar-content .ar-table th {
        background: #f2f2f2;          /* matches app light bg exactly */
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      }

      /* ── Sortable header cells ── */
      #apify-radar-content .ar-table th.ar-sortable { cursor: pointer; }
      #apify-radar-content .ar-table th.ar-sortable:hover { color: var(--gold, #ffc107); }
      #apify-radar-content .ar-table th.ar-col-active { color: var(--text); }
      #apify-radar-content .ar-sort-arrow { margin-left: 3px; font-size: 10px; opacity: 0.9; }

      /* ── Column resize handle ── */
      #apify-radar-content .ar-col-resize {
        position: absolute;
        right: 0; top: 0; bottom: 0;
        width: 5px;
        cursor: col-resize;
        z-index: 11;
      }
      #apify-radar-content .ar-col-resize:hover,
      #apify-radar-content .ar-col-resize:active {
        background: rgba(255,204,0,0.35);
      }
      /* Each th needs relative so the resize handle positions inside it */
      #apify-radar-content .ar-table th { position: relative; }

      /* ── Body rows ── */
      #apify-radar-content .ar-table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        vertical-align: middle;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      #apify-radar-content .ar-table tr:last-child td { border-bottom: 0; }

      /* ── 1. Alternating rows — ledger style ── */
      #apify-radar-content .ar-table tbody tr:nth-child(odd)  { background: transparent; }
      #apify-radar-content .ar-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.028); }

      /* Score-highlight rows: slightly different shade on even to keep ledger rhythm */
      #apify-radar-content .ar-table tbody tr.ar-row-garnet:nth-child(odd)  { background: rgba(153,0,0,0.12); }
      #apify-radar-content .ar-table tbody tr.ar-row-garnet:nth-child(even) { background: rgba(153,0,0,0.18); }
      #apify-radar-content .ar-table tbody tr.ar-row-gold:nth-child(odd)    { background: rgba(255,204,0,0.05); }
      #apify-radar-content .ar-table tbody tr.ar-row-gold:nth-child(even)   { background: rgba(255,204,0,0.09); }

      #apify-radar-content .ar-table tbody tr.ar-row-approved { opacity: 0.65; }
      #apify-radar-content .ar-table tbody tr.ar-row-rejected { opacity: 0.35; }
      #apify-radar-content .ar-table tbody tr.ar-row-applied  { opacity: 0.55; }

      body.light #apify-radar-content .ar-table td { border-bottom-color: rgba(0,0,0,0.05); }
      body.light #apify-radar-content .ar-table tbody tr:nth-child(even)           { background: rgba(0,0,0,0.03); }
      body.light #apify-radar-content .ar-table tbody tr.ar-row-garnet:nth-child(odd)  { background: rgba(153,0,0,0.06); }
      body.light #apify-radar-content .ar-table tbody tr.ar-row-garnet:nth-child(even) { background: rgba(153,0,0,0.10); }
      body.light #apify-radar-content .ar-table tbody tr.ar-row-gold:nth-child(odd)    { background: rgba(180,130,0,0.06); }
      body.light #apify-radar-content .ar-table tbody tr.ar-row-gold:nth-child(even)   { background: rgba(180,130,0,0.10); }

      /* ── 2. Score pills — USC Garnet & Gold ── */
      #apify-radar-content .ar-score-pill {
        display: inline-block; padding: 2px 8px; border-radius: 10px;
        font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums;
        min-width: 36px; text-align: center;
      }
      /* ≥75 — USC Garnet */
      #apify-radar-content .ar-score-pill.garnet {
        background: rgba(153,0,0,0.38); color: #FF9999;
        border: 1px solid rgba(153,0,0,0.6);
      }
      /* ≥60 — USC Gold */
      #apify-radar-content .ar-score-pill.gold {
        background: rgba(255,204,0,0.18); color: #FFCC00;
        border: 1px solid rgba(255,204,0,0.35);
      }
      /* <60 — Neutral */
      #apify-radar-content .ar-score-pill.moderate {
        background: rgba(255,255,255,0.07); color: var(--text-muted);
        border: 1px solid transparent;
      }
      body.light #apify-radar-content .ar-score-pill.garnet {
        background: rgba(153,0,0,0.1); color: #8B0000; border-color: rgba(153,0,0,0.3);
      }
      body.light #apify-radar-content .ar-score-pill.gold {
        background: rgba(180,130,0,0.12); color: #7A5800; border-color: rgba(180,130,0,0.3);
      }
      body.light #apify-radar-content .ar-score-pill.moderate {
        background: rgba(0,0,0,0.05); color: var(--text-muted); border-color: transparent;
      }

      /* ── State pills ── */
      #apify-radar-content .ar-state-pill {
        display: inline-block; padding: 2px 8px; border-radius: 10px;
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      }
      #apify-radar-content .ar-state-pill.pending  { background: rgba(255,255,255,0.07); color: var(--text-muted); }
      #apify-radar-content .ar-state-pill.approved { background: rgba(46,204,113,0.18);  color: #2ecc71; }
      #apify-radar-content .ar-state-pill.rejected { background: rgba(231,76,60,0.18);   color: #e74c3c; }
      #apify-radar-content .ar-state-pill.applied  { background: rgba(52,152,219,0.18);  color: #3498db; }

      /* ── Cell content styles ── */
      #apify-radar-content .ar-job-title a {
        color: var(--text); text-decoration: none; font-weight: 600;
      }
      #apify-radar-content .ar-job-title a:hover { color: var(--gold, #ffc107); text-decoration: underline; }
      #apify-radar-content .ar-muted  { color: var(--text-muted); font-size: 12px; }
      #apify-radar-content .ar-salary { font-size: 12px; color: #2ecc71; }
      #apify-radar-content .ar-posted { font-size: 12px; color: var(--text-muted); }
      #apify-radar-content .ar-fire   { margin-left: 3px; }

      /* ── Action buttons ── */
      #apify-radar-content .ar-actions { display: flex; gap: 4px; flex-wrap: nowrap; }
      #apify-radar-content .ar-btn {
        padding: 3px 8px; border-radius: 5px;
        border: 1px solid var(--border); background: transparent;
        color: var(--text-muted); font-size: 11px; cursor: pointer;
        transition: all 0.15s; white-space: nowrap;
      }
      #apify-radar-content .ar-btn:hover           { border-color: var(--gold, #ffc107); color: var(--gold, #ffc107); }
      #apify-radar-content .ar-btn.approve:hover   { border-color: #2ecc71; color: #2ecc71; }
      #apify-radar-content .ar-btn.reject:hover    { border-color: #e74c3c; color: #e74c3c; }
      #apify-radar-content .ar-btn.apply-btn:hover { border-color: #3498db; color: #3498db; }
      #apify-radar-content .ar-btn.active-approve  { border-color: #2ecc71; color: #2ecc71; background: rgba(46,204,113,0.1); }
      #apify-radar-content .ar-btn.active-reject   { border-color: #e74c3c; color: #e74c3c; background: rgba(231,76,60,0.1); }
      #apify-radar-content .ar-btn.active-apply    { border-color: #3498db; color: #3498db; background: rgba(52,152,219,0.1); }

      /* ── Empty / spinner ── */
      #apify-radar-content .ar-empty {
        text-align: center; padding: 60px 20px; color: var(--text-muted); font-size: 15px;
      }
      #apify-radar-content .ar-empty-sub { font-size: 12px; margin-top: 8px; opacity: 0.7; }
      #apify-radar-content .ar-scrape-spinner {
        display: inline-block; width: 12px; height: 12px;
        border: 2px solid rgba(255,255,255,0.3); border-top-color: var(--text);
        border-radius: 50%; animation: ar-spin 0.7s linear infinite;
        vertical-align: middle; margin-right: 5px;
      }
      @keyframes ar-spin { to { transform: rotate(360deg); } }
      #apify-radar-content .ar-rank { color: var(--text-muted); font-variant-numeric: tabular-nums; }

      /* ── Board source badges ── */
      #apify-radar-content .ar-board-badge {
        display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
        padding: 2px 5px; border-radius: 4px; color: #fff; vertical-align: middle;
        line-height: 1.4; white-space: nowrap;
      }
      #apify-radar-content .ar-board-badge.li  { background: #0A66C2; }  /* LinkedIn blue   */
      #apify-radar-content .ar-board-badge.in  { background: #E8600A; }  /* Indeed orange   */
      #apify-radar-content .ar-board-badge.gd  { background: #0CAA41; }  /* Glassdoor green */
      #apify-radar-content .ar-board-badge.go  { background: #C5221F; }  /* Google red      */
      #apify-radar-content .ar-board-badge.zr  { background: #7C3AED; }  /* ZipRecruiter purple */
      #apify-radar-content .ar-board-badge.by  { background: #CC2229; }
      #apify-radar-content .ar-board-badge.bd  { background: #1E5F8C; }
      #apify-radar-content .ar-board-badge.nk  { background: #E05A2B; }
      #apify-radar-content .ar-board-badge.unknown { background: #888; }

      /* ── Board legend strip ── */
      #apify-radar-content .ar-board-legend {
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        font-size: 12px; color: var(--text-muted);
        margin-bottom: 10px;
      }
      #apify-radar-content .ar-board-legend-item {
        display: flex; align-items: center; gap: 5px;
      }
    `;
    document.head.appendChild(s);
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
          <button class="btn btn-ghost btn-sm" id="ar-rescrape-btn" onclick="ApifyRadar.reScrape()">📡 Re-Scrape All Boards</button>
        </div>
      </div>
      <div class="ar-controls">
        <input class="ar-search" id="ar-search" type="text"
          placeholder="Search title, company, location…" oninput="ApifyRadar.applyFilter()">
        <button class="ar-filter-btn active" id="ar-f-all"      onclick="ApifyRadar.setStateFilter('all')">All</button>
        <button class="ar-filter-btn"        id="ar-f-pending"  onclick="ApifyRadar.setStateFilter('pending_review')">Pending</button>
        <button class="ar-filter-btn"        id="ar-f-approved" onclick="ApifyRadar.setStateFilter('approved')">Approved</button>
        <button class="ar-filter-btn"        id="ar-f-rejected" onclick="ApifyRadar.setStateFilter('rejected')">Rejected</button>
        <button class="ar-filter-btn"        id="ar-f-applied"  onclick="ApifyRadar.setStateFilter('applied')">Applied</button>
        <span class="ar-count" id="ar-count"></span>
      </div>
      <div class="ar-board-legend">
        <span style="font-weight:600">Sources:</span>
        <span class="ar-board-legend-item"><span class="ar-board-badge li">LI</span> LinkedIn</span>
        <span class="ar-board-legend-item"><span class="ar-board-badge in">IN</span> Indeed</span>
        <span class="ar-board-legend-item"><span class="ar-board-badge gd">GD</span> Glassdoor</span>
        <span class="ar-board-legend-item"><span class="ar-board-badge go">GO</span> Google Jobs</span>
        <span class="ar-board-legend-item"><span class="ar-board-badge zr">ZR</span> ZipRecruiter</span>
      </div>
      <div id="ar-body"></div>`;
    _loadJobs();
  }

  async function _loadJobs() {
    try {
      const resp = await fetch('/api/apify/output');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Load failed');
      let jobs = Array.isArray(data) ? data : [];

      if (!jobs.length) {
        try { const s = localStorage.getItem('jsc_apify_jobs'); if (s) jobs = JSON.parse(s); } catch {}
      }

      const localStates = _loadLocalStates();
      jobs.forEach(j => { j.approval_state = localStates[j.id] || j.approval_state || 'pending_review'; });

      _jobs = jobs;
      _renderBody();
    } catch (err) {
      _setSubtitle('Could not load jobs — ' + err.message);
      document.getElementById('ar-body').innerHTML =
        `<div class="ar-empty">No data yet.<div class="ar-empty-sub">Click Re-Scrape All Boards to fetch fresh jobs.</div></div>`;
    }
  }

  function _renderBody() {
    const filtered = _filteredAndSorted();
    _updateSubtitle(filtered.length);
    _renderJobTable(filtered);
  }

  // ── Filtering & sorting ──────────────────────────────────────────────────

  function _filteredAndSorted() {
    const key = `${_filterText}|${_filterState}|${_sortBy}|${_sortDir}`;
    if (key === _cacheKey && _cache) return _cache;

    const text = _filterText.toLowerCase();
    let result = _jobs.filter(job => {
      if (_filterState !== 'all' && job.approval_state !== _filterState) return false;
      if (!text) return true;
      return (
        (job.title    || '').toLowerCase().includes(text) ||
        (job.company  || '').toLowerCase().includes(text) ||
        (job.location || '').toLowerCase().includes(text)
      );
    });

    result = result.slice().sort((a, b) => {
      let va = _sortVal(a, _sortBy);
      let vb = _sortVal(b, _sortBy);
      if (_sortDir === 'desc') { const t = va; va = vb; vb = t; }
      if (va === vb) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return va < vb ? -1 : 1;
    });

    _cache = result;
    _cacheKey = key;
    return result;
  }

  function _sortVal(job, col) {
    switch (col) {
      case 'score':          return job.score ?? 0;
      case 'title':          return (job.title    || '').toLowerCase();
      case 'company':        return (job.company  || '').toLowerCase();
      case 'location':       return (job.location || '').toLowerCase();
      case 'employmentType': return (job.employmentType  || '').toLowerCase();
      case 'seniorityLevel': return (job.seniorityLevel  || '').toLowerCase();
      case 'salary':         return (job.salary   || '');
      case 'applicantsCount': return job.applicantsCount ?? -1;
      case 'site':           return (job.site || '').toLowerCase();
      case 'postedAt':       return job.postedAt  || '';
      case 'approval_state': return job.approval_state || '';
      default:               return job.score ?? 0;
    }
  }

  function sortBy(col) {
    if (_sortBy === col) {
      _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      _sortBy  = col;
      _sortDir = (col === 'score' || col === 'applicantsCount') ? 'desc' : 'asc';
    }
    _invalidateCache();
    _renderBody();
  }

  function _invalidateCache() { _cache = null; _cacheKey = ''; }

  // ── Subtitle ─────────────────────────────────────────────────────────────

  function _updateSubtitle(visibleCount) {
    const total    = _jobs.length;
    if (!total) { _setSubtitle('No jobs loaded yet. Click Re-Scrape All Boards to fetch fresh jobs.'); return; }
    const pending  = _jobs.filter(j => j.approval_state === 'pending_review').length;
    const approved = _jobs.filter(j => j.approval_state === 'approved').length;
    const applied  = _jobs.filter(j => j.approval_state === 'applied').length;
    _setSubtitle(
      `${total} jobs · ${pending} pending · ${approved} approved · ${applied} applied · Showing ${visibleCount}`
    );
    const countEl = document.getElementById('ar-count');
    if (countEl) countEl.textContent = `${visibleCount} of ${total}`;
  }

  function _setSubtitle(text) {
    const el = document.getElementById('ar-subtitle');
    if (el) el.textContent = text;
  }

  // ── Table rendering ──────────────────────────────────────────────────────

  const _BOARD_META = {
    linkedin:       { cls: 'li',  label: 'LI', name: 'LinkedIn'     },
    indeed:         { cls: 'in',  label: 'IN', name: 'Indeed'       },
    glassdoor:      { cls: 'gd',  label: 'GD', name: 'Glassdoor'    },
    google:         { cls: 'go',  label: 'GO', name: 'Google Jobs'  },
    google_jobs:    { cls: 'go',  label: 'GO', name: 'Google Jobs'  },
    googlejobs:     { cls: 'go',  label: 'GO', name: 'Google Jobs'  },
    zip_recruiter:  { cls: 'zr',  label: 'ZR', name: 'ZipRecruiter' },
    ziprecruiter:   { cls: 'zr',  label: 'ZR', name: 'ZipRecruiter' },
    bayt:           { cls: 'by',  label: 'BY', name: 'Bayt'         },
    bdjobs:         { cls: 'bd',  label: 'BD', name: 'BDJobs'       },
    bd_jobs:        { cls: 'bd',  label: 'BD', name: 'BDJobs'       },
    naukri:         { cls: 'nk',  label: 'NK', name: 'Naukri'       },
  };
  function _boardBadge(site) {
    const s = (site || '').toLowerCase().replace(/[^a-z_]/g, '');
    const m = _BOARD_META[s];
    if (m) return `<span class="ar-board-badge ${m.cls}" title="${m.name}">${m.label}</span>`;
    return s ? `<span class="ar-board-badge unknown" title="${_esc(site)}">${_esc(site.substring(0,2).toUpperCase())}</span>` : '<span class="ar-muted">—</span>';
  }

  function _thHTML(col, label, defaultW) {
    const w        = _colWidths[col] ? _colWidths[col] + 'px' : defaultW;
    const isActive = _sortBy === col;
    const arrow    = isActive ? (` <span class="ar-sort-arrow">${_sortDir === 'desc' ? '↓' : '↑'}</span>`) : '';
    return `<th class="ar-sortable${isActive ? ' ar-col-active' : ''}"
        data-col="${col}" style="width:${w};min-width:${w}"
        onclick="ApifyRadar.sortBy('${col}')">
      ${_esc(label)}${arrow}
      <span class="ar-col-resize" onmousedown="ApifyRadar.startColResize(event,this)"></span>
    </th>`;
  }

  function _renderJobTable(filtered) {
    const body = document.getElementById('ar-body');
    if (!body) return;
    if (!filtered.length) {
      body.innerHTML = `<div class="ar-empty">No jobs match your filters.<div class="ar-empty-sub">Try a different search or state filter.</div></div>`;
      return;
    }

    const header = `
      <thead>
        <tr>
          <th style="width:36px;min-width:36px">#<span class="ar-col-resize" onmousedown="ApifyRadar.startColResize(event,this)" data-col="_rank"></span></th>
          ${_thHTML('score',          'Score',      '62px')}
          ${_thHTML('site',           'Src',        '52px')}
          ${_thHTML('title',          'Job Title',  '220px')}
          ${_thHTML('company',        'Company',    '130px')}
          ${_thHTML('location',       'Location',   '140px')}
          ${_thHTML('employmentType', 'Type',       '90px')}
          ${_thHTML('seniorityLevel', 'Level',      '90px')}
          ${_thHTML('salary',         'Salary',     '110px')}
          ${_thHTML('applicantsCount','Applicants', '85px')}
          ${_thHTML('postedAt',       'Posted',     '80px')}
          ${_thHTML('approval_state', 'Status',     '80px')}
          <th style="width:155px;min-width:155px">Actions<span class="ar-col-resize" onmousedown="ApifyRadar.startColResize(event,this)" data-col="_actions"></span></th>
        </tr>
      </thead>`;

    const rows = filtered.map((job, idx) => _jobRowHTML(job, idx + 1)).join('');
    body.innerHTML = `
      <div class="ar-table-wrap">
        <table class="ar-table">${header}<tbody>${rows}</tbody></table>
      </div>`;
  }

  function _jobRowHTML(job, rank) {
    const score = job.score || 0;
    const state = job.approval_state || 'pending_review';
    const bd    = job.score_breakdown || {};
    const id    = _esc(job.id);

    // 2. USC Garnet/Gold breakpoints: ≥75 garnet, ≥60 gold, else moderate
    const pillCls = score >= 75 ? 'garnet' : score >= 60 ? 'gold' : 'moderate';
    const rowCls  = [
      score >= 75 ? 'ar-row-garnet' : score >= 60 ? 'ar-row-gold' : '',
      state === 'approved' ? 'ar-row-approved' : state === 'rejected' ? 'ar-row-rejected' : state === 'applied' ? 'ar-row-applied' : '',
    ].filter(Boolean).join(' ');

    const stateCls   = { approved: 'approved', rejected: 'rejected', applied: 'applied' }[state] || 'pending';
    const stateLabel = { approved: 'Approved', rejected: 'Rejected', applied: 'Applied' }[state]  || 'Pending';

    const applicants = job.applicantsCount != null ? job.applicantsCount : '—';
    const fire       = (job.applicantsCount || 0) >= 200 ? '<span class="ar-fire" title="200+ applicants">🔥</span>' : '';
    const salary     = job.salary ? `<span class="ar-salary">${_esc(job.salary)}</span>` : '<span class="ar-muted">—</span>';
    const posted     = _formatPosted(job.postedAt);
    const jobUrl     = job.url || job.urlDirect || '';
    const titleLink  = jobUrl
      ? `<a href="${_esc(jobUrl)}" target="_blank" rel="noopener" title="${_esc(job.title || '')}">${_esc(job.title || 'Untitled')}</a>`
      : _esc(job.title || 'Untitled');

    const tipText = `Skills ${bd.skills||0} · Exp ${bd.experience||0} · Title ${bd.trajectory||0} · Pref ${bd.preference||0}`;

    const approveActive = state === 'approved' ? 'active-approve' : '';
    const rejectActive  = state === 'rejected' ? 'active-reject'  : '';
    const applyActive   = state === 'applied'  ? 'active-apply'   : '';

    return `<tr class="${rowCls}">
      <td class="ar-rank">${rank}</td>
      <td><span class="ar-score-pill ${pillCls}" title="${tipText}">${score}</span></td>
      <td style="text-align:center">${_boardBadge(job.site)}</td>
      <td class="ar-job-title" title="${_esc(job.title || '')}">${titleLink}</td>
      <td class="ar-muted"    title="${_esc(job.company  || '')}">${_esc(job.company  || '—')}</td>
      <td class="ar-muted"    title="${_esc(job.location || '')}">${_esc(job.location || '—')}</td>
      <td class="ar-muted">${_esc(job.employmentType || '—')}</td>
      <td class="ar-muted">${_esc(job.seniorityLevel  || '—')}</td>
      <td>${salary}</td>
      <td style="font-variant-numeric:tabular-nums;font-size:12px">${applicants}${fire}</td>
      <td class="ar-posted">${posted}</td>
      <td><span class="ar-state-pill ${stateCls}">${stateLabel}</span></td>
      <td class="ar-actions">
        <button class="ar-btn approve ${approveActive}" onclick="ApifyRadar.approveJob('${id}')" title="Approve">✓</button>
        <button class="ar-btn reject  ${rejectActive}"  onclick="ApifyRadar.rejectJob('${id}')"  title="Reject">✗</button>
        <button class="ar-btn apply-btn ${applyActive}" onclick="ApifyRadar.applyJob('${id}')"   title="Open &amp; mark Applied">Apply</button>
        <button class="ar-btn"                          onclick="ApifyRadar.deleteJob('${id}')"  title="Delete">🗑</button>
      </td>
    </tr>`;
  }

  // ── Column resize ─────────────────────────────────────────────────────────

  function startColResize(e, handle) {
    e.stopPropagation(); // prevent sort click
    const th = handle.closest('th');
    if (!th) return;
    _resizing = { th, startX: e.clientX, startW: th.offsetWidth };
    document.addEventListener('mousemove', _onResizeMove);
    document.addEventListener('mouseup',   _onResizeEnd);
    e.preventDefault();
  }

  function _onResizeMove(e) {
    if (!_resizing) return;
    const w = Math.max(50, _resizing.startW + (e.clientX - _resizing.startX));
    _resizing.th.style.width    = w + 'px';
    _resizing.th.style.minWidth = w + 'px';
  }

  function _onResizeEnd() {
    if (_resizing) {
      const col = _resizing.th.dataset.col;
      if (col) _colWidths[col] = _resizing.th.offsetWidth;
    }
    _resizing = null;
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup',   _onResizeEnd);
  }

  // ── State transitions ─────────────────────────────────────────────────────

  async function approveJob(jobId) { await _transition(jobId, 'approved'); }
  async function rejectJob(jobId)  { await _transition(jobId, 'rejected'); }

  async function applyJob(jobId) {
    const job = _jobs.find(j => j.id === jobId);
    if (!job) return;

    // 1. Open the posting
    if (job.url) window.open(job.url, '_blank', 'noopener');

    // 2. Copy profile info to clipboard
    try {
      await _arCopyText(_arProfileClipboard());
      UI.notify('Profile info copied to clipboard', 'success');
    } catch {
      UI.notify('Could not copy profile info automatically', 'error');
    }

    // 3. Show the apply modal
    _arShowApplyModal(job);
  }

  // ── Apply modal ───────────────────────────────────────────────────────────

  function _arShowApplyModal(job) {
    _activeApplyJobId = job.id;
    UI.showModal(
      `Applying to ${_esc(job.title || 'role')} at ${_esc(job.company || 'company')}`,
      `<div class="job-lead-apply-modal">
        <section class="job-lead-apply-section">
          <div class="job-lead-apply-section-title">Quick Actions</div>
          <div class="job-lead-apply-actions">
            <button class="btn btn-primary btn-sm" onclick="ApifyRadar.openResumeFolder()">Open Resume Folder</button>
            <button class="btn btn-gold btn-sm" onclick="ApifyRadar.draftCoverLetter()">Draft Cover Letter</button>
          </div>
          <p class="job-lead-apply-note">Profile info copied to clipboard &#10003;</p>
          <div class="job-lead-apply-instructions">
            <strong>Suggested application flow:</strong>
            <ol>
              <li>Draft the cover letter here and save a copy if you want to keep it.</li>
              <li>The job posting is already open — follow the employer's application steps.</li>
              <li>Select the best resume from the resume folder and paste the cover letter if the form asks for one.</li>
              <li>Submit on the job site first, then come back here and click "Yes, I Applied."</li>
            </ol>
          </div>
        </section>

        <section id="ar-cover-section" class="job-lead-apply-section hidden">
          <div class="job-lead-apply-section-title">Cover Letter</div>
          <div id="ar-cover-loading" class="job-lead-cover-loading hidden">
            <span class="job-leads-spinner"></span>
            <span>Drafting cover letter…</span>
          </div>
          <textarea id="ar-cover-text" class="job-lead-cover-text" readonly></textarea>
          <div class="job-lead-apply-actions">
            <button class="btn btn-primary btn-sm" onclick="ApifyRadar.copyCoverLetter()">Copy</button>
            <button class="btn btn-ghost btn-sm"   onclick="ApifyRadar.saveCoverLetter()">Save to Drive</button>
          </div>
        </section>

        <section class="job-lead-apply-section">
          <div class="job-lead-apply-section-title">Confirmation</div>
          <p class="job-lead-apply-note">Once you have submitted the application, record it here.</p>
          <div id="ar-apply-status" class="job-lead-apply-status"></div>
        </section>
      </div>`,
      [
        { id: 'ar-confirm-applied', label: 'Yes, I Applied', class: 'btn-primary', close: false, action: () => ApifyRadar.confirmApplied() },
        { id: 'ar-close-modal',     label: 'Not Yet — Close', class: 'btn-ghost', action: () => UI.closeModal() },
      ],
      { closeOnBackdrop: false }
    );
    document.querySelector('#active-modal .modal')?.classList.add('job-lead-apply-shell');
  }

  async function openResumeFolder() {
    _arSetApplyStatus('Opening resume folder…');
    try {
      const r = await fetch('/api/open-folder?type=resumes').then(res => res.json());
      _arSetApplyStatus(r.path ? `Resume folder opened: ${r.path}` : 'Resume folder opened.');
    } catch (err) {
      _arSetApplyStatus(`Could not open resume folder. ${err.message || ''}`.trim(), true);
    }
  }

  async function draftCoverLetter() {
    const section = document.getElementById('ar-cover-section');
    const loading = document.getElementById('ar-cover-loading');
    const text    = document.getElementById('ar-cover-text');
    if (section) section.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    if (text)    text.value = '';
    try {
      const job    = _jobs.find(j => j.id === _activeApplyJobId);
      if (!job) throw new Error('Job not found');
      const letter = await _arGenerateCoverLetter(job);
      if (text) text.value = letter;
      _arSetApplyStatus('Cover letter drafted.');
    } catch (err) {
      _arSetApplyStatus(err.message || 'Could not draft cover letter.', true);
    } finally {
      if (loading) loading.classList.add('hidden');
    }
  }

  async function _arGenerateCoverLetter(job) {
    const profile    = Storage.get('profile', {});
    const resume     = Storage.get('resume',  {});
    const name       = profile.name || 'Corinne Bish';
    const email      = profile.email || profile.student_email || '';
    const phone      = profile.phone || profile.mobile || '';
    const linkedin   = profile.linkedin || profile.linkedin_url || '';
    const skills     = Array.isArray(profile.skills)
      ? profile.skills.join(', ')
      : (profile.skills || 'data analytics, SQL, dashboards, business intelligence');
    const roles      = Array.isArray(profile.target_roles)
      ? profile.target_roles.join(', ')
      : (profile.target_roles || 'Data Analyst, Business Intelligence Analyst');

    const system = `You are helping Corinne, a recent USC Marshall School of Business MSBA graduate, write a tailored cover letter.

Candidate profile:
- Full name: ${name}
- Email: ${email || 'not available'}
- Phone: ${phone || 'not available'}
- LinkedIn: ${linkedin || 'not available'}
- Degree: MSBA, USC Marshall School of Business
- Skills: ${skills}
- Target roles: ${roles}

Write a professional, specific, and concise cover letter for the following job.
Start with a simple contact header using the available exact candidate details above.
If email, phone, or LinkedIn is not available, omit that missing field entirely.
Sign the letter with the candidate's full name.
Never use placeholders such as [Last Name], [Email], [Phone], [LinkedIn], or "your phone number".
Do not use generic filler phrases. Reference the specific company and role.
Avoid AI-sounding polish, generic enthusiasm, and formulaic phrasing where possible.
Do not use em dashes or long dashes. Use commas, periods, or parentheses instead.
Length: 3 paragraphs. Tone: professional, confident, human, data-driven, and direct.`;

    const user = `Job details:\nCompany: ${job.company || ''}\nRole: ${job.title || ''}\nLocation: ${job.location || ''}\nDescription: ${job.description || ''}`;

    const model = (typeof Config !== 'undefined' && Config.claudeModel) ? Config.claudeModel() : 'claude-haiku-4-5-20251001';
    const resp  = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 900, stream: false, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error?.message || e.error || 'Cover letter generation failed');
    }
    const payload = await resp.json();
    const letter  = (payload.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('\n').trim();
    if (!letter) throw new Error('Claude returned an empty cover letter.');
    return letter;
  }

  async function copyCoverLetter() {
    const text = document.getElementById('ar-cover-text')?.value || '';
    if (!text.trim()) { _arSetApplyStatus('No cover letter to copy yet.', true); return; }
    try { await _arCopyText(text); _arSetApplyStatus('Cover letter copied.'); }
    catch { _arSetApplyStatus('Could not copy cover letter.', true); }
  }

  function saveCoverLetter() {
    const text = document.getElementById('ar-cover-text')?.value || '';
    if (!text.trim()) { _arSetApplyStatus('No cover letter to save yet.', true); return; }
    const job    = _jobs.find(j => j.id === _activeApplyJobId);
    const stored = Storage.get('cover_letters', { items: [] });
    stored.items = [{
      id: `cover_${Date.now()}`, lead_id: _activeApplyJobId,
      company: job?.company || '', role: job?.title || '',
      created_at: new Date().toISOString(), text,
    }, ...(stored.items || [])];
    Storage.set('cover_letters', stored);
    _arSetApplyStatus('Cover letter saved to Drive.');
  }

  async function confirmApplied() {
    if (!_activeApplyJobId) return;
    _arSetApplyStatus('Recording application…');
    try {
      const job = _jobs.find(j => j.id === _activeApplyJobId);
      await _transition(_activeApplyJobId, 'applied');
      // Add to the Applications tracker so it shows up in the Applications view
      if (job && typeof Jobs !== 'undefined') {
        Jobs.addApplication({
          company:        job.company,
          source_lead_id: job.id,
          role:           job.title,
          date:           new Date().toISOString().split('T')[0],
          status:         'applied',
          url:            job.url,
          notes:          `Job Board Scraper · Score: ${job.score} · Skills: ${(job.skills_matched || []).join(', ')}`,
        });
      }
      _arSetApplyStatus('Application recorded.');
      UI.notify(`Application recorded for ${_esc(job?.title || 'role')} at ${_esc(job?.company || 'company')}`, 'success');
      UI.closeModal();
      _activeApplyJobId = '';
    } catch (err) {
      _arSetApplyStatus(err.message || 'Could not record application.', true);
    }
  }

  function _arSetApplyStatus(msg, isError = false) {
    const el = document.getElementById('ar-apply-status');
    if (!el) return;
    el.className = `job-lead-apply-status ${isError ? 'error' : 'success'}`;
    el.textContent = msg;
  }

  function _arProfileClipboard() {
    const profile  = Storage.get('profile', {});
    const name     = profile.name || 'Corinne Bish';
    const email    = profile.email || profile.student_email || '';
    const phone    = profile.phone || profile.mobile || '';
    const linkedin = profile.linkedin || profile.linkedin_url || '';
    return [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, `LinkedIn: ${linkedin}`].join('\n');
  }

  async function _arCopyText(text) {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }

  async function _transition(jobId, newState) {
    const job = _jobs.find(j => j.id === jobId);
    if (!job) return;
    const nextState = job.approval_state === newState ? 'pending_review' : newState;
    job.approval_state = nextState;
    _invalidateCache();
    _renderBody();
    _saveLocalState(jobId, nextState);
    _saveJobsToLocalStorage();
    try {
      await fetch('/api/apify/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: jobId, state: nextState }),
      });
    } catch {}
  }

  async function deleteJob(jobId) {
    _jobs = _jobs.filter(j => j.id !== jobId);
    _invalidateCache();
    _renderBody();
    _saveJobsToLocalStorage();
    const states = _loadLocalStates();
    delete states[jobId];
    try { localStorage.setItem('jsc_apify_states', JSON.stringify(states)); } catch {}
    try {
      await fetch('/api/apify/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: jobId }),
      });
    } catch {}
  }

  // ── localStorage helpers ──────────────────────────────────────────────────

  function _loadLocalStates() {
    try { return JSON.parse(localStorage.getItem('jsc_apify_states') || '{}'); } catch { return {}; }
  }

  function _saveLocalState(jobId, state) {
    const s = _loadLocalStates();
    if (state === 'pending_review') { delete s[jobId]; } else { s[jobId] = state; }
    try { localStorage.setItem('jsc_apify_states', JSON.stringify(s)); } catch {}
  }

  function _saveJobsToLocalStorage() {
    try { localStorage.setItem('jsc_apify_jobs', JSON.stringify(_jobs)); } catch {}
  }

  // ── Re-Scrape (polling) ───────────────────────────────────────────────────

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function reScrape() {
    if (_scraping) return;
    _scraping = true;
    const btn = document.getElementById('ar-rescrape-btn');
    if (btn) { btn.innerHTML = '<span class="ar-scrape-spinner"></span> Starting scrape…'; btn.disabled = true; }
    _setSubtitle('Starting Job Board Scraper via Apify…');

    try {
      const token = (localStorage.getItem('jsc_apify_token') || '').trim();
      let cfg = {};
      try { cfg = JSON.parse(localStorage.getItem('jsc_apify_cfg') || '{}'); } catch {}

      const startResp = await fetch('/api/apify/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role_keyword: cfg.role_keyword || 'Data Analyst', min_results: cfg.min_results || 50 }),
      });
      const startData = await startResp.json();
      if (!startResp.ok || startData.ok === false) throw new Error(startData.error || 'Failed to start scrape');

      const { runId, googleRunId } = startData;
      if (btn) btn.innerHTML = '<span class="ar-scrape-spinner"></span> Scraping all boards (may take a few minutes)…';
      _setSubtitle('Job Board Scraper running via Apify — please wait…');

      for (let i = 0; i < 28; i++) {
        await _sleep(15000);
        let pollUrl = `/api/apify/poll?runId=${encodeURIComponent(runId)}&token=${encodeURIComponent(token)}`;
        if (googleRunId) pollUrl += `&googleRunId=${encodeURIComponent(googleRunId)}`;
        const pollResp = await fetch(pollUrl);
        const pollData = await pollResp.json();
        if (!pollResp.ok || pollData.ok === false) throw new Error(pollData.error || 'Poll error');

        if (pollData.status === 'running') {
          _setSubtitle(`Scraping all boards — ${Math.round((i + 1) * 15 / 60 * 10) / 10} min elapsed…`);
          continue;
        }
        if (pollData.status === 'succeeded') {
          const scored = pollData.jobs || [];
          const localStates = _loadLocalStates();
          scored.forEach(j => { j.approval_state = localStates[j.id] || 'pending_review'; });
          _jobs = scored;
          _invalidateCache();
          _saveJobsToLocalStorage();
          _renderBody();
          const dbg = pollData.debug || {};
          const rawBySite = dbg.rawBySite || {};
          const _ALL_BOARDS = [
            { key: 'linkedin',     label: 'LI' },
            { key: 'indeed',       label: 'IN' },
            { key: 'glassdoor',    label: 'GD' },
            { key: 'google',       label: 'GO' },
            { key: 'zip_recruiter', label: 'ZR' },
          ];
          const siteBreakdown = _ALL_BOARDS
            .map(b => `${b.label}:${rawBySite[b.key] || 0}`)
            .join('  ');
          console.log('[JobBoardScraper] debug', dbg);
          _setSubtitle(
            `${scored.length} jobs shown · ${dbg.rawTotal || '?'} raw · ${dbg.afterExclusion || '?'} after exclusion · by board: ${siteBreakdown}`
          );
          UI.notify(`Scraped ${scored.length} jobs (${dbg.rawTotal || '?'} raw across all boards)`, 'success');
          return;
        }
        throw new Error(`Apify run ended: ${pollData.status || 'unknown'}`);
      }
      throw new Error('Scrape timed out after 7 minutes. Try again.');
    } catch (err) {
      UI.notify('Scrape failed: ' + err.message, 'error');
      _setSubtitle('Scrape failed — ' + err.message);
    } finally {
      _scraping = false;
      if (btn) { btn.innerHTML = '📡 Re-Scrape All Boards'; btn.disabled = false; }
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  function applyFilter() {
    _filterText = (document.getElementById('ar-search')?.value || '');
    _invalidateCache();
    _renderBody();
  }

  function setStateFilter(state) {
    _filterState = state;
    _invalidateCache();
    ['all', 'pending_review', 'approved', 'rejected', 'applied'].forEach(s => {
      const btn = document.getElementById(s === 'pending_review' ? 'ar-f-pending' : `ar-f-${s}`);
      if (btn) btn.classList.toggle('active', s === state);
    });
    _renderBody();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _formatPosted(raw) {
    if (!raw) return '—';
    const s = String(raw).trim();
    if (/ago|hour|day|week|month/i.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    render,
    approveJob, rejectJob, applyJob, deleteJob,
    reScrape,
    sortBy,
    startColResize,
    applyFilter,
    setStateFilter,
    openResumeFolder,
    draftCoverLetter,
    copyCoverLetter,
    saveCoverLetter,
    confirmApplied,
  };
})();
