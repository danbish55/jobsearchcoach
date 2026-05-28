/* Dashboard view */
const Dashboard = (() => {

  function render() {
    const profile = Storage.get('profile', {});

    // Welcome text
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = profile.name || 'there';
    document.getElementById('dash-welcome').textContent = `${greeting}, ${name}`;
    document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

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

  return { render, toggleTask };
})();
