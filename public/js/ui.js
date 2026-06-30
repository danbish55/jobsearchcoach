/* UI — navigation, notifications, modals, gauge */
const UI = (() => {

  function init() {
    // Wire up sidebar nav
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => App.navigate(el.dataset.view));
    });
    loadTheme();
    _ensureSidebarTooltips();
    _loadSidebarState();
    updateSidebar();
  }

  function loadTheme() {
    const saved = localStorage.getItem('jsc_theme') || 'light';
    applyTheme(saved);
  }

  function _systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function toggleTheme() {
    const current = document.body.classList.contains('light') ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('jsc_theme', next);
    applyTheme(next);
  }

  function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    const icon  = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon)  icon.textContent  = theme === 'light' ? '🌙' : '☀️';
    if (label) label.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
  }

  function toggleSidebarCollapsed() {
    const next = !document.body.classList.contains('sidebar-collapsed');
    _applySidebarCollapsed(next);
    try {
      localStorage.setItem('jsc_sidebar_collapsed', next ? 'true' : 'false');
    } catch {}
  }

  function _loadSidebarState() {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem('jsc_sidebar_collapsed') === 'true';
    } catch {}
    _applySidebarCollapsed(collapsed);
  }

  function _applySidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const btn = document.getElementById('sidebar-collapse-btn');
    const icon = document.getElementById('sidebar-collapse-icon');
    if (btn) {
      btn.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
      btn.setAttribute('title', collapsed ? 'Expand navigation' : 'Collapse navigation');
    }
    if (icon) icon.textContent = collapsed ? '›' : '‹';
  }

  function _ensureSidebarTooltips() {
    document.querySelectorAll('.nav-item[data-view], .sidebar-utility-btn').forEach(item => {
      const label = item.textContent.replace(/\s+/g, ' ').trim();
      if (label) {
        item.setAttribute('title', label);
        item.setAttribute('aria-label', label);
      }
    });
  }

  function updateSidebar() {
    const profile = Storage.get('profile', {});
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) nameEl.textContent = profile.name ? `Hi, ${profile.name}` : 'Welcome!';

    // USC gauge
    updateGauge();
    updateMissionPageButtons();
  }

  function updateGauge() {
    // Sidebar USC gauge removed — usc data preserved in storage for coach context
  }

  function setActiveNav(viewId) {
    document.querySelectorAll('.nav-item, .sidebar-icon-btn[data-view]').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
    updateMissionPageButtons(viewId);
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(`view-${viewId}`);
    if (el) el.classList.add('active');
    setActiveNav(viewId);
  }

  function updateMissionPageButtons(viewId = App.getCurrentView?.()) {
    const wrap = document.getElementById('sidebar-mission-pages');
    const target = document.getElementById('sidebar-mission-page-buttons');
    if (!wrap || !target || typeof Milestones === 'undefined') return;

    const show = viewId === 'mission-discussion';
    wrap.classList.toggle('hidden', !show);
    if (!show) return;

    const activeMission = typeof MissionDiscussion !== 'undefined'
      ? MissionDiscussion.getCurrentMissionId()
      : null;

    target.innerHTML = Milestones.getDefs().map(m => `
      <button class="sidebar-mission-page-btn ${m.id === activeMission ? 'active' : ''}"
        onclick="MissionDiscussion.open('${m.id}')">
        <span class="sidebar-mission-page-icon">${m.icon}</span>
        <span>
          <span class="sidebar-mission-page-code">${m.codename}</span>
          <span class="sidebar-mission-page-title">${m.title}</span>
        </span>
      </button>
    `).join('');
  }

  // Notifications
  function notify(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // Generic modal
  function showModal(title, bodyHTML, buttons = [], options = {}) {
    const container = document.getElementById('modal-container');
    const closeOnBackdrop = options.closeOnBackdrop !== false;
    container.innerHTML = `
      <div class="modal-backdrop" id="active-modal">
        <div class="modal">
          <div class="modal-title">${title}</div>
          <div class="modal-body">${bodyHTML}</div>
          <div class="modal-footer">
            ${buttons.map(b => `<button class="btn ${b.class || 'btn-ghost'}" id="modal-btn-${b.id}">${b.label}</button>`).join('')}
          </div>
        </div>
      </div>`;

    buttons.forEach(b => {
      document.getElementById(`modal-btn-${b.id}`)?.addEventListener('click', () => {
        b.action && b.action();
        if (b.close !== false) closeModal();
      });
    });

    // Click backdrop to close
    if (closeOnBackdrop) {
      document.getElementById('active-modal')?.addEventListener('click', e => {
        if (e.target.id === 'active-modal') closeModal();
      });
    }
  }

  function closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  }

  // Phase complete celebration
  function showMissionComplete(mission) {
    const overlay = document.getElementById('mission-complete-overlay');
    document.getElementById('mc-title').textContent = `Fight On! ${mission.codename} Complete`;
    document.getElementById('mc-sub').textContent = mission.title;
    document.getElementById('mc-next').textContent = mission.nextBriefing || 'Get ready for the next phase. Fight On!';
    overlay.classList.remove('hidden');
  }

  function closeMissionComplete() {
    document.getElementById('mission-complete-overlay').classList.add('hidden');
    updateSidebar();
    Dashboard.render();
  }

  // USC Gauge detail modal
  function showGaugeModal() {
    const usc = Storage.get('usc', { alumni_dms: 0, coffee_chats: 0, events_attended: 0, career_center_visits: 0 });

    const body = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
        Track your USC Trojan network activity. Fight On! ✌️
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        ${[
          { key: 'alumni_dms',          label: 'Alumni DMs Sent',       target: 5  },
          { key: 'coffee_chats',        label: 'Coffee Chats',           target: 3  },
          { key: 'events_attended',     label: 'USC Events Attended',    target: 2  },
          { key: 'career_center_visits',label: 'Career Center Visits',   target: 2  },
        ].map(item => `
          <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${item.label}</div>
            <div style="font-size:24px;font-weight:800;color:var(--gold)">${usc[item.key] || 0}</div>
            <div style="font-size:11px;color:var(--text-muted)">target: ${item.target}</div>
          </div>
        `).join('')}
      </div>
      <div class="divider"></div>
      <p style="font-size:13px;font-weight:600;margin-bottom:10px">Log new activity:</p>
      <div style="display:flex;flex-direction:column;gap:8px" id="gauge-log-fields">
        ${[
          { key: 'alumni_dms',           label: 'Add Alumni DM',         placeholder: '0' },
          { key: 'coffee_chats',         label: 'Add Coffee Chat',        placeholder: '0' },
          { key: 'events_attended',      label: 'Add Event Attended',     placeholder: '0' },
          { key: 'career_center_visits', label: 'Add Career Center Visit',placeholder: '0' },
        ].map(f => `
          <div style="display:flex;align-items:center;gap:8px">
            <label style="flex:1;font-size:13px">${f.label}</label>
            <input type="number" id="gauge-input-${f.key}" min="0" max="99" placeholder="${f.placeholder}"
              style="width:70px;text-align:center">
          </div>
        `).join('')}
      </div>`;

    showModal('USC Alumni Network 🎓', body, [
      {
        id: 'save', label: 'Save', class: 'btn-gold',
        close: false,
        action: () => {
          const fields = ['alumni_dms','coffee_chats','events_attended','career_center_visits'];
          const updates = { ...usc };
          fields.forEach(k => {
            const val = parseInt(document.getElementById(`gauge-input-${k}`)?.value || '0', 10);
            if (!isNaN(val) && val > 0) updates[k] = (updates[k] || 0) + val;
          });
          Storage.set('usc', updates);
          updateGauge();
          notify('USC network activity logged! Fight On! ✌️', 'success');
          closeModal();
        },
      },
      { id: 'close', label: 'Close', class: 'btn-ghost' },
    ]);
  }

  return { init, updateSidebar, updateGauge, setActiveNav, showView, notify, showModal, closeModal, showMissionComplete, closeMissionComplete, showGaugeModal, toggleTheme, toggleSidebarCollapsed };
})();
