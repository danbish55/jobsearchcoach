const JobLeadsTool = (() => {
  let _starting = false;
  let _items = [];

  async function render() {
    _ensureStyles();
    const container = document.getElementById('job-leads-tool-content');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title">Job Leads Tool</div>
        <div class="view-subtitle">Launch JobLeadsTool directly from JobSearchCoach</div>
      </div>
      <div class="card">
        <div class="card-title">Quick Access</div>
        <p>Click below to start JobLeadsTool. This keeps you in one workflow while running your lead scoring pipeline.</p>
        <button id="jl-start-btn" class="btn btn-primary" onclick="JobLeadsTool.start()">Start JL</button>
        <button id="jl-restart-btn" class="btn btn-ghost" onclick="JobLeadsTool.start(true)">Restart JL</button>
        <button id="jl-open-btn" class="btn btn-ghost" onclick="JobLeadsTool.loadOutput()" disabled>Load JL Output</button>
        <div id="jl-output-panel" class="jl-output-panel">
          <div class="jl-output-header">
            <span>JL Output</span>
            <span id="jl-output-status">Not loaded yet</span>
          </div>
          <div id="jl-output-list" class="jl-output-list">
            <div class="jl-output-empty">Start JL, then the job review output will appear here.</div>
          </div>
        </div>
        <div id="jl-status" style="margin-top:10px; color:var(--text-muted);">Status: Ready</div>
        <pre id="jl-status-detail" style="margin-top:10px; max-height:240px; overflow:auto; white-space:pre-wrap; background:rgba(255,255,255,0.04); border:1px solid var(--border); padding:10px; border-radius:8px;">Awaiting action.</pre>
      </div>
    `;

    const btn = document.getElementById('jl-start-btn');
    const restart = document.getElementById('jl-restart-btn');
    const openBtn = document.getElementById('jl-open-btn');
    if (btn) {
      btn.disabled = false;
    }
    if (restart) {
      restart.disabled = false;
    }
    if (openBtn) {
      openBtn.disabled = true;
    }
  }

  async function start(force = false) {
    if (_starting && !force) return;
    if (force) {
      _starting = true;
    }

    const statusEl = document.getElementById('jl-status');
    const detailEl = document.getElementById('jl-status-detail');
    const startBtn = document.getElementById('jl-start-btn');
    const restartBtn = document.getElementById('jl-restart-btn');
    const openBtn = document.getElementById('jl-open-btn');

    if (!statusEl || !detailEl) return;

    _starting = true;
    if (startBtn) startBtn.disabled = true;
    if (restartBtn) restartBtn.disabled = true;

    statusEl.textContent = 'Status: Starting JobLeadsTool...';
    detailEl.textContent = 'Sending start request to local server.';

    try {
      const response = await fetch('/api/start-jl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const payload = await response.json().catch(() => ({ ok: false, error: 'Could not parse server response.' }));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Unable to start JL.');
      }

      const status = payload.status || 'started';
      const pidText = payload.pid ? ` (pid ${payload.pid})` : '';
      const message = status === 'already_running'
        ? `JobLeadsTool already running${pidText}.`
        : status === 'completed'
        ? `JobLeadsTool completed run${pidText}.`
        : `JobLeadsTool started${pidText}.`;

      statusEl.textContent = `Status: ${message}`;
      detailEl.textContent = `JL cycle complete. Review the leads above inside JobSearchCoach.`;

      if (openBtn) {
        openBtn.disabled = false;
      }
      loadOutput();
    } catch (err) {
      statusEl.textContent = 'Status: Failed to start';
      detailEl.textContent = String(err.message || err);
      if (openBtn) {
        openBtn.disabled = true;
      }
    } finally {
      if (startBtn) startBtn.disabled = false;
      if (restartBtn) restartBtn.disabled = false;
      _starting = false;
    }
  }

  function openOutput(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function loadOutput() {
    const list = document.getElementById('jl-output-list');
    const status = document.getElementById('jl-output-status');
    const openBtn = document.getElementById('jl-open-btn');
    if (!list || !status) return;

    status.textContent = 'Loading...';
    list.innerHTML = `<div class="jl-output-loading"><span class="jl-output-spinner"></span><span>Loading JL results...</span></div>`;
    try {
      const response = await fetch(`/api/jl-output?view=scored&_=${Date.now()}`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.error || 'Could not load JL output');
      _items = Array.isArray(payload) ? payload : [];
      status.textContent = _items.length ? `${_items.length} leads loaded` : 'No leads found';
      if (openBtn) openBtn.disabled = false;
      list.innerHTML = _items.length ? _items.map(_rowHTML).join('') : `<div class="jl-output-empty">No JL leads found yet.</div>`;
    } catch (err) {
      status.textContent = 'Load failed';
      list.innerHTML = `<div class="jl-output-error">Could not load JL output. ${_esc(err.message || err)}</div>`;
    }
  }

  function _rowHTML(item, index) {
    const lead = item.lead || item;
    const score = Number(item.score ?? lead.score ?? 0);
    const tier = item.tier || _tierFromScore(score);
    const state = lead.approval_state || item.approval_state || 'pending_review';
    return `
      <article class="jl-output-row ${index % 2 ? 'alternate' : ''}">
        <div class="jl-output-score ${_tierClass(tier)}">${score}</div>
        <div class="jl-output-main">
          <div class="jl-output-company">${_esc(lead.company || 'Unknown company')}</div>
          <div class="jl-output-role">${_esc(lead.title || lead.role || 'Untitled role')}</div>
          <div class="jl-output-meta">
            <span>${_esc(lead.location || 'Location not listed')}</span>
            <span>${_esc(lead.source || item.source || 'JL')}</span>
            <span>${lead.posted_at ? _esc(_formatDate(lead.posted_at)) : 'Posted date unknown'}</span>
          </div>
          ${lead.description ? `<div class="jl-output-description">${_esc(_truncate(lead.description, 220))}</div>` : ''}
        </div>
        <div class="jl-output-actions">
          <span class="jl-output-pill ${_stateClass(state)}">${_esc(_stateLabel(state))}</span>
          <button class="btn btn-primary btn-sm" onclick="JobLeadsTool.openOutput('${_escAttr(lead.url || '')}')" ${lead.url ? '' : 'disabled'}>Open Job</button>
        </div>
      </article>`;
  }

  function _tierFromScore(score) {
    return score >= 70 ? 'tier_1' : score >= 45 ? 'tier_2' : 'tier_3';
  }

  function _tierClass(tier) {
    if (tier === 'tier_1') return 'tier-one';
    if (tier === 'tier_2') return 'tier-two';
    return 'tier-three';
  }

  function _stateClass(state) {
    return `state-${String(state || 'pending_review').replace(/_/g, '-')}`;
  }

  function _stateLabel(state) {
    return String(state || 'pending_review').replace(/_/g, ' ');
  }

  function _formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function _truncate(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  }

  function _ensureStyles() {
    if (document.getElementById('job-leads-tool-style')) return;
    const style = document.createElement('style');
    style.id = 'job-leads-tool-style';
    style.textContent = `
      .jl-output-panel { margin-top:14px; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:var(--card-bg); }
      .jl-output-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-bottom:1px solid var(--border); color:var(--text-muted); font-size:12px; }
      .jl-output-header span:first-child { color:var(--gold); font-weight:800; letter-spacing:0.08em; text-transform:uppercase; }
      .jl-output-list { max-height:720px; overflow-y:auto; background:rgba(255,255,255,0.02); }
      body.light .jl-output-list { background:rgba(255,255,255,0.56); }
      .jl-output-row { display:grid; grid-template-columns:56px minmax(0,1fr) auto; gap:14px; align-items:start; padding:14px 16px; border-bottom:1px solid var(--border); color:var(--text); font-family:inherit; }
      .jl-output-row.alternate { background:rgba(255,255,255,0.04); }
      body.light .jl-output-row.alternate { background:rgba(20,27,45,0.045); }
      .jl-output-row:hover { background:rgba(184,137,29,0.08); }
      .jl-output-score { display:inline-flex; align-items:center; justify-content:center; width:44px; height:30px; border-radius:999px; font-weight:900; color:#fff; }
      .jl-output-score.tier-one { background:var(--success); }
      .jl-output-score.tier-two { background:#b8891d; }
      .jl-output-score.tier-three { background:#6b7280; }
      .jl-output-company { font-size:15px; font-weight:900; color:var(--text); margin-bottom:3px; }
      .jl-output-role { color:var(--text); line-height:1.35; font-weight:600; }
      .jl-output-meta { display:flex; gap:10px; flex-wrap:wrap; color:var(--text-muted); font-size:12px; margin-top:6px; }
      .jl-output-description { color:var(--text-muted); font-size:13px; line-height:1.45; margin-top:8px; }
      .jl-output-actions { display:flex; flex-direction:column; align-items:flex-end; gap:8px; min-width:112px; }
      .jl-output-pill { border-radius:999px; padding:4px 8px; font-size:11px; font-weight:800; text-transform:uppercase; white-space:nowrap; }
      .state-pending-review { background:rgba(59,130,246,0.18); color:#60a5fa; }
      .state-approved { background:rgba(34,197,94,0.18); color:var(--success); }
      .state-rejected { background:rgba(239,68,68,0.18); color:var(--danger); }
      .state-applied { background:rgba(168,85,247,0.18); color:#c084fc; }
      .jl-output-empty, .jl-output-error, .jl-output-loading { padding:18px; color:var(--text-muted); font-size:13px; }
      .jl-output-error { color:var(--danger); }
      .jl-output-loading { display:flex; align-items:center; gap:10px; }
      .jl-output-spinner { width:18px; height:18px; border-radius:50%; border:3px solid var(--border); border-top-color:var(--gold); animation:jlOutputSpin 0.8s linear infinite; }
      @keyframes jlOutputSpin { to { transform:rotate(360deg); } }
      @media (max-width:760px) {
        .jl-output-row { grid-template-columns:44px minmax(0,1fr); }
        .jl-output-actions { grid-column:1 / -1; flex-direction:row; align-items:center; justify-content:flex-start; }
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
    start,
    openOutput,
    loadOutput,
  };
})();
