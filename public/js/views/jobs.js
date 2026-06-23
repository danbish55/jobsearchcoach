/* Applications tracker view — Neon-backed via /api/jobs */
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
  let _attentionOnly = false;

  // Statuses considered "in process" — closed-out apps never need attention
  const ACTIVE_STATUSES = ['applied', 'phone', 'interview', 'offer'];
  const STALE_DAYS = 10;

  function _todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function _daysSince(dateStr) {
    if (!dateStr) return null;
    const then = new Date(dateStr + 'T12:00:00').getTime();
    if (Number.isNaN(then)) return null;
    return Math.floor((Date.now() - then) / 86400000);
  }

  // Derive whether an application needs attention, with a reason and severity.
  // Nothing is stored — this is computed fresh each render.
  function _attention(app) {
    if (!ACTIVE_STATUSES.includes(app.status)) return { needs: false, reason: '', severity: '' };
    const today = _todayStr();

    // Overdue follow-up — a date was set and it's today or past
    if (app.follow_up_date && app.follow_up_date <= today) {
      const overdueDays = _daysSince(app.follow_up_date);
      return { needs: true, severity: 'overdue', reason: overdueDays > 0 ? `Follow-up ${overdueDays}d overdue` : 'Follow-up due today' };
    }

    // Stale — sitting in an early stage with no scheduled follow-up
    if (['applied', 'phone'].includes(app.status) && !app.follow_up_date) {
      const age = _daysSince(app.date);
      if (age !== null && age >= STALE_DAYS) {
        return { needs: true, severity: 'stale', reason: `No update in ${age}d` };
      }
    }
    return { needs: false, reason: '', severity: '' };
  }

  function _defaultData() {
    return { applications: [] };
  }

  // ── Server sync ──────────────────────────────────────────────────────────────

  async function initFromServer() {
    try {
      const r = await fetch('/api/jobs');
      if (!r.ok) return;
      const data = await r.json();
      if (data.applications) {
        Storage.set('jobs', data);
      }
    } catch {}
  }

  async function _syncToServer(data) {
    try {
      const r = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const result = await r.json();
        // Update localStorage with server-assigned IDs so new entries aren't re-inserted on next sync
        if (result.applications) {
          Storage.set('jobs', { applications: result.applications });
        }
      }
    } catch {}
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

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

  function toggleAttention() {
    _attentionOnly = !_attentionOnly;
    render();
  }

  function render() {
    const data   = Storage.get('jobs', _defaultData());
    const apps   = data.applications;
    const attentionCount = apps.filter(a => _attention(a).needs).length;
    const sorted = _sortedWithIndex(apps);
    let filtered = _search
      ? sorted.filter(({ app }) => app.company.toLowerCase().includes(_search.toLowerCase()))
      : sorted;
    if (_attentionOnly) {
      filtered = filtered.filter(({ app }) => _attention(app).needs);
    }
    const container = document.getElementById('jobs-content');

    container.innerHTML = `
      <div class="jobs-toolbar">
        <button class="btn btn-primary btn-sm" onclick="Jobs.showAddModal()">+ Add Application</button>
        <button class="btn btn-ghost btn-sm" onclick="Jobs.showImportModal()" style="margin-left:8px">Import CSV</button>
        <button class="btn btn-sm ${_attentionOnly ? 'btn-primary' : 'btn-ghost'}" onclick="Jobs.toggleAttention()" style="margin-left:8px"
          title="Show only applications with an overdue follow-up or no recent movement"${attentionCount === 0 ? ' disabled' : ''}>
          ⚠ Needs attention${attentionCount ? ` (${attentionCount})` : ''}
        </button>
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
            <div class="empty-state-text">No applications yet.<br>Every mission starts somewhere — log your first one!</div>
           </div>`
        : `<div class="card" style="padding:0;overflow:auto">
            <table class="jobs-table">
              <thead>
                <tr>
                  ${_thLabel('company', 'Company')}
                  ${_thLabel('role', 'Role')}
                  <th>Contact</th>
                  ${_thLabel('date', 'Date')}
                  ${_thLabel('status', 'Status')}
                  <th>Next Action</th>
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
    const att = _attention(app);
    const rowStyle = att.needs
      ? `border-left:3px solid ${att.severity === 'overdue' ? 'var(--danger)' : 'var(--gold, #d97706)'}`
      : '';
    return `
      <tr style="${rowStyle}">
        <td><strong>${_esc(app.company)}</strong></td>
        <td>${_esc(app.role)}</td>
        <td style="font-size:12px;line-height:1.4">${_contactCell(app)}</td>
        <td style="color:var(--text-muted);white-space:nowrap">${_fmtDate(app.date)}</td>
        <td>
          <select class="status-badge ${statusClass}" onchange="Jobs.updateStatus(${i}, this.value)"
            style="border:none;background:transparent;cursor:pointer;font-size:11px;font-weight:700;padding:3px 4px;min-width:0;width:auto">
            ${STATUSES.map(s => `<option value="${s}" ${app.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </td>
        <td style="font-size:12px;line-height:1.4;max-width:220px">
          ${_nextActionCell(app, att)}
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

  function _contactCell(app) {
    const parts = [];
    if (app.contact_name)  parts.push(`<div style="font-weight:600">${_esc(app.contact_name)}</div>`);
    if (app.contact_email) parts.push(`<div><a href="mailto:${_esc(app.contact_email)}" style="color:var(--gold,#d97706);text-decoration:none">${_esc(app.contact_email)}</a></div>`);
    if (app.contact_phone) parts.push(`<div style="color:var(--text-muted);white-space:nowrap">${_esc(app.contact_phone)}</div>`);
    if (!parts.length) return `<span style="color:var(--text-muted);opacity:0.5">—</span>`;
    return parts.join('');
  }

  function _nextActionCell(app, att) {
    const parts = [];
    if (app.next_action) {
      parts.push(`<div>${_esc(app.next_action)}</div>`);
    }
    if (app.follow_up_date) {
      const color = att.severity === 'overdue' ? 'var(--danger)' : 'var(--text-muted)';
      parts.push(`<div style="color:${color};white-space:nowrap">📅 ${_fmtDate(app.follow_up_date)}</div>`);
    }
    if (att.needs) {
      const color = att.severity === 'overdue' ? 'var(--danger)' : 'var(--gold, #d97706)';
      parts.push(`<div style="color:${color};font-weight:700">⚠ ${_esc(att.reason)}</div>`);
    }
    if (!parts.length) {
      return `<span style="color:var(--text-muted);opacity:0.5">—</span>`;
    }
    return parts.join('');
  }

  // ── Modals ───────────────────────────────────────────────────────────────────

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
          _syncToServer(stored);
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
        <label>Next Action</label>
        <input id="j-next-action" type="text" placeholder="e.g. Follow up with recruiter, prep for phone screen" value="${_esc(app.next_action || '')}">
      </div>
      <div class="form-row">
        <label>Follow-up Date</label>
        <input id="j-follow-up" type="date" value="${app.follow_up_date || ''}">
      </div>
      <div class="form-row">
        <label>Contact Name</label>
        <input id="j-contact-name" type="text" placeholder="First Last" value="${_esc(app.contact_name || '')}">
      </div>
      <div class="form-row">
        <label>Contact Email</label>
        <input id="j-contact-email" type="email" placeholder="name@company.com" value="${_esc(app.contact_email || '')}">
      </div>
      <div class="form-row">
        <label>Contact Phone</label>
        <input id="j-contact-phone" type="tel" placeholder="(555) 555-5555" value="${_esc(app.contact_phone || '')}">
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
            next_action:    document.getElementById('j-next-action').value.trim(),
            follow_up_date: document.getElementById('j-follow-up').value,
            contact_name:   document.getElementById('j-contact-name').value.trim(),
            contact_email:  document.getElementById('j-contact-email').value.trim(),
            contact_phone:  document.getElementById('j-contact-phone').value.trim(),
            url:    document.getElementById('j-url').value.trim(),
            notes:  document.getElementById('j-notes').value,
          };

          const stored = Storage.get('jobs', _defaultData());
          if (isEdit) {
            stored.applications[editIndex] = { ...stored.applications[editIndex], ...entry };
          } else {
            stored.applications.push(entry);
          }
          Storage.set('jobs', stored);
          _syncToServer(stored);
          _checkMilestones(stored.applications);
          UI.closeModal();
          render();
        },
      },
      { id: 'cancel', label: 'Cancel', class: 'btn-ghost' },
    ]);
  }

  function showEditModal(i) { showAddModal(i); }

  // ── CSV Import ───────────────────────────────────────────────────────────────

  function showImportModal() {
    const body = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Upload a CSV file or paste CSV text below.<br>
        Expected columns (header row required): <code>Company, Role, Date, Status, URL, Notes</code><br>
        Only <strong>Company</strong> is required. Existing entries with the same Company + Role are skipped.
      </p>
      <div class="form-row">
        <label>Upload CSV file</label>
        <input id="j-csv-file" type="file" accept=".csv,text/csv">
      </div>
      <div class="form-row">
        <label>— or paste CSV text —</label>
        <textarea id="j-csv-text" rows="8" placeholder="Company,Role,Date,Status,URL,Notes&#10;Acme Corp,Data Analyst,2026-06-01,applied,,"></textarea>
      </div>
      <div id="j-import-status" style="font-size:13px;margin-top:8px"></div>`;

    UI.showModal('Import Applications from CSV', body, [
      {
        id: 'import', label: 'Import', class: 'btn-primary',
        close: false,
        action: async () => {
          const statusEl = document.getElementById('j-import-status');
          statusEl.textContent = 'Parsing…';

          let csvText = document.getElementById('j-csv-text').value.trim();
          const file = document.getElementById('j-csv-file').files[0];

          if (file && !csvText) {
            csvText = await file.text();
          }

          if (!csvText) {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = 'Please provide a CSV file or paste CSV text.';
            return;
          }

          const rows = _parseCsv(csvText);
          if (rows.length === 0) {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = 'No valid rows found in CSV.';
            return;
          }

          statusEl.style.color = 'var(--text-muted)';
          statusEl.textContent = `Importing ${rows.length} row(s)…`;

          try {
            const r = await fetch('/api/jobs/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            });
            const result = await r.json();

            if (!r.ok) {
              statusEl.style.color = 'var(--danger)';
              statusEl.textContent = result.error || 'Import failed.';
              return;
            }

            statusEl.style.color = 'var(--success, green)';
            statusEl.textContent = `Done — ${result.inserted} imported, ${result.skipped} skipped (duplicates or missing company).`;

            // Refresh local cache from server
            await initFromServer();
            render();
          } catch (err) {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = 'Network error: ' + err.message;
          }
        },
      },
      { id: 'close', label: 'Close', class: 'btn-ghost' },
    ]);
  }

  function _parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = _splitCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const col = key => {
      const aliases = {
        company: ['company', 'company name', 'employer'],
        role:    ['role', 'position', 'title', 'job title'],
        date:    ['date', 'date applied', 'applied date', 'applied'],
        status:  ['status'],
        url:     ['url', 'link', 'job url', 'job link'],
        notes:   ['notes', 'note', 'comments'],
      };
      for (const alias of (aliases[key] || [])) {
        const idx = headers.indexOf(alias);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const companyIdx = col('company');
    if (companyIdx < 0) return [];

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = _splitCsvLine(lines[i]);
      const company = (cells[companyIdx] || '').trim();
      if (!company) continue;
      rows.push({
        company,
        role:   (cells[col('role')]   || '').trim(),
        date:   (cells[col('date')]   || '').trim(),
        status: (cells[col('status')] || '').trim(),
        url:    (cells[col('url')]    || '').trim(),
        notes:  (cells[col('notes')]  || '').trim(),
      });
    }
    return rows;
  }

  function _splitCsvLine(line) {
    const cells = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  function updateStatus(i, status) {
    const data = Storage.get('jobs', _defaultData());
    data.applications[i].status = status;
    Storage.set('jobs', data);
    _syncToServer(data);
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
    _syncToServer(stored);
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
    _syncToServer(data);
    render();
  }

  // ── Milestones ───────────────────────────────────────────────────────────────

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

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

  return {
    render, sortBy, setSearch, toggleAttention,
    showAddModal, showEditModal, showNotesModal, showImportModal,
    updateStatus, addApplication, remove, initFromServer,
    _findExistingApplicationIndex,
  };
})();
