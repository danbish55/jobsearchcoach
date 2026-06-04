/* Gauges — 10-activity tracking dashboard */
const Gauges = (() => {

  const GAUGE_DEFS = [
    { id: 'apps',           label: 'Applications',    group: 'Job Search', type: 'weekly',    target: 10,  icon: '📋', validate: false },
    { id: 'followups',      label: 'Follow-Ups',      group: 'Job Search', type: 'weekly',    target: 10,  icon: '📨', validate: false },
    { id: 'interviews',     label: 'Interviews',      group: 'Job Search', type: 'cumulative',target: null,icon: '🎤', validate: true,
      placeholder: 'Company and role? What stage is this interview?' },
    { id: 'usc_eller',      label: 'USC / Eller',     displayLabel: 'USC ELLER Networking', group: 'Networking', type: 'weekly',    target: 6,   icon: '🎓', validate: true,
      placeholder: 'Who did you reach out to? Include their name and USC/Eller connection.' },
    { id: 'networking',     label: 'Networking',      displayLabel: 'General Networking', group: 'Networking', type: 'weekly',    target: 6,   icon: '🤝', validate: true,
      placeholder: 'Who did you connect with and how? Be specific.' },
    { id: 'interview_prep', label: 'Interview Prep',  group: 'Skills',     type: 'weekly',    target: 6,   icon: '🧠', validate: true,
      placeholder: 'What did you practice? (mock Q&A, case study, STAR story, research...)' },
    { id: 'linkedin',       label: 'LinkedIn',        displayLabel: 'Linked In', group: 'Skills',     type: 'weekly',    target: 6,   icon: '💼', validate: true,
      placeholder: 'What did you do on LinkedIn? (post, comment, connection, DM...)' },
    { id: 'portfolio',      label: 'Portfolio',       group: 'Content',    type: 'cap',       target: 3,   icon: '🗂️', validate: false },
    { id: 'resume_variants',label: 'Resume Variants', group: 'Content',    type: 'cap',       target: 3,   icon: '📄', validate: false },
    { id: 'side_hustle',    label: 'Side Hustle',     group: 'Side Hustle',type: 'dual',      icon: '💸',  validate: false,
      incomeTarget: 250, itemsTarget: 1 },
  ];

  const DEFAULT_GAUGE_SETTINGS = {
    apps_target: 10,
    followups_target: 10,
    usc_eller_target: 6,
    networking_target: 6,
    interview_prep_target: 6,
    linkedin_target: 6,
    portfolio_target: 3,
    resume_variants_target: 3,
    side_hustle_income_target: 250,
    side_hustle_items_target: 1,
  };

  const VALIDATION_SYSTEM = `You are validating a job search activity log entry for a grad student.
Respond with ONLY valid JSON, exactly one of these three forms:
{"valid":true,"question":null,"reason":"..."}
{"valid":false,"question":"follow-up question here","reason":"..."}
{"valid":false,"question":null,"reason":"..."}
Rules:
- valid=true only if the activity description is specific enough to confirm it actually happened
- question should ask for the ONE missing piece of info that would make it valid (omit if already clearly invalid)
- reason is a single short sentence`;

  const VALIDATION_HINTS = {
    interviews:     'Needs a company name or role title. "Had an interview" alone is not sufficient.',
    followups:      'Needs who was contacted, the date, and a short note about the follow-up. "I followed up" alone is not sufficient.',
    usc_eller:      'Needs a specific USC or Eller-affiliated person\'s name. Generic outreach without a real name is not valid.',
    networking:     'Needs to describe a real outreach action with a specific person or group, not just "I networked."',
    interview_prep: 'Needs to describe a specific prep activity, not just "I studied" or "I prepared."',
    linkedin:       'Needs to describe a specific LinkedIn action, not just "I used LinkedIn."',
  };

  // Multi-turn state for Claude validation
  let _pendingId   = null;
  let _pendingTurn = 0;
  let _pendingMsgs = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _getMondayString(date) {
    const d   = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  }

  function _defaultData() {
    return {
      week: _getMondayString(new Date()),
      apps: 0, followups: 0, interviews: 0,
      usc_eller: 0, networking: 0, interview_prep: 0, linkedin: 0,
      portfolio: 0, resume_variants: 0,
      side_hustle: { income: 0, items: 0 },
    };
  }

  function _getData() {
    return Storage.get('gauges', _defaultData());
  }

  function _getSettings() {
    return Storage.get('gauge_settings', DEFAULT_GAUGE_SETTINGS);
  }

  function _positiveInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function _gaugeDefs() {
    const settings = _getSettings();
    return GAUGE_DEFS.map(def => {
      const copy = { ...def };
      if (copy.type === 'dual') {
        copy.incomeTarget = _positiveInt(settings.side_hustle_income_target, DEFAULT_GAUGE_SETTINGS.side_hustle_income_target);
        copy.itemsTarget = _positiveInt(settings.side_hustle_items_target, DEFAULT_GAUGE_SETTINGS.side_hustle_items_target);
        return copy;
      }
      const key = `${copy.id}_target`;
      if (copy.target !== null && Object.prototype.hasOwnProperty.call(DEFAULT_GAUGE_SETTINGS, key)) {
        copy.target = _positiveInt(settings[key], DEFAULT_GAUGE_SETTINGS[key]);
      }
      return copy;
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    const data      = _getData();
    const thisMonday = _getMondayString(new Date());
    if (!data.week || data.week !== thisMonday) {
      const fresh = _defaultData();
      // Cumulative fields survive the weekly reset
      fresh.interviews      = data.interviews || 0;
      fresh.portfolio       = data.portfolio || 0;
      fresh.resume_variants = data.resume_variants || 0;
      Storage.set('gauges', fresh);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function _speedometerHTML({ pct, value, target, meta, complete }) {
    const safePct = Math.max(0, Math.min(100, pct || 0));
    return `<div class="speedometer ${complete ? 'speedometer-complete' : ''}" aria-hidden="true">
      <svg class="speedometer-svg" viewBox="0 0 120 76" role="img">
        <path class="speedometer-track" pathLength="100" d="M18 64 A42 42 0 0 1 102 64"></path>
        <path class="speedometer-fill" pathLength="100" d="M18 64 A42 42 0 0 1 102 64"
          style="stroke-dasharray:${safePct} 100"></path>
      </svg>
      <div class="speedometer-readout">
        <span class="speedometer-value">${value}</span>
        ${target ? `<span class="speedometer-target">${target}</span>` : ''}
      </div>
      <div class="speedometer-meta">${meta}</div>
    </div>`;
  }

  function _renderCard(def) {
    const data = _getData();

    if (def.type === 'dual') {
      const sh = data.side_hustle || { income: 0, items: 0 };
      const pct = Math.min(100, Math.round((sh.income / def.incomeTarget) * 100));
      const complete = sh.income >= def.incomeTarget && sh.items >= def.itemsTarget;

      return `<div class="gauge-card${complete ? ' gauge-card-done' : ''}" onclick="Gauges.openPanel('${def.id}')">
        <div class="gauge-card-title">${def.icon} ${def.displayLabel || def.label}</div>
        ${_speedometerHTML({
          pct,
          value: `$${sh.income}`,
          target: `/ $${def.incomeTarget}`,
          meta: `${sh.items} / ${def.itemsTarget} portfolio`,
          complete,
        })}
      </div>`;
    }

    const val    = data[def.id] || 0;
    let pct      = 0, valueText = '', targetText = '', foot = '';
    let atCap    = false;

    if (def.type === 'weekly') {
      pct        = Math.min(100, Math.round((val / def.target) * 100));
      valueText  = `${val}`;
      targetText = `/ ${def.target}`;
      foot       = 'this week';
      atCap      = val >= def.target;
    } else if (def.type === 'cap') {
      pct        = Math.min(100, Math.round((val / def.target) * 100));
      valueText  = `${val}`;
      targetText = `of ${def.target}`;
      foot       = 'cumulative';
      atCap      = val >= def.target;
    } else {
      pct        = val > 0 ? 100 : 0;
      valueText  = `${val}`;
      foot       = 'total';
    }

    return `<div class="gauge-card${atCap ? ' gauge-card-done' : ''}" onclick="Gauges.openPanel('${def.id}')">
      <div class="gauge-card-title">${def.icon} ${def.displayLabel || def.label}</div>
      ${_speedometerHTML({
        pct,
        value: valueText,
        target: targetText,
        meta: foot,
        complete: atCap,
      })}
    </div>`;
  }

  // Returns the inner HTML for #gauge-band-container
  function renderBand() {
    const byId = Object.fromEntries(_gaugeDefs().map(def => [def.id, def]));
    const rows = [
      ['resume_variants', 'portfolio', 'side_hustle'],
      ['networking', 'usc_eller', 'linkedin'],
      ['apps', 'followups', 'interview_prep', 'interviews'],
    ];

    return `<img class="gauge-band-mark" src="assets/usc-trojan-logo-transparent.png" alt="">
      <div class="gauge-grid">
      ${rows.map(row => `<div class="gauge-grid-row">
        ${row.map(id => _renderCard(byId[id])).join('')}
      </div>`).join('')}
    </div>`;
  }

  function renderSideHustlePanel() {
    const def = _gaugeDefs().find(g => g.id === 'side_hustle');
    const sh  = (_getData().side_hustle) || { income: 0, items: 0 };
    const incomePct = Math.min(100, Math.round((sh.income / def.incomeTarget) * 100));
    const itemsPct  = sh.items >= def.itemsTarget ? 100 : 0;

    return `<div class="card sh-panel" onclick="Gauges.openPanel('side_hustle')">
      <div class="card-title">💸 Side Hustle</div>
      <div class="sh-panel-body">
        <div class="sh-panel-metric">
          <div class="sh-panel-row">
            <span class="sh-metric-label">Income</span>
            <span class="sh-metric-value">$${sh.income}<span class="gauge-count-target"> / $${def.incomeTarget}</span></span>
          </div>
          <div class="gauge-bar-track sh-bar"><div class="gauge-bar-fill gauge-bar-income" style="width:${incomePct}%"></div></div>
        </div>
        <div class="sh-panel-metric">
          <div class="sh-panel-row">
            <span class="sh-metric-label">Portfolio Item</span>
            <span class="sh-metric-value">${sh.items}<span class="gauge-count-target"> / ${def.itemsTarget}</span></span>
          </div>
          <div class="gauge-bar-track sh-bar"><div class="gauge-bar-fill gauge-bar-items" style="width:${itemsPct}%"></div></div>
        </div>
      </div>
      <div class="sh-panel-hint">Click to log activity</div>
    </div>`;
  }

  function _reRenderBand() {
    const bandEl = document.getElementById('gauge-band-container');
    if (bandEl) bandEl.innerHTML = renderBand();
    const shEl = document.getElementById('side-hustle-panel');
    if (shEl) shEl.innerHTML = renderSideHustlePanel();
  }

  // ── Panels ───────────────────────────────────────────────────────────────

  function openPanel(gaugeId) {
    const def = _gaugeDefs().find(g => g.id === gaugeId);
    if (!def) return;

    if (def.type === 'dual') { _openSideHustlePanel(); return; }

    const val = _getData()[gaugeId] || 0;

    if (def.type === 'cap' && val >= def.target) {
      UI.notify(`You've completed all ${def.target} ${def.label.toLowerCase()}! 🎉`, 'success');
      return;
    }

    def.validate ? _openValidatedPanel(def) : _openSimplePanel(def, val);
  }

  function _openSimplePanel(def, currentVal) {
    const isCap  = def.type === 'cap';
    const bodyHTML = isCap
      ? `<p style="font-size:14px">Add one <strong>${def.label.toLowerCase()}</strong> to your total.<br>
          <span style="color:var(--text-muted);font-size:13px">Currently at ${currentVal} of ${def.target}.</span></p>`
      : `<div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">How many to log?</div>
         <input type="number" id="gauge-count-input" min="1" max="50" value="1"
           style="width:90px;text-align:center;font-size:28px;font-weight:800;padding:8px">`;

    UI.showModal(`Log ${def.label} ${def.icon}`, bodyHTML, [
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
      {
        id: 'submit', label: '+ Log It', class: 'btn-gold', close: false,
        action: () => {
          const amount = isCap ? 1
            : Math.max(1, parseInt(document.getElementById('gauge-count-input')?.value || '1', 10) || 1);
          _increment(def.id, amount);
          UI.closeModal();
          UI.notify(`✓ ${def.label} logged!`, 'success');
          _reRenderBand();
        },
      },
    ]);
    if (!isCap) setTimeout(() => document.getElementById('gauge-count-input')?.select(), 50);
  }

  function _openValidatedPanel(def) {
    _pendingId   = def.id;
    _pendingTurn = 1;
    _pendingMsgs = [];

    UI.showModal(`Log ${def.label} ${def.icon}`, _descBodyHTML(def.placeholder), [
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
      { id: 'submit', label: 'Submit', class: 'btn-gold', close: false, action: _trySubmit },
    ]);
    setTimeout(() => document.getElementById('gauge-desc-input')?.focus(), 50);
  }

  function _descBodyHTML(prompt) {
    return `<p style="color:var(--text-muted);font-size:13px;margin-bottom:10px">${prompt}</p>
      <textarea id="gauge-desc-input" rows="3" placeholder="Describe what you did..."
        style="width:100%;resize:vertical"></textarea>
      <div id="gauge-validation-msg" style="margin-top:8px;font-size:13px;color:var(--danger);display:none"></div>`;
  }

  function _trySubmit() {
    const text = document.getElementById('gauge-desc-input')?.value?.trim();
    if (!text) { _showMsg('Please describe what you did.'); return; }
    _pendingMsgs.push({ role: 'user', content: text });
    _doValidate();
  }

  async function _doValidate() {
    _setSubmitting(true);
    const def = _gaugeDefs().find(g => g.id === _pendingId);

    try {
      const raw = await _callClaude(_pendingId, _pendingMsgs);
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        _setSubmitting(false);
        _showMsg('Could not validate — please try again.');
        return;
      }

      if (parsed.valid) {
        _increment(_pendingId);
        UI.closeModal();
        UI.notify(`✓ ${def.label} logged!`, 'success');
        _reRenderBand();
        return;
      }

      if (parsed.question && _pendingTurn === 1) {
        _pendingTurn = 2;
        _pendingMsgs.push({ role: 'assistant', content: parsed.question });
        _setSubmitting(false);
        _showFollowUpModal(def, parsed.question);
        return;
      }

      _setSubmitting(false);
      _showMsg(parsed.reason || 'Too vague to log. Please add more detail.');
    } catch {
      _setSubmitting(false);
      _showMsg('Validation failed. Please try again.');
    }
  }

  function _showFollowUpModal(def, question) {
    const bodyHTML = `
      <div style="background:rgba(157,34,53,0.12);border-left:3px solid var(--accent);
        padding:10px 12px;border-radius:4px;margin-bottom:12px;font-size:14px">${question}</div>
      <textarea id="gauge-desc-input" rows="3" placeholder="Your answer..."
        style="width:100%;resize:vertical"></textarea>
      <div id="gauge-validation-msg" style="margin-top:8px;font-size:13px;color:var(--danger);display:none"></div>`;

    UI.showModal(`Log ${def.label} ${def.icon}`, bodyHTML, [
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
      { id: 'submit', label: 'Submit', class: 'btn-gold', close: false, action: _trySubmit },
    ]);
    setTimeout(() => document.getElementById('gauge-desc-input')?.focus(), 50);
  }

  function _openSideHustlePanel() {
    const def = _gaugeDefs().find(g => g.id === 'side_hustle');
    const sh = _getData().side_hustle || { income: 0, items: 0 };

    const bodyHTML = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Log your side hustle activity for this week.</p>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
            color:var(--text-muted);display:block;margin-bottom:6px">Income earned ($)</label>
          <input type="number" id="sh-income" min="0" max="10000" placeholder="0"
            style="width:130px;font-size:24px;font-weight:800;text-align:center;padding:8px">
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:12px;
          background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius)">
          <input type="checkbox" id="sh-item">
          <label for="sh-item" style="font-size:14px;cursor:pointer">Completed a portfolio item this week</label>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);
        font-size:12px;color:var(--text-muted)">
        This week so far: <strong style="color:var(--text)">$${sh.income} income</strong> &nbsp;·&nbsp;
        <strong style="color:var(--text)">${sh.items} portfolio item${sh.items !== 1 ? 's' : ''}</strong>
      </div>`;

    UI.showModal('Log Side Hustle 💸', bodyHTML, [
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
      {
        id: 'save', label: 'Save', class: 'btn-gold', close: false,
        action: () => {
          const income = parseInt(document.getElementById('sh-income')?.value || '0', 10) || 0;
          const item   = document.getElementById('sh-item')?.checked ? 1 : 0;
          if (!income && !item) { UI.notify('Nothing to log.', 'info'); UI.closeModal(); return; }
          const data = _getData();
          data.side_hustle = {
            income: (data.side_hustle?.income || 0) + income,
            items:  Math.min((data.side_hustle?.items || 0) + item, def.itemsTarget),
          };
          Storage.set('gauges', data);
          UI.closeModal();
          UI.notify('Side hustle activity logged!', 'success');
          _reRenderBand();
        },
      },
    ]);
  }

  // ── Claude validation ─────────────────────────────────────────────────────

  async function _callClaude(gaugeId, messages) {
    const hint   = VALIDATION_HINTS[gaugeId] || '';
    const system = VALIDATION_SYSTEM + (hint ? `\n\nFor this activity: ${hint}` : '');

    const r = await fetch('/api/claude', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      Config.claudeModel(),
        max_tokens: 150,
        stream:     false,
        system,
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || data.error || 'Validation unavailable.');
    return data.content?.[0]?.text || '{"valid":false,"question":null,"reason":"No response."}';
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  function _increment(gaugeId, amount = 1) {
    const data = _getData();
    data[gaugeId] = (data[gaugeId] || 0) + amount;
    Storage.set('gauges', data);
  }

  function increment(gaugeId, amount = 1) {
    _increment(gaugeId, amount);
    _reRenderBand();
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function _setSubmitting(loading) {
    const btn = document.getElementById('modal-btn-submit');
    if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Validating...' : 'Submit'; }
  }

  function _showMsg(msg) {
    const el = document.getElementById('gauge-validation-msg');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  async function logWorkflowActivity(gaugeId, payload) {
    const def = _gaugeDefs().find(g => g.id === gaugeId);
    if (!def) return { ok: false, reason: 'Unknown activity.' };

    if (def.type === 'dual') {
      const income = Math.max(0, parseInt(payload?.income || '0', 10) || 0);
      const item = payload?.portfolioEligible ? 1 : 0;
      if (!income && !item) return { ok: false, reason: 'Log income, portfolio work, or both.' };
      const data = _getData();
      data.side_hustle = {
        income: (data.side_hustle?.income || 0) + income,
        items: Math.min((data.side_hustle?.items || 0) + item, def.itemsTarget),
      };
      Storage.set('gauges', data);
      _reRenderBand();
      return { ok: true };
    }

    const text = String(payload?.description || '').trim();
    if (!text) return { ok: false, reason: 'Please describe what you did.' };

    if (['followups', 'networking', 'usc_eller', 'interview_prep', 'linkedin'].includes(gaugeId)) {
      const local = _localValidate(gaugeId, text);
      if (local.valid) {
        _increment(gaugeId);
        _reRenderBand();
        return { ok: true, localFallback: true };
      }
      return {
        ok: false,
        question: local.question || null,
        reason: local.reason || 'Please add a little more detail.',
      };
    }

    const needsValidation = def.validate || payload?.requireValidation;
    if (!needsValidation) {
      _increment(gaugeId);
      _reRenderBand();
      return { ok: true };
    }

    try {
      const raw = await _callClaude(gaugeId, [{ role: 'user', content: text }]);
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
      if (parsed.valid) {
        _increment(gaugeId);
        _reRenderBand();
        return { ok: true };
      }
      return {
        ok: false,
        question: parsed.question || null,
        reason: parsed.reason || 'Please add more specific detail.',
      };
    } catch {
      const local = _localValidate(gaugeId, text);
      if (local.valid) {
        _increment(gaugeId);
        _reRenderBand();
        return { ok: true, localFallback: true };
      }
      return {
        ok: false,
        question: local.question || null,
        reason: local.reason || 'Validation is unavailable. Please add more specific detail and try again.',
      };
    }
  }

  function _localValidate(gaugeId, text) {
    const words = text.split(/\s+/).filter(Boolean);
    const hasName = /\b(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+[A-Z][a-z]+|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
    const hasCompanyOrRole = /\b(role|position|job|company|manager|recruiter|analyst|data|engineer|designer|consultant|developer|coordinator)\b/i.test(text);
    const hasTiming = /\b(today|yesterday|week|month|day|applied|sent|emailed|messaged|called|followed up)\b/i.test(text) || /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text);

    if (!['followups', 'networking', 'usc_eller', 'interview_prep', 'linkedin'].includes(gaugeId) && words.length < 8) {
      return { valid: false, question: 'Can you add who, what role or company, and when this happened?', reason: 'The entry is too short to confirm the activity.' };
    }
    if (gaugeId === 'followups') {
      const parsed = _parseFollowupLog(text);
      if (parsed && parsed.company && parsed.name && parsed.note.length >= 10) return { valid: true };
      return { valid: false, question: "All that's needed here is a company, a name, and a short comment.", reason: 'Follow-ups need company, name, and a short comment.' };
    }
    if (['networking', 'usc_eller', 'interview_prep', 'linkedin'].includes(gaugeId)) {
      const parsed = _parseSimpleActivityLog(text);
      if (parsed && parsed.company && parsed.name && parsed.note.length >= 10) return { valid: true };
      return { valid: false, question: "All that's needed here is a company, a name, and a short comment.", reason: 'This activity needs company, name, and a short comment.' };
    }
    if (gaugeId === 'usc_eller' && (!hasName || !/\b(USC|Eller|Arizona|Marshall|alumni|alum)\b/i.test(text))) {
      return { valid: false, question: 'What is the person’s name, and are they connected to USC or Eller?', reason: 'USC/Eller networking needs a named alumni contact.' };
    }
    if (['networking', 'linkedin', 'interview_prep', 'interviews'].includes(gaugeId)) {
      return { valid: hasName || hasCompanyOrRole || hasTiming };
    }
    return { valid: true };
  }

  function _parseFollowupLog(text) {
    const parts = String(text || '').split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) return null;

    const companyFirstDate = _extractFollowupDateAndNote(parts[1]);
    if (parts.length >= 4 && companyFirstDate && _looksLikeFollowupPerson(parts[2])) {
      return { company: parts[0], name: parts[2], note: parts.slice(3).join(', ').trim() };
    }

    const nameFirstDate = _extractFollowupDateAndNote(parts.slice(2).join(', '));
    if (nameFirstDate && _looksLikeFollowupPerson(parts[0])) {
      return { name: parts[0], company: parts[1], note: nameFirstDate.note };
    }

    if (_looksLikeFollowupPerson(parts[0])) {
      return { name: parts[0], company: parts[1], note: parts.slice(2).join(', ').trim() };
    }

    if (_looksLikeFollowupPerson(parts[1])) {
      return { company: parts[0], name: parts[1], note: parts.slice(2).join(', ').trim() };
    }

    return null;
  }

  function _parseSimpleActivityLog(text) {
    const parts = String(text || '').split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    if (_looksLikeFollowupPerson(parts[0])) {
      return { name: parts[0], company: parts[1], note: parts.slice(2).join(', ').trim() };
    }
    if (_looksLikeFollowupPerson(parts[1])) {
      return { company: parts[0], name: parts[1], note: parts.slice(2).join(', ').trim() };
    }
    return null;
  }

  function _extractFollowupDateAndNote(text) {
    const match = String(text || '').trim().match(/^(today|yesterday|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b[\s,;:-]*(.*)$/i);
    if (!match) return null;
    return { date: match[1], note: match[2].trim() };
  }

  function _looksLikeFollowupPerson(text) {
    return /\b(?:mr|ms|mrs|dr)\.?\s+[a-z][a-z'-]*\b/i.test(text)
      || /\b(?:man|woman|person|guy|lady|recruiter|manager)\s+named\s+[a-z][a-z'-]*\b/i.test(text)
      || /\b[a-z][a-z'-]*\s+[a-z][a-z'-]*\b/i.test(text);
  }

  return { init, renderBand, renderSideHustlePanel, openPanel, logWorkflowActivity, increment };
})();
