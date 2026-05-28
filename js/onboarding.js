/* Onboarding — multi-step first-run setup */
const Onboarding = (() => {
  let _step = 0;
  let _answers = {};
  const DEFAULT_CONTACTS = {
    name: 'Corinne',
    student_email: 'corinne@example.com',
    parent1_name: 'Dad',
    parent1_email: 'contact@example.com',
    parent2_name: 'Mom',
    parent2_email: 'supporter@example.com',
  };

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
            Your personal AI career coach. We'll get you set up in about a minute.<br><br>
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
          <div class="onboarding-step-label">Step 2 of 5 — Contact Info</div>
          <div class="onboarding-title">Confirm contact info</div>
          <div class="onboarding-desc">These are already filled in. Corinne can change them later in Settings if needed.</div>

          <div class="onboarding-field">
            <label>Your First Name</label>
            <input id="ob-name" type="text" placeholder="Corinne" value="${saved.name || DEFAULT_CONTACTS.name}">
          </div>
          <div class="onboarding-field">
            <label>Your Email</label>
            <input id="ob-student-email" type="email" placeholder="corinne@example.com"
              value="${saved.student_email || DEFAULT_CONTACTS.student_email}">
          </div>
          <div class="onboarding-field">
            <label>Dad's Email</label>
            <input id="ob-parent1-email" type="email" placeholder="dad@example.com"
              value="${saved.parent1_email || DEFAULT_CONTACTS.parent1_email}">
          </div>
          <div class="onboarding-field">
            <label>Mom's Email</label>
            <input id="ob-parent2-email" type="email" placeholder="mom@example.com"
              value="${saved.parent2_email || DEFAULT_CONTACTS.parent2_email}">
          </div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-gold" id="ob-next">Next →</button>
          </div>
          ${_buildProgress()}`;

      case 'apikey':
        return `
          <div class="onboarding-step-label">Step 3 of 5 — Access Key</div>
          <div class="onboarding-title">Enter your coach access key</div>
          <div class="onboarding-desc">
            Dad will give you this key. Paste it here to turn on the AI coach.
          </div>

          <div class="security-note">
            This key is stored only on this computer in a local config file. It is used only to connect JobSearchCoach to the coaching AI.
          </div>

          <div class="onboarding-field">
            <label>Access Key</label>
            <input id="ob-apikey" type="password" placeholder="Paste the key Dad gave you" autocomplete="off"
              style="font-family:monospace;letter-spacing:0.05em">
          </div>

          <div id="apikey-status" style="font-size:13px;color:var(--text-muted);margin-bottom:8px"></div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-gold" id="ob-next">Save & Continue →</button>
          </div>
          ${_buildProgress()}`;

      case 'drive':
        const status = Config.get() || {};
        return `
          <div class="onboarding-step-label">Step 4 of 5 — Google Drive</div>
          <div class="onboarding-title">Connect Google Drive</div>
          <div class="onboarding-desc">
            JobSearchCoach saves your job applications, coaching sessions, mission progress, resume notes, and gauges to your private Google Drive app data.
          </div>

          <div class="security-note">
            Sign in with Corinne's Gmail account. Google will ask for permission to store app data in Drive.
          </div>

          <div id="drive-connect-status" style="font-size:13px;margin-bottom:10px;color:var(--text-muted)">
            ${status.google_client_id ? 'Ready to connect.' : 'Google Drive setup is missing. Ask Dad for the prepared package.'}
          </div>

          <div class="onboarding-nav">
            <button class="btn btn-ghost" id="ob-back">← Back</button>
            <button class="btn btn-gold" id="ob-drive-connect" ${status.google_client_id ? '' : 'disabled'}>Connect Google Drive</button>
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
          const studentEmail = document.getElementById('ob-student-email').value.trim();
          const parent1Email = document.getElementById('ob-parent1-email').value.trim();
          const parent2Email = document.getElementById('ob-parent2-email').value.trim();
          if (!studentEmail) { UI.notify('Please enter Corinne\'s email', 'error'); return; }
          if (!parent1Email) { UI.notify('Please enter Dad\'s email', 'error'); return; }
          if (!parent2Email) { UI.notify('Please enter Mom\'s email', 'error'); return; }
          _answers.profile = {
            name,
            student_email: studentEmail,
            school: Storage.get('profile', {}).school || 'USC',
            parent1_name: DEFAULT_CONTACTS.parent1_name,
            parent1_email: parent1Email,
            parent2_name: DEFAULT_CONTACTS.parent2_name,
            parent2_email: parent2Email,
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
            statusEl.textContent = 'Please enter the access key Dad gave you. It should start with sk-.';
            statusEl.style.color = 'var(--danger)';
            return;
          }

          statusEl.textContent = 'Saving...';
          statusEl.style.color = 'var(--text-muted)';
          try {
            await Config.save({ anthropic_api_key: key });
            statusEl.textContent = '✓ Access key saved';
            statusEl.style.color = 'var(--success)';
            setTimeout(() => { _step++; render(); }, 600);
          } catch {
            statusEl.textContent = 'Error saving key. Is the server running?';
            statusEl.style.color = 'var(--danger)';
          }
        });
        break;

      case 'drive':
        document.getElementById('ob-drive-connect')?.addEventListener('click', async () => {
          const statusEl = document.getElementById('drive-connect-status');
          const clientId = Config.get()?.google_client_id || '';
          if (!clientId) {
            statusEl.textContent = 'Google Drive setup is missing. Ask Dad for the prepared package.';
            statusEl.style.color = 'var(--danger)';
            return;
          }
          statusEl.textContent = 'Opening Google sign-in...';
          statusEl.style.color = 'var(--text-muted)';
          try {
            await Drive.startOAuth(clientId);
            await Config.load();
            await Drive.init();
            await Storage.syncAllToDrive();
            statusEl.textContent = '✓ Google Drive connected';
            statusEl.style.color = 'var(--success)';
            setTimeout(() => { _step++; render(); }, 700);
          } catch (err) {
            statusEl.textContent = `Drive connection failed: ${err.message}`;
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
