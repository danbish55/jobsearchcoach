/* Settings view */
const Settings = (() => {
  const DEFAULT_CONTACTS = {
    name: 'Corinne',
    student_email: 'corinne@example.com',
    parent1_name: 'Dad',
    parent1_email: 'contact@example.com',
    parent2_name: 'Mom',
    parent2_email: 'supporter@example.com',
  };

  const DATA_KEYS = [
    'profile',
    'milestones',
    'jobs',
    'usc',
    'resume',
    'sessions',
    'gauges',
    'job_target_tracker',
    'mission_discussion_dossier',
    'mission_discussion_network',
    'mission_discussion_deploy',
    'mission_discussion_interview',
    'mission_discussion_negotiate',
    'mission_discussion_extraction',
  ];

  function render() {
    const status = Config.get() || {};
    const profile = Storage.get('profile', {});
    const container = document.getElementById('settings-content');

    container.innerHTML = `
      <div style="max-width:600px">

        <!-- Profile -->
        <div class="settings-section">
          <div class="settings-section-title">Your Profile</div>

          <div class="setting-row">
            <span class="setting-label">Name</span>
            <div class="setting-control">
              <input id="s-name" type="text" value="${_esc(profile.name || DEFAULT_CONTACTS.name)}" placeholder="Your name">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Email</span>
            <div class="setting-control">
              <input id="s-student-email" type="email" value="${_esc(profile.student_email || DEFAULT_CONTACTS.student_email)}" placeholder="corinne@example.com">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">School</span>
            <div class="setting-control">
              <input id="s-school" type="text" value="${_esc(profile.school || 'USC')}" placeholder="School name">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Grad Year</span>
            <div class="setting-control" style="max-width:120px">
              <input id="s-grad" type="text" value="${_esc(profile.grad_year || '')}" placeholder="2024">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Major</span>
            <div class="setting-control">
              <input id="s-major" type="text" value="${_esc(profile.major || '')}" placeholder="Your major">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Target Roles</span>
            <div class="setting-control">
              <input id="s-roles" type="text"
                value="${_esc((profile.target_roles || []).join(', '))}"
                placeholder="Marketing Coordinator, Brand Manager">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Comma-separated</div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Target Industries</span>
            <div class="setting-control">
              <input id="s-industries" type="text"
                value="${_esc((profile.target_industries || []).join(', '))}"
                placeholder="Tech, Entertainment, Media">
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Comma-separated</div>
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveProfile()">Save Profile</button>
          </div>
        </div>

        <!-- Report Emails -->
        <div class="settings-section">
          <div class="settings-section-title">Progress Report Recipients</div>
          <div class="setting-row">
            <span class="setting-label">Recipient 1 Name</span>
            <div class="setting-control">
              <input id="s-p1-name" type="text" value="${_esc(profile.parent1_name || DEFAULT_CONTACTS.parent1_name)}" placeholder="Dad">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Dad's Email</span>
            <div class="setting-control">
              <input id="s-p1-email" type="email" value="${_esc(profile.parent1_email || DEFAULT_CONTACTS.parent1_email)}" placeholder="dad@example.com">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Recipient 2 Name</span>
            <div class="setting-control">
              <input id="s-p2-name" type="text" value="${_esc(profile.parent2_name || DEFAULT_CONTACTS.parent2_name)}" placeholder="Mom">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Mom's Email</span>
            <div class="setting-control">
              <input id="s-p2-email" type="email" value="${_esc(profile.parent2_email || DEFAULT_CONTACTS.parent2_email)}" placeholder="mom@example.com">
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveParentEmails()">Save Emails</button>
          </div>
        </div>

        <!-- API Key -->
        <div class="settings-section">
          <div class="settings-section-title">Coach Access Key</div>
          <div class="setting-row">
            <span class="setting-label">Access Key</span>
            <div class="api-key-display">
              <span class="api-key-dots">${status.has_api_key ? '●●●●●●●●●●●●●●●●●●●●' : 'Not configured'}</span>
              <span style="font-size:12px;color:${status.has_api_key ? 'var(--success)' : 'var(--danger)'}">
                ${status.has_api_key ? '✓ Saved' : '✗ Missing'}
              </span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Update Key</span>
            <div class="setting-control">
                <input id="s-apikey" type="password" placeholder="Paste a replacement key from Dad"
                autocomplete="off" style="font-family:monospace">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Model</span>
            <div class="setting-control">
              <div style="font-family:monospace;font-size:13px;color:var(--text-muted)">
                claude-sonnet-4-5 (fixed)
              </div>
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveApiKey()">Update API Key</button>
          </div>
        </div>

        <!-- Google Drive -->
        <div class="settings-section">
          <div class="settings-section-title">Google Drive Sync</div>
          <div class="setting-row">
            <span class="setting-label">Status</span>
            <div class="drive-status-badge ${status.has_drive ? 'connected' : 'disconnected'}">
              ${status.has_drive ? '✓ Connected' : '✗ Not connected'}
            </div>
          </div>
          ${!status.has_drive ? `
          ${status.google_client_id ? `
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
              Sign in with Corinne's Gmail account to save app data in Google Drive.
            </div>
          ` : `
            <div class="setting-row">
              <span class="setting-label">Client ID</span>
              <div class="setting-control">
                <input id="s-gclient-id" type="text" placeholder="123456789-xxx.apps.googleusercontent.com"
                  style="font-family:monospace;font-size:12px">
              </div>
            </div>
            <div class="setting-row">
              <span class="setting-label">Client Secret</span>
              <div class="setting-control">
                <input id="s-gclient-secret" type="password" placeholder="GOCSPX-..."
                  style="font-family:monospace;font-size:12px">
              </div>
            </div>
          `}
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.connectDrive()">Connect Google Drive</button>
          </div>` : `
          <div style="margin-top:4px">
            <button class="btn btn-ghost btn-sm" onclick="Settings.disconnectDrive()">Disconnect Drive</button>
          </div>`}
        </div>

        <!-- Data -->
        <div class="settings-section">
          <div class="settings-section-title">Data</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="Settings.exportData()">Export All Data</button>
            <button class="btn btn-ghost btn-sm" onclick="Settings.chooseBackupFile()">Reload from Backup</button>
            <button class="btn btn-danger btn-sm" onclick="Settings.resetAll()">Reset Everything</button>
            <input id="backup-file-input" type="file" accept="application/json,.json" style="display:none"
              onchange="Settings.restoreBackup(this.files && this.files[0])">
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Export saves a JSON file of all your data. Reset clears localStorage — your config.json on disk is preserved.
          </div>
        </div>
      </div>`;
  }

  function saveProfile() {
    const updates = {
      name:               document.getElementById('s-name').value.trim(),
      student_email:      document.getElementById('s-student-email').value.trim(),
      school:             document.getElementById('s-school').value.trim(),
      grad_year:          document.getElementById('s-grad').value.trim(),
      major:              document.getElementById('s-major').value.trim(),
      target_roles:       document.getElementById('s-roles').value.split(',').map(s=>s.trim()).filter(Boolean),
      target_industries:  document.getElementById('s-industries').value.split(',').map(s=>s.trim()).filter(Boolean),
    };
    Storage.merge('profile', updates);
    UI.updateSidebar();
    UI.notify('Profile saved', 'success');
  }

  function saveParentEmails() {
    const updates = {
      parent1_name:  document.getElementById('s-p1-name').value.trim() || DEFAULT_CONTACTS.parent1_name,
      parent1_email: document.getElementById('s-p1-email').value.trim(),
      parent2_name:  document.getElementById('s-p2-name').value.trim() || DEFAULT_CONTACTS.parent2_name,
      parent2_email: document.getElementById('s-p2-email').value.trim(),
    };
    Storage.merge('profile', updates);
    UI.notify('Report emails saved', 'success');
  }

  async function saveApiKey() {
    const key = document.getElementById('s-apikey')?.value.trim();
    if (!key) { UI.notify('Enter the new access key first', 'error'); return; }
    if (!key.startsWith('sk-')) { UI.notify('Key should start with sk-', 'error'); return; }
    await Config.save({ anthropic_api_key: key });
    document.getElementById('s-apikey').value = '';
    UI.notify('Access key updated', 'success');
    render();
  }

  async function connectDrive() {
    const status = Config.get() || {};
    const clientId = status.google_client_id || document.getElementById('s-gclient-id')?.value.trim();
    const clientSecret = document.getElementById('s-gclient-secret')?.value.trim();
    if (!clientId) { UI.notify('Google Drive setup is missing. Ask Dad for the prepared package.', 'error'); return; }
    if (!status.google_client_id && !clientSecret) { UI.notify('Enter both Client ID and Secret', 'error'); return; }
    if (!status.google_client_id) await Config.save({ google_client_id: clientId, google_client_secret: clientSecret });
    UI.notify('Opening Google auth window...', 'info');
    try {
      await Drive.startOAuth(clientId);
      UI.notify('Google Drive connected!', 'success');
      await Config.load();
      await Drive.init();
      await Storage.syncAllToDrive();
      render();
    } catch (err) {
      UI.notify(`Drive auth failed: ${err.message}`, 'error');
    }
  }

  async function disconnectDrive() {
    if (!confirm('Disconnect Google Drive? Your local data is not affected.')) return;
    await Config.save({ google_access_token: '', google_refresh_token: '' });
    UI.notify('Google Drive disconnected', 'info');
    await Config.load();
    render();
  }

  function exportData() {
    _downloadBackup();
    UI.notify('Backup exported', 'success');
  }

  function chooseBackupFile() {
    document.getElementById('backup-file-input')?.click();
  }

  function _collectData() {
    return {
      config_status: Config.get() || {},
      theme: localStorage.getItem('jsc_theme') || 'dark',
      last_view: sessionStorage.getItem('jsc_last_view') || 'dashboard',
      profile:    Storage.get('profile', {}),
      milestones: Storage.get('milestones', {}),
      jobs:       Storage.get('jobs', {}),
      usc:        Storage.get('usc', {}),
      resume:     Storage.get('resume', {}),
      gauges:     Storage.get('gauges', {}),
      job_target_tracker: Storage.get('job_target_tracker', {}),
      mission_discussions: {
        dossier:    Storage.get('mission_discussion_dossier', []),
        network:    Storage.get('mission_discussion_network', []),
        deploy:     Storage.get('mission_discussion_deploy', []),
        interview:  Storage.get('mission_discussion_interview', []),
        negotiate:  Storage.get('mission_discussion_negotiate', []),
        extraction: Storage.get('mission_discussion_extraction', []),
      },
      sessions:   Storage.get('sessions', {}),
    };
  }

  function _downloadBackup() {
    const version = _nextBackupVersion(true);
    const data = {
      exported: new Date().toISOString(),
      backup_version: version,
      filename_format: 'YYYYMMDD vX db JobSearchCoach.json',
      data: _collectData(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${_todayStamp()} v${version} db JobSearchCoach.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const data = backup.data || backup;
      if (!data || typeof data !== 'object') throw new Error('Backup file is empty.');
      _restoreKey('profile', data.profile);
      _restoreKey('milestones', data.milestones);
      _restoreKey('jobs', data.jobs);
      _restoreKey('usc', data.usc);
      _restoreKey('resume', data.resume);
      _restoreKey('gauges', data.gauges);
      _restoreKey('job_target_tracker', data.job_target_tracker);
      _restoreKey('sessions', data.sessions);
      const discussions = data.mission_discussions || {};
      _restoreKey('mission_discussion_dossier', discussions.dossier);
      _restoreKey('mission_discussion_network', discussions.network);
      _restoreKey('mission_discussion_deploy', discussions.deploy);
      _restoreKey('mission_discussion_interview', discussions.interview);
      _restoreKey('mission_discussion_negotiate', discussions.negotiate);
      _restoreKey('mission_discussion_extraction', discussions.extraction);
      if (data.theme) localStorage.setItem('jsc_theme', data.theme);
      if (data.last_view) sessionStorage.setItem('jsc_last_view', data.last_view);
      UI.notify('Backup restored. Reloading...', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      UI.notify(`Backup restore failed: ${err.message}`, 'error');
    } finally {
      const input = document.getElementById('backup-file-input');
      if (input) input.value = '';
    }
  }

  function _restoreKey(key, value) {
    if (value !== undefined) Storage.set(key, value);
  }

  function resetAll() {
    if (!confirm('This will back up your data first, then clear ALL job search data from this browser. Continue?')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    _downloadBackup();
    DATA_KEYS.forEach(k => Storage.remove(k));
    UI.notify('Backup created. Data cleared. Reloading...', 'info');
    setTimeout(() => location.reload(), 1500);
  }

  function _todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  function _nextBackupVersion(increment) {
    const today = _todayStamp();
    const key = 'jsc_backup_version';
    let info = {};
    try { info = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const current = info.date === today ? Number(info.version || 0) : 0;
    const next = current + 1;
    if (increment) localStorage.setItem(key, JSON.stringify({ date: today, version: next }));
    return next;
  }

  function _esc(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, saveProfile, saveParentEmails, saveApiKey, connectDrive, disconnectDrive, exportData, chooseBackupFile, restoreBackup, resetAll };
})();
