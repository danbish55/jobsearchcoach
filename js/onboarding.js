/* Onboarding — multi-step first-run setup */
const Onboarding = (() => {
  let _step = 0;
  let _answers = {};

  const STEPS = [
    'welcome',
    'profile',
    'apikey',
    'drive',
    'complete',
  ];

  function start() {
    _step = 0;
    _answers = {};
    document.getElementById('onboarding-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    render();
  }

  function render() {
    const card = document.getElementById('onboarding-card');
    const stepName = STEPS[_step];
    card.innerHTML = _buildStep(stepName);
    _bindStep(stepName);
  }

  function _buildProgress() {
    return `<div class="onboarding-progress">
      ${STEPS.map((_, i) =>
        `<div class="progress-dot ${i < _step ? 'done' : ''} ${i === _step ? 'active' : ''}"></div>`
      ).join('')}
    </div>`;
  }

  function _buildStep(name) {
    switch (name) {
      case 'welcome':
        return `
          <div class="onboarding-step-label">Step 1 of 5</div>
          <div class="onboarding-title">Welcome to<br>JobSearchCoach 🎯</div>
          <div class="onboarding-desc">
            Your personal AI career coach, powered by Claude. We'll get you set up in about 3 minutes.<br><br>
            This app runs completely on your computer — your data stays with you.
          </div>
          <div class="onboarding-nav">
            <div></div>
            <button class="btn btn-gold" id="ob-next">Let's Go →</button>
          </div>
          ${_buildProgress()}`;

      case 'profile':
        const saved = Storage.get('profile', {});
        return `
          <div class="onboarding-step-label">Step 2 of 5 — Your Profile</div>
          <div class="onboarding-title">Tell me about yourself</div>
          <div class="onboarding-desc">Your coach uses this to give you relevant, personalized advice.</div>

          <div class="onboarding-field">
            <label>Your First Name</label>
            <input id="ob-name" type="text" placeholder="Corinne" value="${saved.name || ''}">
          </div>
          <div class="onboarding-field">
            <label>School</label>
            <input id="ob-school" type="text" placeholder="USC" value="${saved.school || 'USC'}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="onboarding-field">
              <label>Graduation Year</label>
              <input id="ob-grad" type="text" placeholder="2024" value="${saved.grad_year || ''}">
            </div>
            <div class="onboarding-field">
              <label>Major</label>
              <input id="ob-major" type="text" placeholder="e.g. Communications" value="${saved.major || ''}">
            </div>
          </div>
          <div class="onboarding-field">
            <label>Target Job Titles (comma-separated)</label>
            <input id="ob-roles" type="text" placeholder="e.g. Marketing Coordinator, Brand Manager"
              value="${(saved.target_roles || []).join(', ')}">
          </div>
          <div class="onboarding-field">
            <label>Target Industries (comma-separated)</label>
            <input id="ob-industries" type="text" placeholder="e.g. Tech, Entertainment, Media"
              value="${(saved.target_industries || []).join(', ')}">
          </div>
          <div class="onboarding-field">
            <label>Parent 1 Email (for Progress Reports)</label>
            <input id="ob-parent1-email" type="email" placeholder="dad@example.com"
              value="${saved.parent1_email || ''}">
          </div>
          <div class="onboarding-field">
            <label>Parent 2 Email (optional)</label>
            <input id="ob-parent2-email" type="email" placeholder="mom@example.com"
              value="${saved.parent2_email || ''}">
          </div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-gold" id="ob-next">Next →</button>
          </div>
          ${_buildProgress()}`;

      case 'apikey':
        return `
          <div class="onboarding-step-label">Step 3 of 5 — API Key</div>
          <div class="onboarding-title">Connect Claude AI</div>
          <div class="onboarding-desc">
            JobSearchCoach uses the Anthropic Claude API as your coaching engine. You'll need an API key.
          </div>

          <div class="security-note">
            Your API key is stored only on your computer in a local config file — never sent anywhere except directly to Anthropic. You will not be shown it again after saving.
          </div>

          <div class="onboarding-field">
            <label>Anthropic API Key</label>
            <input id="ob-apikey" type="password" placeholder="sk-ant-..." autocomplete="off"
              style="font-family:monospace;letter-spacing:0.05em">
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
              Get your key at
              <a href="https://console.anthropic.com/keys" target="_blank">console.anthropic.com/keys</a>
              — look for "API Keys" in the sidebar.
            </div>
          </div>

          <div id="apikey-status" style="font-size:13px;color:var(--text-muted);margin-bottom:8px"></div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-gold" id="ob-next">Save & Continue →</button>
          </div>
          ${_buildProgress()}`;

      case 'drive':
        return `
          <div class="onboarding-step-label">Step 4 of 5 — Cloud Backup (Optional)</div>
          <div class="onboarding-title">Sync with Google Drive</div>
          <div class="onboarding-desc">
            Optionally back up your coaching sessions and job data to your personal Google Drive.
            Your data is stored in a private app folder that only this app can see.
          </div>

          <div id="drive-status-area">
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="onboarding-field">
                <label>Google OAuth Client ID</label>
                <input id="ob-gclient-id" type="text" placeholder="123456789-xxx.apps.googleusercontent.com"
                  style="font-family:monospace;font-size:12px">
              </div>
              <div class="onboarding-field">
                <label>Google OAuth Client Secret</label>
                <input id="ob-gclient-secret" type="password" placeholder="GOCSPX-..."
                  style="font-family:monospace;font-size:12px">
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
                  Set up a Desktop OAuth client at
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank">
                    Google Cloud Console
                  </a>. Enable the Google Drive API first.
                </div>
              </div>
              <button class="btn btn-ghost" id="ob-drive-connect" style="width:fit-content">
                Connect Google Drive
              </button>
            </div>
          </div>

          <div id="drive-connect-status" style="font-size:13px;margin-top:8px"></div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-ghost" id="ob-skip">Skip for Now</button>
            <button class="btn btn-gold" id="ob-next">Continue →</button>
          </div>
          ${_buildProgress()}`;

      case 'complete':
        const profile = { ...Storage.get('profile', {}), ..._answers.profile };
        return `
          <div class="onboarding-step-label">All Set!</div>
          <div class="onboarding-title">Mission Briefing Ready 🕵️</div>
          <div class="onboarding-desc">
            Your coaching session is configured. Your first mission: get that resume bulletproof.
          </div>

          <div style="background:rgba(255,204,0,0.08);border:1px solid var(--gold-border);border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.1em;color:var(--gold);margin-bottom:12px">MISSION DOSSIER — BRIEFING</div>
            <p style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:8px">
              Welcome to the field, ${profile.name || 'Agent'}. Your cover identity needs work.
              We start with the resume — your most important asset.
            </p>
            <p style="font-size:13px;color:var(--text-muted)">
              Head to <strong style="color:var(--text)">Coach</strong> to begin, or review your
              <strong style="color:var(--text)">Resume</strong> tracker.
            </p>
          </div>

          <div class="onboarding-nav">
            <div></div>
            <button class="btn btn-gold" id="ob-launch">Launch JobSearchCoach →</button>
          </div>
          ${_buildProgress()}`;
    }
  }

  function _bindStep(name) {
    document.getElementById('ob-back')?.addEventListener('click', () => { _step--; render(); });

    switch (name) {
      case 'welcome':
        document.getElementById('ob-next').addEventListener('click', () => { _step++; render(); });
        break;

      case 'profile':
        document.getElementById('ob-next').addEventListener('click', () => {
          const name = document.getElementById('ob-name').value.trim();
          if (!name) { UI.notify('Please enter your name', 'error'); return; }
          _answers.profile = {
            name,
            school: document.getElementById('ob-school').value.trim() || 'USC',
            grad_year: document.getElementById('ob-grad').value.trim(),
            major: document.getElementById('ob-major').value.trim(),
            target_roles: document.getElementById('ob-roles').value
              .split(',').map(s => s.trim()).filter(Boolean),
            target_industries: document.getElementById('ob-industries').value
              .split(',').map(s => s.trim()).filter(Boolean),
            parent1_email: document.getElementById('ob-parent1-email').value.trim(),
            parent2_email: document.getElementById('ob-parent2-email').value.trim(),
          };
          Storage.set('profile', { ...Storage.get('profile', {}), ..._answers.profile });
          _step++;
          render();
        });
        break;

      case 'apikey':
        document.getElementById('ob-next').addEventListener('click', async () => {
          const key = document.getElementById('ob-apikey').value.trim();
          const statusEl = document.getElementById('apikey-status');

          if (!key || !key.startsWith('sk-')) {
            statusEl.textContent = 'Please enter a valid Anthropic API key (starts with sk-)';
            statusEl.style.color = 'var(--danger)';
            return;
          }

          statusEl.textContent = 'Saving...';
          statusEl.style.color = 'var(--text-muted)';
          try {
            await Config.save({ anthropic_api_key: key });
            statusEl.textContent = '✓ API key saved securely';
            statusEl.style.color = 'var(--success)';
            setTimeout(() => { _step++; render(); }, 600);
          } catch {
            statusEl.textContent = 'Error saving key. Is the server running?';
            statusEl.style.color = 'var(--danger)';
          }
        });
        break;

      case 'drive':
        document.getElementById('ob-skip').addEventListener('click', () => { _step++; render(); });
        document.getElementById('ob-next').addEventListener('click', () => { _step++; render(); });
        document.getElementById('ob-drive-connect')?.addEventListener('click', async () => {
          const clientId = document.getElementById('ob-gclient-id').value.trim();
          const clientSecret = document.getElementById('ob-gclient-secret').value.trim();
          const statusEl = document.getElementById('drive-connect-status');

          if (!clientId || !clientSecret) {
            statusEl.textContent = 'Please enter both Client ID and Client Secret.';
            statusEl.style.color = 'var(--danger)';
            return;
          }

          statusEl.textContent = 'Saving credentials...';
          await Config.save({ google_client_id: clientId, google_client_secret: clientSecret });
          statusEl.textContent = 'Opening Google authorization window...';
          statusEl.style.color = 'var(--text-muted)';

          try {
            await Drive.startOAuth(clientId);
            statusEl.textContent = '✓ Google Drive connected!';
            statusEl.style.color = 'var(--success)';
          } catch (err) {
            statusEl.textContent = `Auth failed: ${err.message}`;
            statusEl.style.color = 'var(--danger)';
          }
        });
        break;

      case 'complete':
        document.getElementById('ob-launch').addEventListener('click', async () => {
          await Config.save({ profile_complete: true });
          document.getElementById('onboarding-overlay').classList.add('hidden');
          App.launch();
        });
        break;
    }
  }

  return { start };
})();
