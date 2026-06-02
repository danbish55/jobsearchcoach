/* Guided workflow pages for gauge activities */
const WorkflowPages = (() => {
  const QUOTES = [
    "Your next breakthrough is just around the corner.",
    "Believe in yourself. Your hard work will pay off.",
    "Every effort matters. You are closer than yesterday.",
    "All you need is for just one person to say yes.",
    "Step outside your comfort zone and take that chance.",
    "Progress over perfection. Just keep moving today.",
    "Your resilience is your superpower. Keep moving forward!",
    "Fight on to victory. Your next offer is waiting.",
  ];

  const PAGES = {
    'workflow-followups': {
      key: 'followups',
      gaugeId: 'followups',
      title: 'Follow Ups',
      why: 'Most candidates apply and disappear. Following up after an application or a networking message is one of the simplest things you can do to stand out, and almost nobody does it. A single well-timed follow-up can move you from the maybe pile to the yes pile. It also signals professionalism, persistence, and genuine interest, exactly what hiring managers are looking for.',
      steps: [
        'Wait 5-7 business days after submitting an application before following up.',
        'Find the hiring manager or recruiter on LinkedIn. Search the company name plus "recruiter" or "talent acquisition".',
        'Send a brief LinkedIn message or email. Do not restate your whole application. Keep it to 3 sentences maximum: confirm you applied and are interested, add one specific reason the role or company appeals to you, and ask if they need anything else.',
        'Example message: "Hi [Name] - I recently applied for the [Role] position at [Company] and wanted to follow up. I am particularly drawn to [one specific thing about the company or role]. Please let me know if there is anything else you need from me - I would love the opportunity to connect."',
        'If you do not hear back after one follow-up, move on. One follow-up is professional. Two is pressure.',
        'Log every follow-up here so your gauge reflects your actual effort.',
      ],
      prompt: 'Who did you follow up with, what date, and what is the short note?',
      resources: {
        label: 'Resources',
        links: [
          { icon: '📄', label: 'Follow-Up Templates', url: 'https://www.indeed.com/career-advice/finding-a-job/follow-up-email-after-application' },
          { icon: '📄', label: 'Post-Interview Email', url: 'https://www.indeed.com/career-advice/interviewing/follow-up-email-examples-after-interview' },
          { icon: '📄', label: 'Recruiter Follow-Up Guide', url: 'https://juicebox.ai/blog/follow-up-email-recruiter' },
        ],
      },
    },
    'workflow-networking': {
      key: 'networking',
      gaugeId: 'networking',
      title: 'Networking &mdash; General',
      plainTitle: 'Networking - General',
      why: 'Here is a number worth internalizing: referred candidates are hired at a rate 8 times higher than cold applicants, and over 70% of jobs are filled through networks before they are ever publicly posted. Networking is not a nice-to-have. It is statistically one of the most effective job search activities available to you. General networking covers everyone outside your USC and Eller alumni networks: your MSBA cohort, LinkedIn connections, industry contacts, and anyone else in your professional orbit.',
      steps: [
        'Start with your MSBA cohort. Message 2-3 classmates per week to ask where they are interviewing and whether they have any contacts at your target companies.',
        'Connect with people at your Tier 1 target companies on LinkedIn. Look for second-degree connections first, especially anyone with a USC or U of A connection.',
        'When you connect, send a personalized note. Never use the default LinkedIn connection message.',
        'The right ask is never "can you get me a job." It is always "can I have 20 minutes to learn about your experience."',
        'Example outreach: "Hi [Name] - I came across your profile and your work in [field/company] really caught my attention. I am a recent USC Marshall MSBA grad targeting data analytics roles in LA and would love 20 minutes to hear about your path. Would you be open to a quick call?"',
        'Follow up once after 7 days if you do not hear back. Then move on.',
        'Log every networking touch here. Each one counts toward your weekly gauge.',
      ],
      prompt: 'Who did you reach out to, what company do they work at, and what did you say?',
      resources: {
        label: 'Resources',
        links: [
          { icon: '🔗', label: 'LinkedIn Alumni Tool', url: 'https://www.linkedin.com/alumni/' },
          { icon: '📄', label: 'Outreach That Works', url: 'https://www.linkedin.com/posts/davidfano_the-follow-up-that-gets-responses-activity-7387112192778592256-Yxot' },
          { icon: '🔗', label: 'Comp Research', url: 'https://www.levels.fyi' },
        ],
      },
    },
    'workflow-usc-eller': {
      key: 'usc_eller',
      gaugeId: 'usc_eller',
      title: 'USC/Eller Networking',
      why: 'You have two alumni networks available to you that most job seekers would give anything for: USC Marshall and University of Arizona Eller. The alumni who participate in these networks opted in specifically to hear from recent graduates like you. They are not strangers. They are not people you are imposing on. They signed up because they want to help. This gauge is tracked separately because it is your highest-leverage networking activity and the one most likely to be quietly avoided.',
      steps: [
        'USC Marshall: go to marshall.usc.edu and log in with your USC credentials.',
        'Navigate to alumni mentor matching under Career Services, then search by industry and Los Angeles location.',
        'Identify 5 alumni whose roles align with your Tier 1 target companies.',
        'Also search LinkedIn through the USC Marshall School of Business alumni page. Filter by Los Angeles, data or analytics titles, and graduation years 2015-2023.',
        'USC message: "Hi [Name] - I am a recent USC Marshall MSBA grad targeting data analytics roles in LA, and I came across your profile through the Marshall alumni network. Your work in [their field/company] is exactly the direction I am hoping to move. Would you have 20 minutes for a quick conversation? I would love to hear about your path and what you would look for in a candidate for a role like yours. Thanks so much - Corinne"',
        'University of Arizona / Eller: go to alumni.arizona.edu and log in with your UA credentials. Search by Los Angeles and business, technology, or analytics fields.',
        'Also search LinkedIn through the University of Arizona Eller College alumni page using the same filters. MIS graduates are especially worth targeting because the shared major creates immediate common ground.',
        'Eller message: "Hi [Name] - I am a recent Eller grad (MIS) now finishing my MSBA at USC Marshall, targeting data analytics roles in LA. I found your profile through the Eller alumni network and your path really caught my attention. Would you have 20 minutes for a quick conversation? I would love to hear about your experience and any advice you would have for someone just starting out. Go Cats - Corinne"',
        'If you do not hear back in 7 days, one follow-up is appropriate and professional.',
      ],
      prompt: 'Give me a specific name - who did you reach out to, what school are they from, where do they work, and what did you say?',
      resources: {
        label: 'Resources — Your Alumni Networks',
        links: [
          { icon: '🔗', label: 'Trojan Network', url: 'https://careers.usc.edu/experiences/trojan-network-find-a-mentor/' },
          { icon: '🔗', label: 'Marshall Alumni Hub', url: 'https://www.marshall.usc.edu/alumni' },
          { icon: '🔗', label: 'Eller Career Lab', url: 'https://eller.arizona.edu/engage/alumni/career-advancement' },
        ],
      },
    },
    'workflow-interview-prep': {
      key: 'interview_prep',
      gaugeId: 'interview_prep',
      title: 'Interview Prep',
      why: 'The worst time to start interview prep is when you have an interview scheduled. By then you have three days, you are nervous, and you are cramming instead of performing. Interview readiness is built in advance, in blocks, consistently, before you need it. The candidates who perform well in interviews are not always the smartest ones. They are the most prepared ones.',
      steps: [
        'Behavioral questions: practice out loud using STAR format. Pick one question per session and answer it fully: Situation, Task, Action, Result. Record yourself and listen back.',
        'Technical questions: cover SQL joins, aggregations, window functions, subqueries, basic statistics, and analytics scenarios.',
        'Your 60-second portfolio pitch: for each project, summarize the business question, data used, finding, and recommendation without notes.',
        'Company-specific prep: research their data culture, recent news, what analysts do there, and one specific thing about the product or business you find genuinely interesting.',
        'Use the chat box below to run a mock interview question right now. Ask for a behavioral question, a technical question, or a case-style analytics problem.',
      ],
      prompt: 'What did you practice, for how long, and what format - behavioral, technical, or company-specific? Minimum 30 minutes to count.',
      resources: {
        label: 'Resources',
        links: [
          { icon: '▶️', label: 'Alex The Analyst', url: 'https://www.youtube.com/@AlexTheAnalyst' },
          { icon: '▶️', label: 'Ken Jee', url: 'https://www.youtube.com/@KenJee_DS' },
          { icon: '🔗', label: 'Interview Query', url: 'https://www.interviewquery.com' },
        ],
      },
    },
    'workflow-linkedin': {
      key: 'linkedin',
      gaugeId: 'linkedin',
      title: 'LinkedIn Activity',
      why: 'University recruiters at enterprise companies actively search LinkedIn for MSBA graduates in LA. If your profile is not optimized and you are not active, you are invisible to searches that could find you. LinkedIn activity is not vanity. It is discoverability.',
      steps: [
        'Optimize your headline first. Include your degree, target role, and a differentiator. Example: "USC Marshall MSBA | Data Analytics | MIS + Psychology Background | Open to Roles in LA".',
        'Post about your portfolio projects. Structure the post around the question, what you found, and what it means.',
        'Leave meaningful comments on posts from people at your target companies. Not "great post" - add something specific.',
        'Engage with USC Marshall and Eller content by sharing, commenting, or reposting content from your alumni networks.',
        'Update your Featured section with links to your portfolio projects as you publish them.',
      ],
      prompt: 'What did you post or comment on, and where? A like does not count - it needs to be a post you wrote or a substantive comment.',
      resources: {
        label: 'Resources',
        links: [
          { icon: '🔗', label: 'Profile Optimization', url: 'https://www.linkedin.com/help/linkedin/answer/a554288' },
          { icon: '▶️', label: 'LinkedIn Tips — YouTube', url: 'https://www.youtube.com/results?search_query=linkedin+profile+optimization+data+analyst+2026' },
          { icon: '🔗', label: 'LA Data Analyst Jobs', url: 'https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=Los%20Angeles%2C%20CA' },
        ],
      },
    },
    'workflow-side-hustle': {
      key: 'side_hustle',
      gaugeId: 'side_hustle',
      title: 'Side Hustle',
      why: 'Generating some income during your job search reduces financial pressure and keeps your skills sharp. The key is making sure the work helps your job search rather than only filling hours. This gauge tracks both income generated and whether the work is building your portfolio at the same time.',
      steps: [
        'Look for data analysis, dashboard building, Excel cleanup, Tableau, tutoring, UX research, and survey analysis work on Upwork, Fiverr, Toptal, Wyzant, UserTesting, Respondent, or through local businesses and nonprofits.',
        'Before taking a gig, ask: "Could I show this work to a hiring manager at Google or Disney as an example of my capabilities?"',
        'If yes, take it, do great work, and add it to your portfolio.',
        'If no, it may still be fine for income, but do not let it crowd out work that helps your job search.',
        'Log income honestly. Green tracks dollars. Maroon tracks portfolio-eligible work.',
      ],
      sideHustle: true,
      resources: {
        label: 'Resources — Find Your First Gigs',
        links: [
          { icon: '🔗', label: 'Upwork Gigs', url: 'https://www.upwork.com/freelance-jobs/data-analytics/' },
          { icon: '🔗', label: 'Fiverr Projects', url: 'https://www.fiverr.com/categories/data/data-analysis' },
          { icon: '🔗', label: 'Toptal (Higher Rates)', url: 'https://www.toptal.com/freelance-jobs/developers/data-analysis' },
        ],
      },
    },
  };

  const _quoteByView = {};
  const _chatByView = {};
  const _expandedHistoryByKey = {};
  const _historySortByKey = {};
  const HISTORY_KEYS = new Set(['followups', 'networking', 'usc_eller', 'interview_prep', 'linkedin', 'side_hustle']);

  function render(viewId) {
    const page = PAGES[viewId];
    const container = document.getElementById(`${viewId}-content`);
    if (!page || !container) return;

    _quoteByView[viewId] = _randomQuote(_quoteByView[viewId]);
    if (!_chatByView[viewId]) _chatByView[viewId] = [];

    container.innerHTML = `
      ${_hasHistory(page) ? _followupHistoryStyles() : ''}
      <div class="workflow-shell">
        <div class="workflow-topbar">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">Back to Dashboard</button>
          <div class="workflow-title">${page.title}</div>
        </div>

        <div class="workflow-hero-row">
          <div class="resume-quote-card workflow-quote-card">
            <p class="resume-quote-text">&ldquo;${_esc(_quoteByView[viewId])}&rdquo;</p>
          </div>
          <div class="card workflow-section">
            <div class="card-title">Why This Matters</div>
            <p>${page.why}</p>
          </div>
        </div>

        <div class="card workflow-section">
          <div class="card-title">How To Do It</div>
          <ol class="workflow-steps">
            ${page.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>

        ${_resourcesHTML(page.resources)}

        <div class="card workflow-section">
          <div class="card-title">Log Your Activity</div>
          ${page.sideHustle ? _sideHustleLogHTML(viewId) : _descriptionLogHTML(viewId, page)}
          ${page.note ? `<div class="workflow-note">${page.note}</div>` : ''}
          <div class="workflow-log-status" id="${viewId}-log-status"></div>
        </div>

        ${_hasHistory(page) ? _activityHistoryHTML(viewId, page) : ''}

        <div class="card workflow-section workflow-chat-card">
          <div class="card-title">Ask a Question</div>
          <div class="workflow-chat-messages" id="${viewId}-chat-messages"></div>
          <div class="workflow-chat-input-row">
            <textarea id="${viewId}-chat-input" rows="2" placeholder="Ask about ${_plainTitle(page).toLowerCase()}..."></textarea>
            <button class="btn btn-primary" onclick="WorkflowPages.ask('${viewId}')">Ask</button>
          </div>
        </div>
      </div>`;

    _renderChat(viewId);
  }

  function _descriptionLogHTML(viewId, page) {
    return `
      <label class="workflow-log-label">${page.prompt}</label>
      <textarea id="${viewId}-log-description" rows="4" placeholder="Describe what you did..."></textarea>
      <button class="btn btn-gold" onclick="WorkflowPages.submitLog('${viewId}')">Submit</button>`;
  }

  function _resourcesHTML(resources) {
    if (!resources?.links?.length) return '';
    return `<div class="workflow-resources" data-resource-section>
      <div class="resource-section-header"><span>${_esc(resources.label || 'Resources')}</span></div>
      <div class="resource-card-row">
        ${resources.links.slice(0, 3).map(link => `
          <a class="resource-card" href="${_escAttr(link.url)}" target="_blank" rel="noopener noreferrer" title="${_escAttr(link.url)}">
            <span class="resource-card-icon">${_esc(link.icon || '🔗')}</span>
            <span class="resource-card-label">${_esc(link.label)}</span>
          </a>
        `).join('')}
      </div>
    </div>`;
  }

  function _sideHustleLogHTML(viewId) {
    return `
      <div class="workflow-side-hustle-log">
        <label>
          <span>Income generated this week ($)</span>
          <input id="${viewId}-income" type="number" min="0" placeholder="0">
        </label>
        <label class="workflow-checkbox-line">
          <input id="${viewId}-portfolio" type="checkbox">
          <span>Was this work something I could show a hiring manager?</span>
        </label>
        <label style="grid-column:1 / -1">
          <span>Short note</span>
          <textarea id="${viewId}-side-note" rows="3" placeholder="What was the work or result?"></textarea>
        </label>
      </div>
      <button class="btn btn-gold" onclick="WorkflowPages.submitLog('${viewId}')">Submit</button>`;
  }

  async function submitLog(viewId) {
    const page = PAGES[viewId];
    const status = document.getElementById(`${viewId}-log-status`);
    if (!page || !status) return;

    status.textContent = 'Checking...';
    status.className = 'workflow-log-status';

    const payload = page.sideHustle
      ? {
          income: document.getElementById(`${viewId}-income`)?.value || '0',
          portfolioEligible: !!document.getElementById(`${viewId}-portfolio`)?.checked,
          note: document.getElementById(`${viewId}-side-note`)?.value || '',
        }
      : {
          description: document.getElementById(`${viewId}-log-description`)?.value || '',
          requireValidation: true,
        };

    const result = await Gauges.logWorkflowActivity(page.gaugeId, payload);
    if (result.ok) {
      if (_hasHistory(page)) {
        _prependActivityHistory(viewId, page, payload);
        _renderActivityHistory(viewId);
      }
      status.textContent = 'Logged. Your dashboard gauge has been updated.';
      status.classList.add('success');
      if (page.sideHustle) {
        document.getElementById(`${viewId}-income`).value = '';
        document.getElementById(`${viewId}-portfolio`).checked = false;
        document.getElementById(`${viewId}-side-note`).value = '';
      } else {
        document.getElementById(`${viewId}-log-description`).value = '';
      }
      return;
    }

    status.textContent = result.question || result.reason || 'Please add more detail.';
    status.classList.add('error');
  }

  function _followupHistoryStyles() {
    return `<style>
      .followup-history-card .followup-history-header {
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
      }
      .followup-history-sort-btn {
        min-width: 30px;
        height: 28px;
        padding: 0 8px;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
      }
      .followup-history-empty {
        color: var(--text-muted);
        font-style: italic;
        text-align: center;
        padding: 18px 12px;
      }
      .followup-history-list.locked {
        max-height: 156px;
        overflow-y: auto;
        scrollbar-gutter: stable;
        padding-right: 4px;
      }
      .followup-history-list.locked::-webkit-scrollbar { width: 8px; }
      .followup-history-list.locked::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px; }
      .followup-history-list.locked::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.45); border-radius: 999px; }
      body.light .followup-history-list.locked::-webkit-scrollbar-track { background: rgba(0,0,0,0.06); }
      .followup-history-row {
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        overflow: hidden;
        transition: background 160ms ease;
      }
      .followup-history-row:nth-child(even) { background: rgba(255,255,255,0.025); }
      body.light .followup-history-row:nth-child(even) { background: rgba(0,0,0,0.018); }
      .followup-history-row:hover { background: rgba(212,175,55,0.08); }
      .followup-history-line {
        display: grid;
        grid-template-columns: 118px 1fr auto 20px;
        gap: 8px;
        align-items: center;
        padding: 8px 4px;
      }
      .followup-history-date {
        color: var(--text-muted);
        font-size: 12px;
        white-space: nowrap;
      }
      .followup-history-summary {
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .followup-history-summary.collapse-label {
        color: var(--text-muted);
        font-size: 12px;
        font-style: italic;
      }
      .followup-history-actions {
        display: flex;
        gap: 3px;
        white-space: nowrap;
      }
      .followup-history-actions .btn-sm {
        padding: 5px 10px;
        font-size: 10px;
      }
      .followup-history-chevron {
        color: var(--gold);
        font-size: 18px;
        line-height: 1;
        transition: transform 180ms ease;
      }
      .followup-history-row.open .followup-history-chevron { transform: rotate(90deg); }
      .followup-history-full {
        color: var(--text);
        line-height: 1.55;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        padding: 0 4px;
        transition: max-height 200ms ease, opacity 160ms ease, padding 180ms ease;
      }
      .followup-history-row.open .followup-history-full {
        max-height: 220px;
        opacity: 1;
        padding: 0 4px 10px 132px;
      }
    </style>`;
  }

  function _followupHistoryHTML(viewId) {
    const history = _followupHistory();
    const sorted = _sortedFollowupHistory(history);
    return `<div class="card workflow-section followup-history-card">
      <div class="followup-history-header">
        <span class="followup-history-count">Follow Up History (${history.length})</span>
        <button class="btn btn-ghost btn-sm followup-history-sort-btn" title="Sort by date ${_followupHistorySort === 'desc' ? 'ascending' : 'descending'}" aria-label="Sort follow up history by date" onclick="WorkflowPages.toggleFollowupSort(event)">${_followupHistorySort === 'desc' ? '↓' : '↑'}</button>
      </div>
      <div class="followup-history-list ${history.length >= 3 ? 'locked' : ''}" id="${viewId}-history-list">${_followupHistoryListHTML(sorted)}</div>
    </div>`;
  }

  function _renderFollowupHistory(viewId) {
    const list = document.getElementById(`${viewId}-history-list`);
    const header = list?.previousElementSibling;
    if (!list || !header) return;
    const entries = _followupHistory();
    const count = header.querySelector('.followup-history-count');
    const sort = header.querySelector('.followup-history-sort-btn');
    if (count) count.textContent = `Follow Up History (${entries.length})`;
    if (sort) {
      sort.textContent = _followupHistorySort === 'desc' ? '↓' : '↑';
      sort.title = `Sort by date ${_followupHistorySort === 'desc' ? 'ascending' : 'descending'}`;
    }
    list.classList.toggle('locked', entries.length >= 3);
    list.innerHTML = _followupHistoryListHTML(_sortedFollowupHistory(entries));
  }

  function _followupHistoryListHTML(entries = _followupHistory()) {
    if (!entries.length) {
      return '<div class="followup-history-empty">No follow ups logged yet. Your history will appear here as you log activity.</div>';
    }
    return entries.map(entry => {
      const isOpen = entry.id === _expandedFollowupHistoryId;
      return `<div class="followup-history-row ${isOpen ? 'open' : ''}" role="button" tabindex="0" onclick="WorkflowPages.toggleFollowupHistory('${_escAttr(entry.id)}')" onkeydown="WorkflowPages.handleFollowupHistoryKey(event, '${_escAttr(entry.id)}')">
        <div class="followup-history-line">
          <div class="followup-history-date">${_esc(_formatHistoryDate(entry.date))}</div>
          <div class="followup-history-summary ${isOpen ? 'collapse-label' : ''}">${isOpen ? 'Collapse' : _esc(_truncate(_displayFollowupDescription(entry.description), 80))}</div>
          <div class="followup-history-actions">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); WorkflowPages.showFollowupEditModal('${_escAttr(entry.id)}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); WorkflowPages.removeFollowupHistory('${_escAttr(entry.id)}')">×</button>
          </div>
          <div class="followup-history-chevron">›</div>
        </div>
        <div class="followup-history-full">${_esc(_displayFollowupDescription(entry.description))}</div>
      </div>`;
    }).join('');
  }

  function _followupHistory() {
    const progress = Storage.get('progress', {});
    if (!Array.isArray(progress.followup_history)) {
      return Storage.merge('progress', { followup_history: [] }).followup_history;
    }
    return progress.followup_history;
  }

  function _prependFollowupHistory(description) {
    const progress = Storage.get('progress', {});
    const history = Array.isArray(progress.followup_history) ? progress.followup_history : [];
    const entry = {
      id: `followup-${Date.now()}`,
      date: new Date().toISOString(),
      description: _normalizeFollowupDescription(description),
    };
    Storage.merge('progress', { followup_history: [entry, ...history] });
    _expandedFollowupHistoryId = entry.id;
  }

  function toggleFollowupHistory(id) {
    _expandedFollowupHistoryId = _expandedFollowupHistoryId === id ? null : id;
    _renderFollowupHistory('workflow-followups');
  }

  function toggleFollowupSort(event) {
    event?.stopPropagation?.();
    _followupHistorySort = _followupHistorySort === 'desc' ? 'asc' : 'desc';
    _renderFollowupHistory('workflow-followups');
  }

  function handleFollowupHistoryKey(event, id) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleFollowupHistory(id);
  }

  function showFollowupEditModal(id) {
    const history = _followupHistory();
    const entry = history.find(item => item.id === id);
    if (!entry) return;

    const body = `
      <textarea id="followup-history-edit" rows="6" style="resize:vertical;width:100%"
        placeholder="Who, date, and short note...">${_esc(entry.description)}</textarea>`;

    UI.showModal('Edit Follow Up', body, [
      {
        id: 'save', label: 'Save Changes', class: 'btn-primary',
        close: false,
        action: () => {
          const updated = _normalizeFollowupDescription(document.getElementById('followup-history-edit')?.value || '');
          if (!updated) { UI.notify('Follow up note cannot be empty', 'error'); return; }
          const progress = Storage.get('progress', {});
          const nextHistory = (progress.followup_history || []).map(item => (
            item.id === id ? { ...item, description: updated } : item
          ));
          Storage.merge('progress', { followup_history: nextHistory });
          UI.closeModal();
          _renderFollowupHistory('workflow-followups');
        },
      },
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
    ]);
  }

  function removeFollowupHistory(id) {
    if (!confirm('Remove this follow up?')) return;
    const progress = Storage.get('progress', {});
    const nextHistory = (progress.followup_history || []).filter(item => item.id !== id);
    Storage.merge('progress', { followup_history: nextHistory });
    if (_expandedFollowupHistoryId === id) _expandedFollowupHistoryId = null;
    _renderFollowupHistory('workflow-followups');
  }

  function _hasHistory(page) {
    return !!page && HISTORY_KEYS.has(page.key);
  }

  function _activityHistoryHTML(viewId, page) {
    const history = _activityHistory(page);
    const sorted = _sortedActivityHistory(page, history);
    const sort = _historySort(page);
    return `<div class="card workflow-section followup-history-card">
      <div class="followup-history-header">
        <span class="followup-history-count">${_historyTitle(page)} (${history.length})</span>
        <button class="btn btn-ghost btn-sm followup-history-sort-btn" title="Sort by date ${sort === 'desc' ? 'ascending' : 'descending'}" aria-label="Sort ${_plainTitle(page)} history by date" onclick="WorkflowPages.toggleActivitySort('${viewId}', event)">${sort === 'desc' ? '↓' : '↑'}</button>
      </div>
      <div class="followup-history-list ${history.length >= 3 ? 'locked' : ''}" id="${viewId}-history-list">${_activityHistoryListHTML(viewId, page, sorted)}</div>
    </div>`;
  }

  function _renderActivityHistory(viewId) {
    const page = PAGES[viewId];
    const list = document.getElementById(`${viewId}-history-list`);
    const header = list?.previousElementSibling;
    if (!page || !list || !header) return;
    const entries = _activityHistory(page);
    const sortValue = _historySort(page);
    const count = header.querySelector('.followup-history-count');
    const sort = header.querySelector('.followup-history-sort-btn');
    if (count) count.textContent = `${_historyTitle(page)} (${entries.length})`;
    if (sort) {
      sort.textContent = sortValue === 'desc' ? '↓' : '↑';
      sort.title = `Sort by date ${sortValue === 'desc' ? 'ascending' : 'descending'}`;
    }
    list.classList.toggle('locked', entries.length >= 3);
    list.innerHTML = _activityHistoryListHTML(viewId, page, _sortedActivityHistory(page, entries));
  }

  function _activityHistoryListHTML(viewId, page, entries = _activityHistory(page)) {
    if (!entries.length) {
      return `<div class="followup-history-empty">No ${_historyEmptyLabel(page)} logged yet. Your history will appear here as you log activity.</div>`;
    }
    return entries.map(entry => {
      const isOpen = entry.id === _expandedHistoryByKey[page.key];
      const display = _activityHistoryDisplay(page, entry);
      return `<div class="followup-history-row ${isOpen ? 'open' : ''}" role="button" tabindex="0" onclick="WorkflowPages.toggleActivityHistory('${viewId}', '${_escAttr(entry.id)}')" onkeydown="WorkflowPages.handleActivityHistoryKey(event, '${viewId}', '${_escAttr(entry.id)}')">
        <div class="followup-history-line">
          <div class="followup-history-date">${_esc(_formatHistoryDate(entry.date))}</div>
          <div class="followup-history-summary ${isOpen ? 'collapse-label' : ''}">${isOpen ? 'Collapse' : _esc(_truncate(display, 80))}</div>
          <div class="followup-history-actions">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); WorkflowPages.showActivityEditModal('${viewId}', '${_escAttr(entry.id)}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); WorkflowPages.removeActivityHistory('${viewId}', '${_escAttr(entry.id)}')">×</button>
          </div>
          <div class="followup-history-chevron">›</div>
        </div>
        <div class="followup-history-full">${_esc(display)}</div>
      </div>`;
    }).join('');
  }

  function _activityHistory(page) {
    const progress = Storage.get('progress', {});
    const key = _historyStorageKey(page);
    if (!Array.isArray(progress[key])) {
      return Storage.merge('progress', { [key]: [] })[key];
    }
    return progress[key];
  }

  function _prependActivityHistory(viewId, page, payload) {
    const progress = Storage.get('progress', {});
    const key = _historyStorageKey(page);
    const history = Array.isArray(progress[key]) ? progress[key] : [];
    const entry = {
      id: `${page.key}-${Date.now()}`,
      date: new Date().toISOString(),
      ..._historyEntryFromPayload(page, payload),
    };
    Storage.merge('progress', { [key]: [entry, ...history] });
    _expandedHistoryByKey[page.key] = entry.id;
  }

  function toggleActivityHistory(viewId, id) {
    const page = PAGES[viewId];
    if (!page) return;
    _expandedHistoryByKey[page.key] = _expandedHistoryByKey[page.key] === id ? null : id;
    _renderActivityHistory(viewId);
  }

  function toggleActivitySort(viewId, event) {
    const page = PAGES[viewId];
    if (!page) return;
    event?.stopPropagation?.();
    _historySortByKey[page.key] = _historySort(page) === 'desc' ? 'asc' : 'desc';
    _renderActivityHistory(viewId);
  }

  function handleActivityHistoryKey(event, viewId, id) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleActivityHistory(viewId, id);
  }

  function showActivityEditModal(viewId, id) {
    const page = PAGES[viewId];
    if (!page) return;
    const entry = _activityHistory(page).find(item => item.id === id);
    if (!entry) return;

    UI.showModal(`Edit ${_plainTitle(page)}`, _activityEditBody(page, entry), [
      {
        id: 'save', label: 'Save Changes', class: 'btn-primary',
        close: false,
        action: () => {
          const updated = _historyEntryFromEdit(page);
          if (!updated) return;
          const progress = Storage.get('progress', {});
          const key = _historyStorageKey(page);
          const nextHistory = (progress[key] || []).map(item => (
            item.id === id ? { ...item, ...updated } : item
          ));
          Storage.merge('progress', { [key]: nextHistory });
          UI.closeModal();
          _renderActivityHistory(viewId);
        },
      },
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
    ]);
  }

  function removeActivityHistory(viewId, id) {
    const page = PAGES[viewId];
    if (!page || !confirm(`Remove this ${_plainTitle(page).toLowerCase()} entry?`)) return;
    const progress = Storage.get('progress', {});
    const key = _historyStorageKey(page);
    const nextHistory = (progress[key] || []).filter(item => item.id !== id);
    Storage.merge('progress', { [key]: nextHistory });
    if (_expandedHistoryByKey[page.key] === id) _expandedHistoryByKey[page.key] = null;
    _renderActivityHistory(viewId);
  }

  function _historyEntryFromPayload(page, payload) {
    if (page.sideHustle) {
      return {
        income: Math.max(0, parseInt(payload?.income || '0', 10) || 0),
        portfolioEligible: !!payload?.portfolioEligible,
        note: _normalizeNoteText(String(payload?.note || '').trim()),
      };
    }
    return { description: _historyDescription(page, payload?.description || '') };
  }

  function _historyEntryFromEdit(page) {
    if (page.sideHustle) {
      return {
        income: Math.max(0, parseInt(document.getElementById('activity-history-income')?.value || '0', 10) || 0),
        portfolioEligible: !!document.getElementById('activity-history-portfolio')?.checked,
        note: _normalizeNoteText(document.getElementById('activity-history-note')?.value.trim() || ''),
      };
    }
    const description = _historyDescription(page, document.getElementById('activity-history-edit')?.value || '');
    if (!description) {
      UI.notify('History note cannot be empty', 'error');
      return null;
    }
    return { description };
  }

  function _activityEditBody(page, entry) {
    if (page.sideHustle) {
      return `
        <div class="form-row">
          <label>Income ($)</label>
          <input id="activity-history-income" type="number" min="0" value="${_escAttr(entry.income || 0)}">
        </div>
        <label class="workflow-checkbox-line" style="margin:8px 0 12px">
          <input id="activity-history-portfolio" type="checkbox" ${entry.portfolioEligible ? 'checked' : ''}>
          <span>Portfolio eligible</span>
        </label>
        <div class="form-row">
          <label>Short note</label>
          <textarea id="activity-history-note" rows="5" style="resize:vertical;width:100%">${_esc(entry.note || '')}</textarea>
        </div>`;
    }
    return `
      <textarea id="activity-history-edit" rows="6" style="resize:vertical;width:100%"
        placeholder="Describe what you did...">${_esc(entry.description || '')}</textarea>`;
  }

  function _activityHistoryDisplay(page, entry) {
    if (page.sideHustle) {
      const amount = `$${Math.max(0, parseInt(entry.income || '0', 10) || 0)}`;
      const eligible = entry.portfolioEligible ? 'Portfolio eligible' : 'Not portfolio eligible';
      return `${amount} - ${eligible} - ${_normalizeNoteText(entry.note || 'No note')}`;
    }
    return _historyDescription(page, entry.description || '');
  }

  function _historyDescription(page, value) {
    return page.key === 'followups' ? _normalizeFollowupDescription(value) : _normalizeSimpleActivityDescription(value);
  }

  function _historyStorageKey(page) {
    return page.key === 'followups' ? 'followup_history' : `${page.key}_history`;
  }

  function _historyTitle(page) {
    return `${_plainTitle(page)} History`;
  }

  function _historyEmptyLabel(page) {
    return _plainTitle(page).toLowerCase();
  }

  function _historySort(page) {
    return _historySortByKey[page.key] || 'desc';
  }

  function _sortedActivityHistory(page, entries) {
    return [...entries].sort((a, b) => {
      const left = new Date(a.date || 0).getTime();
      const right = new Date(b.date || 0).getTime();
      return _historySort(page) === 'desc' ? right - left : left - right;
    });
  }

  function _formatHistoryDate(value) {
    try {
      return new Date(value)
        .toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        .replace(',', ' ·');
    } catch {
      return '';
    }
  }

  function _sortedFollowupHistory(entries) {
    return [...entries].sort((a, b) => {
      const left = new Date(a.date || 0).getTime();
      const right = new Date(b.date || 0).getTime();
      return _followupHistorySort === 'desc' ? right - left : left - right;
    });
  }

  function _truncate(value, limit) {
    const text = String(value || '');
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  function _displayFollowupDescription(description) {
    return _normalizeFollowupDescription(description);
  }

  function _normalizeFollowupDescription(description) {
    const text = String(description || '').trim();
    const parsed = _parseFollowupDescription(text);
    if (parsed) {
      const prefix = parsed.date ? `${parsed.date} ` : '';
      return `${prefix}${_titleCaseName(parsed.company)} - ${_titleCaseName(parsed.name)}, ${parsed.note}`;
    }

    const dateFirst = text.replace(
      /^(\s*(?:today|yesterday|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s*,\s*)([^,]+)(,?)/i,
      (match, prefix, name, suffix) => `${prefix}${_titleCaseName(name)}${suffix}`,
    );
    if (dateFirst !== text) return dateFirst;
    return text.replace(
      /^(\s*)([a-z][a-z'-]*\s+[a-z][a-z'-]*)(\s*,?\s*(?:today|yesterday|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))/i,
      (match, prefix, name, suffix) => `${prefix}${_titleCaseName(name)}${suffix}`,
    );
  }

  function _parseFollowupDescription(text) {
    const parts = String(text || '').split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) return null;

    const companyFirstDate = _extractDateAndNote(parts[1]);
    if (parts.length >= 4 && companyFirstDate && _looksLikePerson(parts[2])) {
      return {
        company: parts[0],
        date: companyFirstDate.date,
        name: parts[2],
        note: parts.slice(3).join(', ').trim(),
      };
    }

    const nameFirstDate = _extractDateAndNote(parts.slice(2).join(', '));
    if (nameFirstDate && _looksLikePerson(parts[0])) {
      return {
        name: parts[0],
        company: parts[1],
        date: nameFirstDate.date,
        note: nameFirstDate.note,
      };
    }

    if (parts.length >= 3 && _looksLikePerson(parts[0])) {
      return {
        name: parts[0],
        company: parts[1],
        date: '',
        note: parts.slice(2).join(', ').trim(),
      };
    }

    if (parts.length >= 3 && _looksLikePerson(parts[1])) {
      return {
        company: parts[0],
        name: parts[1],
        date: '',
        note: parts.slice(2).join(', ').trim(),
      };
    }

    return null;
  }

  function _normalizeSimpleActivityDescription(description) {
    const text = String(description || '').trim();
    const parsed = _parseSimpleActivityDescription(text);
    if (!parsed) return text;
    return `${_titleCaseName(parsed.company)} - ${_titleCaseName(parsed.name)}, ${parsed.note}`;
  }

  function _parseSimpleActivityDescription(text) {
    const parts = String(text || '').split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    if (_looksLikePerson(parts[0])) {
      return { name: parts[0], company: parts[1], note: parts.slice(2).join(', ').trim() };
    }
    if (_looksLikePerson(parts[1])) {
      return { company: parts[0], name: parts[1], note: parts.slice(2).join(', ').trim() };
    }
    return null;
  }

  function _extractDateAndNote(text) {
    const match = String(text || '').trim().match(/^(today|yesterday|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b[\s,;:-]*(.*)$/i);
    if (!match) return null;
    return { date: match[1], note: match[2].trim() };
  }

  function _looksLikePerson(text) {
    return /\b(?:mr|ms|mrs|dr)\.?\s+[a-z][a-z'-]*\b/i.test(text)
      || /\b(?:man|woman|person|guy|lady|recruiter|manager)\s+named\s+[a-z][a-z'-]*\b/i.test(text)
      || /\b[a-z][a-z'-]*\s+[a-z][a-z'-]*\b/i.test(text);
  }

  function _titleCaseName(name) {
    return String(name || '').replace(/\b([a-z][a-z'-]*)\b/gi, word => (
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ));
  }

  function _sentenceCase(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function _normalizeNoteText(value) {
    const text = _sentenceCase(value);
    const titled = text.replace(/\b(mr|ms|mrs|dr)\.?\s+([a-z][a-z'-]*)\b/gi, (match, title, name) => (
      `${_titleCaseName(title)} ${_titleCaseName(name)}`
    ));
    return titled.replace(/^([a-z][a-z'-]*\s+[a-z][a-z'-]*)(?=,)/i, name => _titleCaseName(name));
  }

  async function ask(viewId) {
    const page = PAGES[viewId];
    const input = document.getElementById(`${viewId}-chat-input`);
    const text = input?.value.trim();
    if (!page || !text) return;

    input.value = '';
    _chatByView[viewId].push({ role: 'user', content: text });
    _renderChat(viewId, true);

    const title = _plainTitle(page);
    const fallback = `Here is the practical way to think about ${title}: start with the smallest next action you can take today, then judge the result after you do it. What part feels unclear right now?`;
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Config.claudeModel(),
          max_tokens: 350,
          stream: false,
          system: `You are a helpful job search coach. The user is on the ${title} page of their job search coaching app. Answer their question specifically and briefly.`,
          messages: [{ role: 'user', content: text }],
        }),
      });
      if (!r.ok) throw new Error('help unavailable');
      const data = await r.json();
      _chatByView[viewId].push({ role: 'assistant', content: data.content?.[0]?.text || fallback });
    } catch {
      _chatByView[viewId].push({ role: 'assistant', content: fallback });
    }
    _renderChat(viewId);
  }

  function _renderChat(viewId, loading = false) {
    const el = document.getElementById(`${viewId}-chat-messages`);
    if (!el) return;
    const msgs = _chatByView[viewId] || [];
    el.innerHTML = msgs.map(m => `
      <div class="workflow-chat-msg ${m.role}">
        <div class="workflow-chat-bubble">${_format(m.content)}</div>
      </div>`).join('') + (loading ? '<div class="workflow-chat-msg assistant"><div class="workflow-chat-bubble">Thinking...</div></div>' : '');
    el.scrollTop = el.scrollHeight;
  }

  function _format(text) {
    return _esc(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>');
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(str) {
    return _esc(str).replace(/'/g, '&#39;');
  }

  function _plainTitle(page) {
    return page.plainTitle || String(page.title || '').replace(/&mdash;/g, '-');
  }

  function _randomQuote(previous) {
    if (QUOTES.length < 2) return QUOTES[0] || '';
    let next = previous;
    while (next === previous) {
      next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
    return next;
  }

  return {
    render,
    submitLog,
    ask,
    toggleActivityHistory,
    toggleActivitySort,
    handleActivityHistoryKey,
    showActivityEditModal,
    removeActivityHistory,
  };
})();
