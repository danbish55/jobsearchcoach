/* UI — navigation, notifications, modals, gauge */
const UI = (() => {

  function init() {
    // Wire up sidebar nav
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
      el.addEventListener('click', () => App.navigate(el.dataset.view));
    });
    loadTheme();
    updateSidebar();
  }

  function loadTheme() {
    const saved = localStorage.getItem('jsc_theme') || 'dark';
    applyTheme(saved);
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

  function updateSidebar() {
    const profile = Storage.get('profile', {});
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) nameEl.textContent = profile.name ? `Hi, ${profile.name} 👋` : 'Welcome!';

    // Mission progress
    const currentMission = Milestones.getCurrentMission();
    const progress = Milestones.getMissionProgress(currentMission.id);
    const nameDisplay = document.getElementById('sidebar-mission-name');
    const bar = document.getElementById('sidebar-mission-progress');
    if (nameDisplay) nameDisplay.textContent = currentMission.codename;
    if (bar) bar.style.width = progress.pct + '%';

    // USC gauge
    updateGauge();
  }

  function updateGauge() {
    // Sidebar USC gauge removed — usc data preserved in storage for coach context
  }

  function setActiveNav(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(`view-${viewId}`);
    if (el) el.classList.add('active');
    setActiveNav(viewId);
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
  function showModal(title, bodyHTML, buttons = []) {
    const container = document.getElementById('modal-container');
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
    document.getElementById('active-modal')?.addEventListener('click', e => {
      if (e.target.id === 'active-modal') closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  }

  // Mission complete celebration
  function showMissionComplete(mission) {
    const overlay = document.getElementById('mission-complete-overlay');
    document.getElementById('mc-title').textContent = `Mission ${mission.codename} Complete`;
    document.getElementById('mc-sub').textContent = mission.title;
    document.getElementById('mc-next').textContent = mission.nextBriefing || 'Prepare for your next mission.';
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

  return { init, updateSidebar, updateGauge, setActiveNav, showView, notify, showModal, closeModal, showMissionComplete, closeMissionComplete, showGaugeModal, toggleTheme };
})();
