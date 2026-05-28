/* Applications tracker view */
const Jobs = (() => {

  const STATUSES = ['applied', 'phone', 'interview', 'offer', 'rejected'];
  const STATUS_LABELS = {
    applied:   'Applied',
    phone:     'Phone Screen',
    interview: 'Interview',
    offer:     'Offer',
    rejected:  'No',
  };

  function _defaultData() {
    return { applications: [] };
  }

  function render() {
    const data = Storage.get('jobs', _defaultData());
    const apps = data.applications;
    const container = document.getElementById('jobs-content');

    container.innerHTML = `
      <div class="jobs-toolbar">
        <button class="btn btn-primary btn-sm" onclick="Jobs.showAddModal()">+ Add Application</button>
        <div style="margin-left:auto;font-size:13px;color:var(--text-muted)">
          ${apps.length} application${apps.length !== 1 ? 's' : ''} total
        </div>
      </div>

      ${apps.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">No applications yet.<br>Every mission starts somewhere — log your first one!</div>
           </div>`
        : `<div class="card" style="padding:0;overflow:hidden">
            <table class="jobs-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${apps.map((app, i) => _renderRow(app, i)).join('')}
              </tbody>
            </table>
          </div>`}`;
  }

  function _renderRow(app, i) {
    const statusClass = `status-${app.status}`;
    return `
      <tr>
        <td><strong>${_esc(app.company)}</strong></td>
        <td>${_esc(app.role)}</td>
        <td style="color:var(--text-muted);white-space:nowrap">${_fmtDate(app.date)}</td>
        <td>
          <select class="status-badge ${statusClass}" onchange="Jobs.updateStatus(${i}, this.value)"
            style="border:none;background:transparent;cursor:pointer;font-size:11px;font-weight:700;padding:3px 6px">
            ${STATUSES.map(s => `<option value="${s}" ${app.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </td>
        <td style="color:var(--text-muted);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${_esc(app.notes || '—')}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="Jobs.showEditModal(${i})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="Jobs.remove(${i})" style="margin-left:4px">×</button>
        </td>
      </tr>`;
  }

  function showAddModal(editIndex = null) {
    const data = Storage.get('jobs', _defaultData());
    const app = editIndex !== null ? data.applications[editIndex] : {};
    const isEdit = editIndex !== null;

    const body = `
      <div class="form-row">
        <label>Company Name *</label>
        <input id="j-company" type="text" placeholder="Acme Corp" value="${_esc(app.company || '')}">
      </div>
      <div class="form-row">
        <label>Role / Position *</label>
        <input id="j-role" type="text" placeholder="Marketing Coordinator" value="${_esc(app.role || '')}">
      </div>
      <div class="form-row">
        <label>Date Applied</label>
        <input id="j-date" type="date" value="${app.date || new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-row">
        <label>Status</label>
        <select id="j-status">
          ${STATUSES.map(s => `<option value="${s}" ${app.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Job URL</label>
        <input id="j-url" type="url" placeholder="https://..." value="${_esc(app.url || '')}">
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="j-notes" rows="3" placeholder="Recruiter name, contact info, next steps...">${_esc(app.notes || '')}</textarea>
      </div>`;

    UI.showModal(isEdit ? 'Edit Application' : 'Log New Application', body, [
      {
        id: 'save', label: isEdit ? 'Save Changes' : 'Add Application', class: 'btn-primary',
        close: false,
        action: () => {
          const company = document.getElementById('j-company').value.trim();
          const role    = document.getElementById('j-role').value.trim();
          if (!company || !role) { UI.notify('Company and role are required', 'error'); return; }

          const entry = {
            company,
            role,
            date:   document.getElementById('j-date').value,
            status: document.getElementById('j-status').value,
            url:    document.getElementById('j-url').value.trim(),
            notes:  document.getElementById('j-notes').value.trim(),
          };

          const stored = Storage.get('jobs', _defaultData());
          if (isEdit) {
            stored.applications[editIndex] = entry;
          } else {
            stored.applications.push(entry);
          }
          Storage.set('jobs', stored);
          _checkMilestones(stored.applications);
          UI.closeModal();
          render();
        },
      },
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
    ]);
  }

  function showEditModal(i) { showAddModal(i); }

  function updateStatus(i, status) {
    const data = Storage.get('jobs', _defaultData());
    data.applications[i].status = status;
    Storage.set('jobs', data);
    _checkMilestones(data.applications);
    UI.updateSidebar();
    render();
  }

  function remove(i) {
    if (!confirm('Remove this application?')) return;
    const data = Storage.get('jobs', _defaultData());
    data.applications.splice(i, 1);
    Storage.set('jobs', data);
    render();
  }

  function _checkMilestones(apps) {
    const count = apps.length;
    const state = Milestones.getMissionState('deploy');
    if (count >= 1 && !state.tasks['first_app']) Milestones.toggleTask('deploy', 'first_app');
    if (count >= 10 && !state.tasks['apps_10'])  Milestones.toggleTask('deploy', 'apps_10');
    if (count >= 25 && !state.tasks['apps_25']) {
      const r = Milestones.toggleTask('deploy', 'apps_25');
      if (r.justCompleted) UI.showMissionComplete(r.mission);
    }

    const hasInterview = apps.some(a => ['interview','offer'].includes(a.status));
    const interviewState = Milestones.getMissionState('interview');
    if (hasInterview && !interviewState.tasks['phone_screen']) {
      Milestones.toggleTask('interview', 'phone_screen');
    }

    const hasOffer = apps.some(a => a.status === 'offer');
    const negState = Milestones.getMissionState('negotiate');
    if (hasOffer && !negState.tasks['offer_received']) {
      Milestones.toggleTask('negotiate', 'offer_received');
    }
  }

  function _fmtDate(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render, showAddModal, showEditModal, updateStatus, remove };
})();
