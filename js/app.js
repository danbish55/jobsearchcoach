/* App — main controller, routing, initialization */
const App = (() => {
  let _currentView = 'dashboard';
  let _chatEnhancementObserver = null;
  const CHAT_VIEWS = new Set([
    'coach',
    'resume-deep-dive',
    'job-target-tracker',
    'mission-discussion',
    'workflow-followups',
    'workflow-networking',
    'workflow-usc-eller',
    'workflow-interview-prep',
    'workflow-linkedin',
    'workflow-side-hustle',
  ]);
  const WELCOME_COPY = [
    "This isn't a search engine or a chatbot.",
    "It knows your education, your goals, your target companies, and your situation. Every coaching conversation you have here is remembered and used to give you better guidance over time.",
    "The way to get the most out of this is to talk to it the way you'd talk to a mentor who's been paying attention — not just asking questions, but telling it what's actually going on. Frustrated with the process? Say so. Unsure whether to apply somewhere? Talk it through. Got a rejection? Tell it what happened.",
    "The more you share, the more useful it becomes.",
    "The Coach page is where your main coaching relationship lives. That's where you check in, report progress, and have the real conversations. The other pages are focused tools — they know who you are, but they're built for specific tasks.",
    "One rule worth knowing: always come back to this same app for your job search work. The memory of everything you've shared only exists here. If you start a new session somewhere else, it starts from zero.",
    "You've got a strong foundation — USC Marshall MSBA, real analytics experience, and a clear target market. This tool is built to help you use all of it. Let's go.",
  ];

  const CHAT_PLACEHOLDERS = {
    'coach-input': "Tell me what's really going on this week — not just the checklist...",
    'deep-dive-input': "Answer as specifically as you can — details are what make bullets land...",
    'target-chat-input': "Ask me about any company on the list — comp, culture, how to approach them...",
    'workflow-usc-eller-chat-input': "Tell me what's holding you back, or ask me to help you find someone...",
    'workflow-networking-chat-input': "Describe who you reached out to, or ask for help with a message...",
    'workflow-followups-chat-input': "Ask me when and how to follow up, or what to say...",
    'workflow-interview-prep-chat-input': "Give me your answer to a question and I'll tell you how it lands...",
    'workflow-linkedin-chat-input': "Ask me what to post, or whether a comment idea is worth sending...",
    'workflow-side-hustle-chat-input': "Describe a gig you're considering and I'll tell you if it's worth your time...",
  };

  async function init() {
    _setStartupPreloader('Checking installation files and secure settings...');
    // Load server-side config status
    const status = await Config.load();

    // First run for this install package, or missing API key
    if (!status.setup_complete) {
      _hideStartupPreloader();
      Onboarding.start();
      return;
    }

    launch();
  }

  async function launch() {
    _setStartupPreloader('Loading coaching context...');
    // Load coaching context file fresh from disk
    await Claude.loadContext();

    // Initialize Drive if connected
    let driveConnected = false;
    if (Config.hasDrive()) {
      _setStartupPreloader('Checking Google Drive sync...');
      driveConnected = await Drive.init();
    }

    const storageState = await SampleData.prepareStorage(driveConnected);
    if (storageState.migrated) {
      await _resetJobSearchProfile();
    }
    if (driveConnected && storageState.ready) {
      await _syncFromDrive();
    }
    await _syncCandidateProfileToServer();

    await SampleData.seedIfEmpty();

    // Initialize milestone data
    Milestones.init();

    // Initialize gauge data (weekly reset check)
    Gauges.init();

    // Show the app shell
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('onboarding-overlay').classList.add('hidden');
    _hideStartupPreloader();

    // Initialize UI (wires sidebar nav, gauge, etc.)
    UI.init();

    // Initialize coach (but don't render yet — happens on navigate)
    Coach.init();

    const progress = Storage.get('progress', {});
    const shouldShowWelcome = progress.welcome_screen_shown !== true;
    const profile = Storage.get('profile', {});
    if (shouldShowWelcome && progress.welcome_screen_shown !== false) {
      Storage.merge('progress', { welcome_screen_shown: false });
    }

    // Navigate to last view or dashboard
    const lastView = sessionStorage.getItem('jsc_last_view') || 'dashboard';
    navigate(shouldShowWelcome ? 'dashboard' : lastView);

    // If first launch after onboarding, show coach automatically
    if (profile._just_onboarded) {
      Storage.merge('profile', { _just_onboarded: false });
      if (!shouldShowWelcome) navigate('coach');
    }

    if (shouldShowWelcome) {
      showWelcomeScreen(true);
    }
  }

  function navigate(viewId) {
    const previousView = _currentView;
    if (previousView !== viewId && CHAT_VIEWS.has(previousView)) {
      ChatMemory.unmount({ consolidate: true });
    }

    _currentView = viewId;
    sessionStorage.setItem('jsc_last_view', viewId);
    UI.showView(viewId);

    // Render the view
    switch (viewId) {
      case 'dashboard': Dashboard.render(); break;
      case 'coach':     /* Coach already initialized, messages persist */; break;
      case 'resume':    Resume.render(); break;
      case 'resume-deep-dive': ResumeDeepDive.render(); break;
      case 'jobs':      Jobs.render(); break;
      case 'resources': Resources.render(); break;
      case 'apify-radar': ApifyRadar.render(); break;
      case 'job-leads-tool': JobLeadsTool.render(); break;
      case 'report':    Report.render(); break;
      case 'settings':  Settings.render(); break;
      case 'mission-discussion': MissionDiscussion.render(); break;
      case 'workflow-followups':
      case 'workflow-networking':
      case 'workflow-usc-eller':
      case 'workflow-interview-prep':
      case 'workflow-linkedin':
      case 'workflow-side-hustle':
        WorkflowPages.render(viewId);
        break;
      case 'job-target-tracker':
        JobTargetTracker.render();
        break;
    }

    _afterRender(viewId);
    if (CHAT_VIEWS.has(viewId)) ChatMemory.mount(viewId);
  }

  function getCurrentView() { return _currentView; }

  function _setStartupPreloader(message) {
    const overlay = document.getElementById('startup-preloader');
    const text = document.getElementById('startup-preloader-text');
    if (text && message) text.textContent = message;
    overlay?.classList.remove('hidden');
  }

  function _hideStartupPreloader() {
    document.getElementById('startup-preloader')?.classList.add('hidden');
  }

  async function _syncFromDrive() {
    try {
      await Storage.syncFromDrive();
    } catch {}
  }

  async function _resetJobSearchProfile() {
    try {
      const response = await fetch('/api/jl/reset-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Job Search Profile reset failed');
      }
    } catch (err) {
      console.warn('JobSearchCoach could not restore the current Job Search Profile:', err);
    }
  }

  async function _syncCandidateProfileToServer() {
    const profile = Storage.get('candidate_profile', {});
    const hasProfile = profile && typeof profile === 'object' && Object.keys(profile).length > 0;
    if (!hasProfile) return;
    try {
      const response = await fetch('/api/jl/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Job Search Profile sync failed');
      }
    } catch (err) {
      console.warn('JobSearchCoach could not sync the Job Search Profile to Job Leads:', err);
    }
  }

  function _afterRender(viewId) {
    _ensureSharedUXStyles();
    _ensureChatEnhancementObserver();
    _ensureDashboardAboutButton();
    _applyChatPlaceholders();
    _applyPageChatRedirects(viewId);
  }

  function _ensureChatEnhancementObserver() {
    const main = document.getElementById('main-content');
    if (!main || _chatEnhancementObserver) return;
    let pending = false;
    _chatEnhancementObserver = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        _applyChatPlaceholders();
        _applyPageChatRedirects(_currentView);
      });
    });
    _chatEnhancementObserver.observe(main, { childList: true, subtree: true });
  }

  function _ensureSharedUXStyles() {
    if (document.getElementById('app-ux-style')) return;
    const style = document.createElement('style');
    style.id = 'app-ux-style';
    style.textContent = `
      .dashboard-about-btn {
        position: absolute;
        top: 0;
        right: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.06);
        color: var(--text-muted);
        font-weight: 800;
        cursor: pointer;
      }
      .dashboard-about-btn:hover { border-color: var(--gold); color: var(--gold); }
      .welcome-modal-body p { margin: 0 0 14px; line-height: 1.65; color: var(--text); }
      .welcome-modal-body p:first-child { color: var(--gold-light); font-weight: 800; }
      .welcome-modal-body {
        max-height: calc(100vh - 260px);
        overflow-y: auto;
        padding-right: 8px;
        scrollbar-gutter: stable;
      }
      .welcome-modal {
        background: var(--card-bg);
        border-color: var(--gold-border);
        box-shadow: var(--shadow);
      }
      .welcome-modal .modal-title { color: var(--text); }
      .welcome-modal .welcome-modal-body p { color: var(--text); }
      .welcome-modal .welcome-modal-body p:first-child { color: var(--gold); }
      .page-chat-redirect {
        margin-top: 7px;
        font-size: 12px;
        color: var(--text-muted);
      }
      .page-chat-coach-link {
        border: 0;
        background: transparent;
        color: var(--gold);
        padding: 0;
        font: inherit;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .workflow-chat-input-row textarea::placeholder,
      .target-chat-row input::placeholder,
      .deep-dive-chat-input-row textarea::placeholder,
      #coach-input::placeholder { color: #8fa3b8; opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function _ensureDashboardAboutButton() {
    const top = document.querySelector('#view-dashboard .dashboard-top');
    if (!top || document.getElementById('dashboard-about-btn')) return;
    top.style.position = top.style.position || 'relative';
    const btn = document.createElement('button');
    btn.id = 'dashboard-about-btn';
    btn.className = 'dashboard-about-btn';
    btn.type = 'button';
    btn.title = 'About this app';
    btn.setAttribute('aria-label', 'About this app');
    btn.textContent = '?';
    btn.addEventListener('click', () => showWelcomeScreen(false));
    top.appendChild(btn);
  }

  function showWelcomeScreen(firstLaunch = false) {
    const body = `<div class="welcome-modal-body">${WELCOME_COPY.map(p => `<p>${_esc(p)}</p>`).join('')}</div>`;
    UI.showModal('Before You Dive In', body, [{
      id: 'welcome-start',
      label: "Let's Get Started",
      class: 'btn-gold',
      action: () => {
        if (firstLaunch) {
          Storage.merge('progress', { welcome_screen_shown: true });
        }
      },
    }]);
    document.querySelector('#active-modal .modal')?.classList.add('welcome-modal');
  }

  function _applyChatPlaceholders() {
    Object.entries(CHAT_PLACEHOLDERS).forEach(([id, placeholder]) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('placeholder', placeholder);
    });
  }

  function _applyPageChatRedirects(viewId) {
    if (viewId === 'coach') return;
    const rows = [
      ...document.querySelectorAll('.workflow-chat-input-row'),
      ...document.querySelectorAll('.target-chat-row'),
      ...document.querySelectorAll('.deep-dive-chat-input-row'),
    ];
    rows.forEach(row => {
      if (row.nextElementSibling?.classList?.contains('page-chat-redirect')) return;
      const line = document.createElement('div');
      line.className = 'page-chat-redirect';
      line.innerHTML = `For deeper coaching conversations &rarr; <button type="button" class="page-chat-coach-link">Coach</button>`;
      line.querySelector('button')?.addEventListener('click', () => navigate('coach'));
      row.insertAdjacentElement('afterend', line);
    });
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Kick off
  document.addEventListener('DOMContentLoaded', init);

  return { init, launch, navigate, getCurrentView, showWelcomeScreen };
})();
