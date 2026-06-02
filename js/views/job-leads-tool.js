const JobLeadsTool = (() => {
  let _starting = false;

  async function render() {
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
        <button id="jl-open-btn" class="btn btn-ghost" onclick="JobLeadsTool.openOutput()" disabled>Open JL Output</button>
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
      detailEl.textContent = JSON.stringify(payload, null, 2);

      if (payload.open_url) {
        window.open(payload.open_url, '_blank', 'noopener');
      }
      if (openBtn) {
        openBtn.disabled = false;
      }
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

  function openOutput() {
    const payloadUrl = '/api/jl-output?view=review';
    window.open(payloadUrl, '_blank', 'noopener');
  }

  return {
    render,
    start,
    openOutput,
  };
})();
