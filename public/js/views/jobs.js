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

  // Sort and search state persist across re-renders
  let _sort   = { col: 'date', dir: 'desc' };
  let _search = '';

  function _defaultData() {
    return { applications: [] };
  }

  function _sortedWithIndex(apps) {
    const { col, dir } = _sort;
    const mult = dir === 'asc' ? 1 : -1;
    const statusOrder = ['offer', 'interview', 'phone', 'applied', 'rejected'];

    return apps
      .map((app, i) => ({ app, i }))
      .sort((a, b) => {
        let va = a.app[col] || '';
        let vb = b.app[col] || '';

        if (col === 'date') {
          va = va || '0000-00-00';
          vb = vb || '0000-00-00';
          return va < vb ? -mult : va > vb ? mult : 0;
        }
        if (col === 'status') {
          return (statusOrder.indexOf(va) - statusOrder.indexOf(vb)) * mult;
        }
        return va.toLowerCase() < vb.toLowerCase() ? -mult : va.toLowerCase() > vb.toLowerCase() ? mult : 0;
      });
  }

  function _thLabel(col, label) {
    const active = _sort.col === col;
    const arrow  = active ? (_sort.dir === 'asc' ? ' ▲' : ' ▼') : ' <span style="opacity:0.25">⇅</span>';
    return `<th class="sortable${active ? ' sort-active' : ''}" onclick="Jobs.sortBy('${col}')">${label}${arrow}</th>`;
  }

  function setSearch(val) {
    _search = val;
    render();
  }

  function render() {
    const data   = Storage.get('jobs', _defaultData());
    const apps   = data.applications;
    const sorted = _sortedWithIndex(apps);
    const filtered = _search
      ? sorted.filter(({ app }) => app.company.toLowerCase().includes(_search.toLowerCase()))
      : sorted;
    const container = document.getElementById('jobs-content');

    container.innerHTML = `
      <div class="jobs-toolbar">
        <button class="btn btn-primary btn-sm" onclick="Jobs.showAddModal()">+ Add Application</button>
        <input type="text" placeholder="Search company…" value="${_search}"
          oninput="Jobs.setSearch(this.value)"
          style="width:180px;margin-left:12px;padding:6px 10px;font-size:13px">
        <div style="margin-left:auto;font-size:13px;color:var(--text-muted)">
          ${filtered.length === apps.length
            ? `${apps.length} application${apps.length !== 1 ? 's' : ''} total`
            : `${filtered.length} of ${apps.length} shown`}
        </div>
      </div>

      ${apps.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">No applications yet.<br>Every Trojan starts somewhere — log your first one!</div>
           </div>`
        : `<div class="card" style="padding:0;overflow:auto">
            <table class="jobs-table">
              <thead>
                <tr>
                  ${_thLabel('company', 'Company')}
                  ${_thLabel('role', 'Role')}
                  ${_thLabel('date', 'Date')}
                  ${_thLabel('status', 'Status')}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(({ app, i }) => _renderRow(app, i)).join('')}
              </tbody>
            </table>
          </div>`}`;
  }

  function sortBy(col) {
    if (_sort.col === col) {
      _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      _sort.col = col;
      _sort.dir = 'asc';
    }
    render();
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
            style="border:none;background:transparent;cursor:pointer;font-size:11px;font-weight:700;padding:3px 6px;min-width:100px">
            ${STATUSES.map(s => `<option value="${s}" ${app.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="Jobs.showNotesModal(${i})">
            📝 Notes
          </button>
          <button class="btn btn-ghost btn-sm" onclick="Jobs.showEditModal(${i})" style="margin-left:4px">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="Jobs.remove(${i})" style="margin-left:4px">×</button>
        </td>
      </tr>`;
  }

  function showNotesModal(i) {
    const data = Storage.get('jobs', _defaultData());
    const app = data.applications[i];

    const body = `
      <textarea id="j-notes-edit" rows="10" style="resize:vertical;width:100%"
        placeholder="Recruiter name, contact info, interview notes, next steps, anything...">${_esc(app.notes || '')}</textarea>`;

    UI.showModal(`Notes — ${_esc(app.company)}`, body, [
      {
        id: 'save', label: 'Save Notes', class: 'btn-primary',
        close: false,
        action: () => {
          const stored = Storage.get('jobs', _defaultData());
          stored.applications[i].notes = document.getElementById('j-notes-edit').value;
          Storage.set('jobs', stored);
          UI.closeModal();
          render();
        },
      },
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
    ]);
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
        <textarea id="j-notes" rows="4" placeholder="Recruiter name, contact info, next steps...">${_esc(app.notes || '')}</textarea>
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
            notes:  document.getElementById('j-notes').value,
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

  function addApplication(entry) {
    const stored = Storage.get('jobs', _defaultData());
    const existingIndex = _findExistingApplicationIndex(stored.applications, entry);
    if (existingIndex >= 0) {
      stored.applications[existingIndex] = {
        ...stored.applications[existingIndex],
        ...entry,
        status: entry.status || stored.applications[existingIndex].status,
      };
    } else {
      stored.applications.push(entry);
    }
    Storage.set('jobs', stored);
    _checkMilestones(stored.applications);
    UI.updateSidebar();
    if (document.getElementById('view-jobs')?.classList.contains('active')) render();
    return entry;
  }

  function _findExistingApplicationIndex(applications, entry) {
    const incomingLeadId = String(entry?.source_lead_id || entry?.lead_id || '').trim().toLowerCase();
    if (incomingLeadId) {
      const byLeadId = applications.findIndex(app => String(app?.source_lead_id || app?.lead_id || '').trim().toLowerCase() === incomingLeadId);
      if (byLeadId >= 0) return byLeadId;
    }

    const incomingUrl = String(entry?.url || '').trim().toLowerCase();
    if (incomingUrl) {
      const byUrl = applications.findIndex(app => String(app?.url || '').trim().toLowerCase() === incomingUrl);
      if (byUrl >= 0) return byUrl;
    }

    const company = _normalizeKey(entry?.company);
    const role = _normalizeKey(entry?.role || entry?.title);
    if (!company || !role) return -1;
    return applications.findIndex(app => _normalizeKey(app?.company) === company && _normalizeKey(app?.role || app?.title) === role);
  }

  function _normalizeKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
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
    if (count >= 1  && !state.tasks['first_app']) Milestones.toggleTask('deploy', 'first_app');
    if (count >= 10 && !state.tasks['apps_10'])  Milestones.toggleTask('deploy', 'apps_10');
    if (count >= 25 && !state.tasks['apps_25']) {
      const r = Milestones.toggleTask('deploy', 'apps_25');
      if (r.justCompleted) UI.showMissionComplete(r.mission);
    }

    const hasInterview = apps.some(a => ['interview', 'offer'].includes(a.status));
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

  return { render, sortBy, setSearch, showAddModal, showEditModal, showNotesModal, updateStatus, addApplication, remove, _findExistingApplicationIndex };
})();
