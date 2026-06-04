/* Dashboard view */
const Dashboard = (() => {
  const SAMPLE_BRIEFING_TEXT = "Intelligence indicates Agent Bish has enough momentum to make today useful, provided she does not mistake planning for movement. The market remains selective, but analytics candidates with USC Marshall credentials and a defensible project story are still in the game. Today's mission: identify one hiring manager or USC alum at a target Los Angeles company, send the outreach message, and log the follow-up before closing the laptop. MI6 does not award medals for refreshing job boards.";
  const PREVIEW_BRIEFINGS = [
    SAMPLE_BRIEFING_TEXT,
    "The field reports suggest applications are moving, but networking is still behaving like a locked door no one has tried the handle on. Los Angeles analytics hiring remains competitive, yet candidates who can connect business judgment to technical execution are still getting through. Today's mission: find one USC Marshall alum at Disney, Snap, or Capital Group and send a specific outreach note tied to analytics work. No grand campaign required. One clean contact, one logged action, then move.",
    "Agent Bish's activity log shows progress in the dossier, but interview preparation needs a sharper edge before the next recruiter screen appears. The advantage remains clear: USC Marshall, MIS foundations, and real analytics work are a credible package when defended with specifics. Today's mission: rehearse one analytics project story out loud using situation, task, action, result, and one metric or decision influenced. If the number is imperfect, estimate it intelligently. The room will not grade itself.",
    "Intelligence indicates the job boards are not the enemy, but they are also not a strategy. Data analytics roles continue to reward candidates who show proof of work, especially when the portfolio connects tools to decisions instead of screenshots. Today's mission: spend forty-five minutes improving one portfolio bullet so it names the dataset, method, tool, and business question. Then stop polishing and publish the improvement. Perfection is not a deployment plan.",
  ];

  const BRIEFING_SYSTEM_PROMPT = `You are generating a daily mission briefing for Corinne, a USC Marshall MSBA graduate conducting a job search in Los Angeles. You write in the style of a James Bond MI6 mission briefing — professional, dry wit, direct, occasionally sardonic, never cheesy. Think M briefing Bond, not a parody. The briefing should feel like it was written by someone who takes the mission seriously and expects her to as well.

The briefing has four parts delivered as flowing prose, not bullet points:

PART 1 — STATUS ASSESSMENT (2-3 sentences)
Assess her current gauge activity honestly. If she's on track, acknowledge it briefly and move on. If gauges are stagnant — especially USC/Eller Networking — name it directly but without dwelling. Use mission language: 'The field reports suggest...', 'Intelligence indicates...', 'Agent Bish's activity log shows...'

PART 2 — INTEL UPDATE (1-2 sentences)
One encouraging fact about the data analytics job market or her specific position as a USC Marshall MSBA grad. Keep it grounded and real — not generic cheerleading. Examples: reference the 34% growth projection, the LA comp data, the hiring rebound, or her specific competitive advantages. Vary this across days so it doesn't repeat.

PART 3 — TODAY'S MISSION (1-2 sentences)
One specific, concrete action item based on what her gauges and session history suggest she most needs to do today. Be direct. No vague instructions. 'Your mission today: find one USC Marshall alum at Google or Snap and send the outreach message. The template is on your USC/Eller page. This is not optional.' If she's already on track everywhere, assign a portfolio task or an interview prep block.

PART 4 — SIGN-OFF (1 sentence)
A dry, Bond-appropriate closing line. Vary these. Examples: 'Good hunting, Agent Bish.', 'The offer is out there. Go find it.', 'MI6 expects results by end of day.', 'Dismissed.', 'The market doesn't wait. Neither should you.'

Total length: 100-150 words maximum. Punchy. She is an ESTP — she wants action, not analysis. Get in, make the point, get out.

Never use bullet points. Never use headers within the briefing itself — it should read as a single cohesive document. Never be sycophantic.`;

  let _briefingInFlight = false;
  let _briefingMemory = '';

  function _briefingDefaults() {
    return {
      last_briefing_date: null,
      last_briefing_text: null,
    };
  }

  function _ensureBriefingProgressFields() {
    const progress = Storage.get('progress', {});
    const defaults = _briefingDefaults();
    const missing = Object.keys(defaults).some(key => progress[key] === undefined);
    if (!missing) return progress;
    return Storage.merge('progress', {
      last_briefing_date: progress.last_briefing_date ?? defaults.last_briefing_date,
      last_briefing_text: progress.last_briefing_text ?? defaults.last_briefing_text,
    });
  }

  function render() {
    const progress = _ensureBriefingProgressFields();
    const profile = Storage.get('profile', {});

    // Welcome text
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = profile.name || 'there';
    document.getElementById('dash-welcome').textContent = `${greeting}, ${name}`;
    document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    _renderDailyBriefingFromProgress(progress);

    // Gauge band
    const bandEl = document.getElementById('gauge-band-container');
    if (bandEl) bandEl.innerHTML = Gauges.renderBand();

    // Current mission banner
    const current = Milestones.getCurrentMission();
    document.getElementById('dash-mission-badge').textContent = `MISSION: ${current.codename}`;
    document.getElementById('dash-banner-greeting').textContent = `Ready for your next mission?`;

    // Mission card
    _renderCurrentMissionCard(current);

    // All missions list
    _renderMissionsList();
  }

  function _renderDailyBriefingFromProgress(progress = _ensureBriefingProgressFields()) {
    if (progress.last_briefing_date === _todayISODate() && progress.last_briefing_text) {
      _renderDailyBriefingCard({ state: 'ready', text: progress.last_briefing_text });
      return;
    }

    _renderDailyBriefingCard({
      state: 'loading',
      text: "Retrieving today's mission briefing...",
    });
    _generateDailyBriefing();
  }

  function _todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  async function _generateDailyBriefing() {
    if (_briefingInFlight) return;
    _briefingInFlight = true;

    try {
      const memory = await _loadBriefingMemory();
      const payload = _buildBriefingPayload();
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Config.claudeModel(),
          max_tokens: 500,
          stream: false,
          system: `${BRIEFING_SYSTEM_PROMPT}\n\n---\n\n${memory}`,
          messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || 'Briefing request failed');
      }
      const data = await res.json();
      const text = (data.content?.[0]?.text || '').trim();
      if (!text) throw new Error('Empty briefing response');
      const updated = Storage.merge('progress', {
        last_briefing_date: _todayISODate(),
        last_briefing_text: text,
      });
      _renderDailyBriefingFromProgress(updated);
    } catch {
      _renderDailyBriefingCard({
        state: 'error',
        text: SAMPLE_BRIEFING_TEXT,
        sample: true,
      });
    } finally {
      _briefingInFlight = false;
    }
  }

  async function _loadBriefingMemory() {
    if (_briefingMemory) return _briefingMemory;
    try {
      const res = await fetch('/context/daily_mission_briefing.md');
      _briefingMemory = res.ok ? await res.text() : '';
    } catch {
      _briefingMemory = '';
    }
    return _briefingMemory;
  }

  function _buildBriefingPayload() {
    const gauges = Storage.get('gauges', {});
    const gaugeSettings = Storage.get('gauge_settings', {});
    const gaugeTarget = (key, fallback) => {
      const value = parseInt(gaugeSettings[key], 10);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const sessions = Storage.get('sessions', { sessions: [], compressed: [] });
    const fullSessions = sessions.sessions || [];
    const lastSession = fullSessions[fullSessions.length - 1];
    const lastMessages = (lastSession?.messages || []).slice(-6);
    const startDate = Storage.get('progress', {}).job_search_start_date || Storage.get('profile', {}).start_date;
    const achieved = Milestones.getDefs()
      .filter(m => Milestones.getMissionState(m.id).complete)
      .map(m => m.title);

    const uscCount = gauges.usc_eller || 0;
    const uscTarget = gaugeTarget('usc_eller_target', 6);

    return {
      today_date: _todayISODate(),
      days_since_start: _daysSince(startDate),
      current_session: fullSessions.length,
      weekly_gauges: {
        applications_sent: `${gauges.apps || 0} of ${gaugeTarget('apps_target', 10)}`,
        follow_ups: `${gauges.followups || 0} of ${gaugeTarget('followups_target', 10)}`,
        networking_general: `${gauges.networking || 0} of ${gaugeTarget('networking_target', 6)}`,
        usc_eller_networking: `${uscCount} of ${uscTarget}${uscCount < Math.ceil(uscTarget / 2) ? ' — below target, call out directly' : ''}`,
        interview_prep_sessions: `${gauges.interview_prep || 0} of ${gaugeTarget('interview_prep_target', 6)}`,
        attempts: gauges.interviews || 0,
        linkedin_activity: `${gauges.linkedin || 0} of ${gaugeTarget('linkedin_target', 6)}`,
        side_hustle_income: `$${gauges.side_hustle?.income || 0} of $${gaugeTarget('side_hustle_income_target', 250)}`,
        side_hustle_portfolio_eligible: `${gauges.side_hustle?.items || 0} of ${gaugeTarget('side_hustle_items_target', 1)}`,
      },
      cumulative_gauges: {
        portfolio_projects_published: `${gauges.portfolio || 0} of ${gaugeTarget('portfolio_target', 3)}`,
        resume_variants_complete: `${gauges.resume_variants || 0} of ${gaugeTarget('resume_variants_target', 3)}`,
      },
      last_session_summary: _lastSessionSummary(lastMessages),
      days_since_usc_eller_touch: uscCount > 0 ? 0 : null,
      milestones_achieved: achieved,
    };
  }

  function _daysSince(dateString) {
    if (!dateString) return 0;
    const start = new Date(dateString);
    if (Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  }

  function _lastSessionSummary(messages) {
    if (!messages.length) return '';
    const words = messages
      .map(m => `${m.role === 'user' ? 'Corinne' : 'Coach'}: ${m.content}`)
      .join('\n')
      .split(/\s+/);
    return words.slice(0, 200).join(' ');
  }

  function retryDailyBriefing() {
    _renderDailyBriefingCard({
      state: 'loading',
      text: "Retrieving today's mission briefing...",
    });
    _generateDailyBriefing();
  }

  function _renderDailyBriefingCard({ state, text, sample = false }) {
    const gaugeContainer = document.getElementById('gauge-band-container');
    if (!gaugeContainer) return;

    let el = document.getElementById('daily-briefing-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'daily-briefing-container';
      gaugeContainer.insertAdjacentElement('beforebegin', el);
    }

    const today = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).toUpperCase();

    el.innerHTML = `
      <section class="daily-briefing-card ${state === 'loading' ? 'loading' : ''}">
        <div class="daily-briefing-watermark">007</div>
        <div class="daily-briefing-stamp">CLASSIFIED</div>
        <div class="daily-briefing-kicker">DAILY MISSION BRIEFING · ${today}</div>
        <div class="daily-briefing-divider"></div>
        <div class="daily-briefing-content">${_esc(text || '')}</div>
        ${state === 'error' && !sample ? `<button class="btn btn-ghost btn-sm daily-briefing-retry" onclick="Dashboard.retryDailyBriefing()">Retry</button>` : ''}
        <div class="daily-briefing-footer">This briefing will self-destruct at midnight.</div>
        <button class="daily-briefing-calendar-btn" onclick="Dashboard.showBriefingPreviews()" aria-label="Open briefing previews" title="Preview briefings">📅</button>
      </section>`;
  }

  function showBriefingPreviews() {
    const body = `
      <div class="briefing-preview-scroll">
        ${PREVIEW_BRIEFINGS.map((text, index) => `
          <article class="briefing-preview-item">
            <div class="briefing-preview-label">Preview ${index + 1}</div>
            <p>${_esc(text)}</p>
          </article>
        `).join('')}
      </div>`;
    UI.showModal('Daily Briefing Previews', body, [
      { id: 'close', label: 'Close', class: 'btn-gold' },
    ]);
  }


  function _renderCurrentMissionCard(mission) {
    const progress = Milestones.getMissionProgress(mission.id);
    const state = Milestones.getMissionState(mission.id);

    const tasks = Milestones.getDefs().find(m => m.id === mission.id).tasks;
    const tasksHTML = tasks.map(task => {
      const done = state.tasks[task.id];
      return `<div class="mission-task">
        <div class="task-check ${done ? 'done' : ''}" onclick="Dashboard.toggleTask('${mission.id}','${task.id}')">
          ${done ? '✓' : ''}
        </div>
        <span class="task-label ${done ? 'done' : ''}">${task.label}</span>
      </div>`;
    }).join('');

    document.getElementById('dash-mission-card').innerHTML = `
      <div class="mission-card">
        <div class="mission-codename">CURRENT MISSION: ${mission.codename}</div>
        <div class="mission-title">${mission.title}</div>
        <div class="mission-briefing">"${mission.briefing}"</div>
        <div style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text-muted)">Mission Progress</span>
            <span style="font-size:12px;font-weight:700;color:var(--gold)">${progress.pct}%</span>
          </div>
          <div class="mission-progress-bar" style="height:6px">
            <div class="mission-progress-fill" style="width:${progress.pct}%"></div>
          </div>
        </div>
        <div class="mission-tasks">${tasksHTML}</div>
      </div>`;
  }

  function _renderMissionsList() {
    const defs = Milestones.getDefs();
    const html = defs.map(m => {
      const state = Milestones.getMissionState(m.id);
      const progress = Milestones.getMissionProgress(m.id);
      const isCurrent = !state.complete && m.id === Milestones.getCurrentMission().id;

      return `<div class="mission-list-item" onclick="MissionDiscussion.open('${m.id}')">
        <span style="font-size:14px">${m.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;color:${state.complete ? 'var(--success)' : isCurrent ? 'var(--gold)' : 'var(--text-muted)'}">${m.codename}</div>
          <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.title}</div>
        </div>
        ${!state.complete ? `<div style="font-size:10px;color:var(--text-muted)">${progress.pct}%</div>` : ''}
      </div>`;
    }).join('');

    document.getElementById('dash-missions-list').innerHTML = html;
  }

  function toggleTask(missionId, taskId) {
    const result = Milestones.toggleTask(missionId, taskId);
    if (result.justCompleted) {
      UI.showMissionComplete(result.mission);
      UI.notify(`Mission ${result.mission.codename} complete! 🎉`, 'success', 6000);
    }
    render();
    UI.updateSidebar();
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render, toggleTask, retryDailyBriefing, showBriefingPreviews };
})();
