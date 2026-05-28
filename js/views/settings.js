/* Settings view */
const Settings = (() => {

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
              <input id="s-name" type="text" value="${_esc(profile.name || '')}" placeholder="Your name">
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

        <!-- Parent Emails -->
        <div class="settings-section">
          <div class="settings-section-title">Progress Report Recipients</div>
          <div class="setting-row">
            <span class="setting-label">Parent 1 Name</span>
            <div class="setting-control">
              <input id="s-p1-name" type="text" value="${_esc(profile.parent1_name || 'Dad')}" placeholder="Dad">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Parent 1 Email</span>
            <div class="setting-control">
              <input id="s-p1-email" type="email" value="${_esc(profile.parent1_email || '')}" placeholder="dad@example.com">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Parent 2 Name</span>
            <div class="setting-control">
              <input id="s-p2-name" type="text" value="${_esc(profile.parent2_name || 'Mom')}" placeholder="Mom">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Parent 2 Email</span>
            <div class="setting-control">
              <input id="s-p2-email" type="email" value="${_esc(profile.parent2_email || '')}" placeholder="mom@example.com">
            </div>
          </div>
          <div style="margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Settings.saveParentEmails()">Save Emails</button>
          </div>
        </div>

        <!-- API Key -->
        <div class="settings-section">
          <div class="settings-section-title">Claude API</div>
          <div class="setting-row">
            <span class="setting-label">API Key</span>
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
              <input id="s-apikey" type="password" placeholder="sk-ant-... (enter to replace)"
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
            <button class="btn btn-danger btn-sm" onclick="Settings.resetAll()">Reset Everything</button>
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
      parent1_name:  document.getElementById('s-p1-name').value.trim() || 'Dad',
      parent1_email: document.getElementById('s-p1-email').value.trim(),
      parent2_name:  document.getElementById('s-p2-name').value.trim() || 'Mom',
      parent2_email: document.getElementById('s-p2-email').value.trim(),
    };
    Storage.merge('profile', updates);
    UI.notify('Parent emails saved', 'success');
  }

  async function saveApiKey() {
    const key = document.getElementById('s-apikey')?.value.trim();
    if (!key) { UI.notify('Enter a new API key first', 'error'); return; }
    if (!key.startsWith('sk-')) { UI.notify('Key should start with sk-', 'error'); return; }
    await Config.save({ anthropic_api_key: key });
    document.getElementById('s-apikey').value = '';
    UI.notify('API key updated', 'success');
    render();
  }

  async function connectDrive() {
    const clientId     = document.getElementById('s-gclient-id')?.value.trim();
    const clientSecret = document.getElementById('s-gclient-secret')?.value.trim();
    if (!clientId || !clientSecret) { UI.notify('Enter both Client ID and Secret', 'error'); return; }
    await Config.save({ google_client_id: clientId, google_client_secret: clientSecret });
    UI.notify('Opening Google auth window...', 'info');
    try {
      await Drive.startOAuth(clientId);
      UI.notify('Google Drive connected!', 'success');
      await Config.load();
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
    const data = {
      exported: new Date().toISOString(),
      profile:    Storage.get('profile', {}),
      milestones: Storage.get('milestones', {}),
      jobs:       Storage.get('jobs', {}),
      usc:        Storage.get('usc', {}),
      resume:     Storage.get('resume', {}),
      sessions:   Storage.get('sessions', {}),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JobSearchCoach_export_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.notify('Data exported', 'success');
  }

  function resetAll() {
    if (!confirm('This will clear ALL your job search data from this browser. Are you sure?')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    ['profile','milestones','jobs','usc','resume','sessions'].forEach(k => Storage.remove(k));
    UI.notify('Data cleared. Reloading...', 'info');
    setTimeout(() => location.reload(), 1500);
  }

  function _esc(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, saveProfile, saveParentEmails, saveApiKey, connectDrive, disconnectDrive, exportData, resetAll };
})();
