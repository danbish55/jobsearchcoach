/* Gauges - read-only live activity counts */
const Gauges = (() => {
  const GAUGE_DEFS = [
    {
      id: 'resume_variants',
      label: 'Resume Variants',
      group: 'Content',
      type: 'cap',
      target: 3,
      icon: '📄',
      tooltip: 'Add or remove resumes on the Resumes page.',
    },
    {
      id: 'apps',
      label: 'Weekly Applications',
      group: 'Job Search',
      type: 'weekly',
      target: 10,
      icon: '📋',
      tooltip: 'Log applications on the Job Leads page.',
    },
    {
      id: 'followups',
      label: 'Follow-Ups',
      group: 'Job Search',
      type: 'weekly',
      target: 10,
      icon: '📨',
      tooltip: 'Make your entries on the Follow-Ups page.',
    },
    {
      id: 'networking',
      label: 'Networking',
      displayLabel: 'General Networking',
      group: 'Networking',
      type: 'weekly',
      target: 6,
      icon: '🤝',
      tooltip: 'Make your entries on the Networking page.',
    },
    {
      id: 'interview_prep',
      label: 'Interview Prep',
      group: 'Skills',
      type: 'weekly',
      target: 6,
      icon: '🧠',
      tooltip: 'Make your entries on the Interview Prep page.',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      displayLabel: 'LinkedIn',
      group: 'Skills',
      type: 'weekly',
      target: 6,
      icon: '💼',
      tooltip: 'Make your entries on the LinkedIn page.',
    },
    {
      id: 'side_hustle',
      label: 'Side Hustle',
      group: 'Side Hustle',
      type: 'weekly',
      target: 1,
      icon: '💸',
      tooltip: 'Make your entries on the Side Hustle page.',
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      group: 'Content',
      type: 'cap',
      target: 3,
      icon: '🗂️',
      tooltip: 'Track portfolio work from the relevant project pages.',
    },
    {
      id: 'usc_eller',
      label: 'USC/Eller',
      displayLabel: 'USC/Eller',
      group: 'Networking',
      type: 'weekly',
      target: 6,
      icon: '🎓',
      tooltip: 'Make your entries on the USC/Eller page.',
    },
    {
      id: 'interviews',
      label: 'Interviews',
      group: 'Job Search',
      type: 'cumulative',
      target: null,
      icon: '🎤',
      tooltip: 'Interview activity is tracked from your Applications page.',
    },
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

  const HISTORY_KEY_BY_GAUGE = {
    followups: 'followup_history',
    networking: 'networking_history',
    usc_eller: 'usc_eller_history',
    interview_prep: 'interview_prep_history',
    linkedin: 'linkedin_history',
    side_hustle: 'side_hustle_history',
  };

  let _resumeFileCount = 0;
  let _resumeCountLoaded = false;
  let _refreshingResumeCount = false;
  let _resumeCountFetchedAt = 0;
  const RESUME_COUNT_TTL_MS = 30000;

  function init() {
    // Legacy jsc_gauges values are intentionally left in storage for rollback,
    // but dashboard counts are now derived from source records on each render.
    refreshLiveCounts();
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
      const key = copy.id === 'side_hustle' ? 'side_hustle_items_target' : `${copy.id}_target`;
      if (Object.prototype.hasOwnProperty.call(DEFAULT_GAUGE_SETTINGS, key)) {
        copy.target = _positiveInt(settings[key], DEFAULT_GAUGE_SETTINGS[key]);
      }
      return copy;
    });
  }

  function _getMondayString(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  }

  function _getSundayString(date) {
    const monday = new Date(`${_getMondayString(date)}T12:00:00`);
    monday.setDate(monday.getDate() + 6);
    return monday.toISOString().slice(0, 10);
  }

  function _applicationUniqueKey(app) {
    const leadId = String(app?.source_lead_id || app?.lead_id || '').trim().toLowerCase();
    if (leadId) return `lead:${leadId}`;
    const url = String(app?.url || '').trim().toLowerCase();
    if (url) return `url:${url}`;
    const company = String(app?.company || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const role = String(app?.role || app?.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const date = String(app?.date || '').trim();
    return `manual:${company}|${role}|${date}`;
  }

  function countWeeklyApplications(applications = Storage.get('jobs', { applications: [] }).applications, today = new Date()) {
    const apps = Array.isArray(applications) ? applications : [];
    const weekStart = _getMondayString(today);
    const weekEnd = _getSundayString(today);
    const unique = new Set();

    apps.forEach(app => {
      if (app?.status !== 'applied') return;
      const date = String(app.date || '').slice(0, 10);
      if (!date || date < weekStart || date > weekEnd) return;
      unique.add(_applicationUniqueKey(app));
    });

    return unique.size;
  }

  function countHistoryEntries(gaugeId, progress = Storage.get('progress', {})) {
    const key = HISTORY_KEY_BY_GAUGE[gaugeId];
    const history = key ? progress?.[key] : [];
    return Array.isArray(history) ? history.length : 0;
  }

  function deriveCounts(options = {}) {
    const progress = Storage.get('progress', {});
    return {
      resume_variants: Number.isFinite(Number(options.resumeFileCount))
        ? Math.max(0, Number(options.resumeFileCount))
        : _resumeFileCount,
      apps: countWeeklyApplications(),
      followups: countHistoryEntries('followups', progress),
      networking: countHistoryEntries('networking', progress),
      usc_eller: countHistoryEntries('usc_eller', progress),
      interview_prep: countHistoryEntries('interview_prep', progress),
      linkedin: countHistoryEntries('linkedin', progress),
      side_hustle: countHistoryEntries('side_hustle', progress),
      portfolio: Storage.get('gauges', {})?.portfolio || 0,
      interviews: _countInterviewApplications(),
    };
  }

  function _countInterviewApplications() {
    const applications = Storage.get('jobs', { applications: [] }).applications;
    if (!Array.isArray(applications)) return 0;
    return applications.filter(app => ['phone', 'interview', 'offer'].includes(app?.status)).length;
  }

  async function refreshLiveCounts(options = {}) {
    const force = options.force === true;
    if (
      !force
      && _resumeCountLoaded
      && Date.now() - _resumeCountFetchedAt < RESUME_COUNT_TTL_MS
    ) {
      return;
    }
    if (_refreshingResumeCount) return;
    _refreshingResumeCount = true;
    try {
      const response = await fetch('/api/resumes/count');
      const payload = await response.json().catch(() => ({}));
      _resumeFileCount = response.ok ? Math.max(0, parseInt(payload.count, 10) || 0) : 0;
      _resumeCountLoaded = true;
      _resumeCountFetchedAt = Date.now();
    } catch {
      _resumeFileCount = 0;
      _resumeCountLoaded = true;
      _resumeCountFetchedAt = Date.now();
    } finally {
      _refreshingResumeCount = false;
      _reRenderBand();
    }
  }

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

  function _renderCard(def, counts) {
    const val = counts[def.id] || 0;
    const pct = def.target ? Math.min(100, Math.round((val / def.target) * 100)) : (val > 0 ? 100 : 0);
    const atCap = def.target ? val >= def.target : false;
    const meta = def.id === 'resume_variants'
      ? (_resumeCountLoaded ? 'files in folder' : 'loading files')
      : def.id === 'interviews'
        ? 'total'
        : 'live entries';

    return `<div class="gauge-card gauge-card-readonly${atCap ? ' gauge-card-done' : ''}" tabindex="0" aria-label="${_escAttr(def.displayLabel || def.label)} gauge, ${val} of ${def.target}">
      <div class="gauge-tooltip" role="tooltip">${_esc(def.tooltip)}</div>
      <div class="gauge-card-title">${def.icon} ${_esc(def.displayLabel || def.label)}</div>
      ${_speedometerHTML({
        pct,
        value: `${val}`,
        target: def.target ? `/ ${def.target}` : '',
        meta,
        complete: atCap,
      })}
    </div>`;
  }

  function renderBand() {
    const byId = Object.fromEntries(_gaugeDefs().map(def => [def.id, def]));
    const counts = deriveCounts();
    // Locked dashboard layout. Do not change this 3 / 3 / 4 gauge order without explicit user approval.
    const rows = [
      ['resume_variants', 'portfolio', 'side_hustle'],
      ['networking', 'usc_eller', 'linkedin'],
      ['apps', 'followups', 'interview_prep', 'interviews'],
    ];

    return `<img class="gauge-band-mark" src="assets/usc-trojan-logo-transparent.png" alt="">
      <div class="gauge-grid">
      ${rows.map(row => `<div class="gauge-grid-row">
        ${row.map(id => _renderCard(byId[id], counts)).join('')}
      </div>`).join('')}
    </div>`;
  }

  function _reRenderBand() {
    const bandEl = document.getElementById('gauge-band-container');
    if (bandEl) bandEl.innerHTML = renderBand();
    const shEl = document.getElementById('side-hustle-panel');
    if (shEl) shEl.innerHTML = renderSideHustlePanel();
  }

  function renderSideHustlePanel() {
    const def = _gaugeDefs().find(g => g.id === 'side_hustle');
    const count = countHistoryEntries('side_hustle');
    const pct = Math.min(100, Math.round((count / def.target) * 100));
    return `<div class="card sh-panel sh-panel-readonly">
      <div class="card-title">💸 Side Hustle</div>
      <div class="sh-panel-body">
        <div class="sh-panel-metric">
          <div class="sh-panel-row">
            <span class="sh-metric-label">Entries</span>
            <span class="sh-metric-value">${count}<span class="gauge-count-target"> / ${def.target}</span></span>
          </div>
          <div class="gauge-bar-track sh-bar"><div class="gauge-bar-fill gauge-bar-items" style="width:${pct}%"></div></div>
        </div>
      </div>
      <div class="sh-panel-hint">Make your entries on the Side Hustle page.</div>
    </div>`;
  }

  async function logWorkflowActivity(gaugeId, payload) {
    if (!GAUGE_DEFS.some(g => g.id === gaugeId)) {
      return { ok: false, reason: 'Unknown activity.' };
    }

    if (gaugeId === 'side_hustle') {
      const income = Math.max(0, parseInt(payload?.income || '0', 10) || 0);
      const item = payload?.portfolioEligible ? 1 : 0;
      const note = String(payload?.note || '').trim();
      if (!income && !item && !note) return { ok: false, reason: 'Log income, portfolio work, or a short note.' };
      return { ok: true };
    }

    const text = String(payload?.description || '').trim();
    if (!text) return { ok: false, reason: 'Please describe what you did.' };

    const local = _localValidate(gaugeId, text);
    if (local.valid) return { ok: true, localFallback: true };
    return {
      ok: false,
      question: local.question || null,
      reason: local.reason || 'Please add a little more detail.',
    };
  }

  function openPanel() {
    // Gauges are read-only. The hover tooltip points to the page that owns each count.
  }

  function increment() {
    _reRenderBand();
  }

  function _localValidate(gaugeId, text) {
    if (['followups', 'networking', 'usc_eller', 'interview_prep', 'linkedin'].includes(gaugeId)) {
      if (String(text || '').trim().length >= 3) return { valid: true };
      return { valid: false, reason: 'Please enter a brief note of at least 3 characters.' };
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

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(str) {
    return _esc(str).replace(/'/g, '&#39;');
  }

  return {
    init,
    renderBand,
    renderSideHustlePanel,
    refreshLiveCounts,
    openPanel,
    logWorkflowActivity,
    increment,
    deriveCounts,
    countWeeklyApplications,
    countHistoryEntries,
    __testLocalValidate: _localValidate,
  };
})();
