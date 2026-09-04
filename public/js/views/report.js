/* Progress Report — mailto generator */
const Report = (() => {
  const DEFAULT_CONTACTS = {
    name: 'Corinne',
    parent1_email: '',
    parent2_email: '',
  };

  const STATUSES = ['applied','phone','interview','offer','rejected'];
  const STATUS_LABELS = { applied:'Applied', phone:'Phone Screen', interview:'Interview', offer:'Offer', rejected:'Passed' };

  let _recipient = 'both';
  let _includes = null; // initialized on first render

  const INCLUDE_DEFS = [
    { key: 'applications', label: 'Applications summary' },
    { key: 'interviews',   label: 'Interview activity'   },
    { key: 'networking',   label: 'Alumni networking'    },
    { key: 'mission',      label: 'Playbook progress'    },
    { key: 'resume',       label: 'Resume update'        },
  ];

  function _autoDetect() {
    const jobs = Storage.get('jobs', { applications: [] });
    const usc  = Storage.get('usc', {});
    const resume = Storage.get('resume', {});

    const hasInterviews = jobs.applications.some(a => ['phone','interview','offer'].includes(a.status));
    const hasNetworking = (usc.alumni_dms || 0) + (usc.coffee_chats || 0) + (usc.events_attended || 0) > 0;
    const hasResumeData = Object.values(resume.sections || {}).some(v => v > 0);

    return {
      applications: jobs.applications.length > 0,
      interviews:   hasInterviews,
      networking:   hasNetworking,
      mission:      true,
      resume:       hasResumeData,
    };
  }

  function render() {
    const profile = Storage.get('profile', {});
    const container = document.getElementById('report-content');

    const parent1Name = profile.parent1_name || 'Dad';
    const parent2Name = profile.parent2_name || 'Mom';

    // Auto-detect on first load; preserve user choices on re-render
    if (!_includes) _includes = _autoDetect();

    const pills = [
      { value: 'parent1', name: parent1Name },
      { value: 'parent2', name: parent2Name },
      { value: 'both',    name: 'Both' },
    ];

    container.innerHTML = `
      <div class="report-form">
        <div class="card" style="margin-bottom:20px">
          <div class="report-header-row">

            <!-- Left: Send to -->
            <div class="report-send-col">
              <div class="send-to-label">Send to</div>
              <div class="pill-group" id="recipient-group">
                ${pills.map(p => `
                  <label class="pill ${_recipient === p.value ? 'selected' : ''}" data-value="${p.value}">
                    <input type="radio" name="recipient" value="${p.value}" ${_recipient === p.value ? 'checked' : ''}>
                    ${p.name}
                  </label>`).join('')}
              </div>
            </div>

            <!-- Right: Include toggles -->
            <div class="report-include-col">
              <div class="include-section-label">Include in report</div>
              <div class="include-grid" id="include-group">
                ${INCLUDE_DEFS.map(d => `
                  <div class="include-toggle ${_includes[d.key] ? 'on' : ''}" data-key="${d.key}">
                    <div class="toggle-box">${_includes[d.key] ? '✓' : ''}</div>
                    ${d.label}
                  </div>`).join('')}
              </div>
            </div>

          </div>
        </div>

        <div class="card" style="margin-bottom:20px">
          <div class="card-title">Report Preview</div>
          <pre class="report-preview" id="report-preview">${_buildReport()}</pre>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="Report.send()">📨 Open in Gmail</button>
          <button class="btn btn-ghost" onclick="Report.copyToClipboard()">📋 Copy to Clipboard</button>
        </div>

        <div style="font-size:12px;color:var(--text-muted);margin-top:10px">
          Opens Gmail with the report pre-filled. You can edit before sending.
        </div>
      </div>`;

    // Recipient pills
    document.querySelectorAll('#recipient-group .pill').forEach(pill => {
      pill.addEventListener('click', function() {
        _recipient = this.dataset.value;
        document.querySelectorAll('#recipient-group .pill').forEach(p => p.classList.remove('selected'));
        this.classList.add('selected');
        _refreshPreview();
      });
    });

    // Include toggles — plain divs, no checkbox, no double-fire
    document.querySelectorAll('#include-group .include-toggle').forEach(toggle => {
      toggle.addEventListener('click', function() {
        const key = this.dataset.key;
        _includes[key] = !_includes[key];
        this.classList.toggle('on', _includes[key]);
        this.querySelector('.toggle-box').textContent = _includes[key] ? '✓' : '';
        _refreshPreview();
      });
    });
  }

  function _refreshPreview() {
    const el = document.getElementById('report-preview');
    if (el) el.textContent = _buildReport();
  }

  function _buildReport() {
    const profile = Storage.get('profile', {});
    const jobs    = Storage.get('jobs', { applications: [] });
    const usc     = Storage.get('usc', {});
    const inc     = _includes || _autoDetect();

    const name  = profile.name || 'Corinne';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const apps  = jobs.applications;
    const byStatus = {};
    STATUSES.forEach(s => byStatus[s] = apps.filter(a => a.status === s).length);
    const interviewApps = apps.filter(a => ['phone','interview','offer'].includes(a.status));
    const offers = byStatus['offer'] || 0;

    const milestoneProgress = Milestones.getOverallProgress();
    const currentMission    = Milestones.getCurrentMission();
    const missionProgress   = Milestones.getMissionProgress(currentMission.id);

    const parts = [];

    parts.push(`JOB SEARCH UPDATE — ${today}`);
    parts.push('─'.repeat(42));
    parts.push(`Hi! Here's my latest job search update.\n`);

    if (inc.applications && apps.length > 0) {
      const recent = apps.slice(-3)
        .map(a => `  • ${a.company} — ${a.role} (${STATUS_LABELS[a.status]})`)
        .join('\n');
      parts.push(
        `📊 APPLICATIONS\n` +
        `  Total sent: ${apps.length}` +
        (offers ? `  |  Offers: ${offers}` : '') +
        `\n\n  Recent:\n${recent}`
      );
    }

    if (inc.interviews && interviewApps.length > 0) {
      const lines = interviewApps
        .map(a => `  • ${a.company} — ${a.role} [${STATUS_LABELS[a.status]}]${a.notes ? '  ('+a.notes+')' : ''}`)
        .join('\n');
      parts.push(`🎤 INTERVIEW ACTIVITY\n${lines}`);
    }

    if (inc.networking) {
      const dms    = usc.alumni_dms || 0;
      const chats  = usc.coffee_chats || 0;
      const events = usc.events_attended || 0;
      const ccv    = usc.career_center_visits || 0;
      parts.push(
        `🤝 NETWORKING\n` +
        `  Alumni DMs: ${dms}  |  Coffee chats: ${chats}  |  Events: ${events}  |  Career Center: ${ccv}`
      );
    }

    if (inc.mission) {
      parts.push(
        `🎯 PLAYBOOK PROGRESS  (${milestoneProgress.done}/${milestoneProgress.total} phases complete)\n` +
        `  Current phase: ${currentMission.codename} — ${currentMission.title}\n` +
        `  ${missionProgress.pct}% done  (${missionProgress.done}/${missionProgress.total} tasks)`
      );
    }

    if (inc.resume) {
      const resume = Storage.get('resume', {});
      const sections = resume.sections || {};
      const avg = Object.values(sections).length
        ? Math.round(Object.values(sections).reduce((a, b) => a + b, 0) / Object.values(sections).length)
        : 0;
      const coachReviewed = resume.coach_reviewed ? '  ✓ Coach reviewed' : '';
      parts.push(`📄 RESUME  (avg section completeness: ${avg}%)${coachReviewed}`);
    }

    parts.push('─'.repeat(42));
    parts.push('Sent via JobSearchCoach');

    return parts.join('\n\n');
  }

  function _getRecipientEmails() {
    const profile = Storage.get('profile', {});
    const parent1 = profile.parent1_email || DEFAULT_CONTACTS.parent1_email;
    const parent2 = profile.parent2_email || DEFAULT_CONTACTS.parent2_email;
    if (_recipient === 'parent1') return [parent1].filter(Boolean);
    if (_recipient === 'parent2') return [parent2].filter(Boolean);
    return [parent1, parent2].filter(Boolean);
  }

  function send() {
    _showIntroModal();
  }

  function _showIntroModal() {
    const modal = document.getElementById('modal-container');
    if (!modal) {
      _openReportBuilder();
      return;
    }

    modal.innerHTML = `
      <div class="modal-backdrop" style="animation:fadeIn 160ms ease-out">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <div class="modal-title" style="color:var(--gold)">A Note Before You Share</div>
          </div>
          <div style="max-width:480px;color:var(--text);line-height:1.65;font-size:17px">
            <p>Sharing your progress with your supporters is completely optional — always. There's no schedule, no expectation, and no one checking whether you did it.</p>
            <p>That said, there's a reason it's here. Having someone in your corner who knows how it's going — the real version, not just the highlight reel — has a way of keeping momentum alive when the process gets quiet. It's not about accountability in the surveillance sense. It's about having people who are genuinely rooting for you know when to cheer.</p>
            <p>Send when it feels right. Skip it when it doesn't. Either way, the work you're doing here is yours.</p>
          </div>
          <div style="display:flex;justify-content:center;margin-top:22px">
            <button class="btn btn-gold" onclick="Report.dismissIntroAndSend()">Got It</button>
          </div>
        </div>
      </div>`;
  }

  function dismissIntroAndSend() {
    const modal = document.getElementById('modal-container');
    if (modal) modal.innerHTML = '';
    _openReportBuilder();
  }

  function _openReportBuilder() {
    const emails = _getRecipientEmails();
    if (emails.length === 0) {
      UI.notify('No email address configured. Add parent emails in Settings.', 'error');
      return;
    }
    const profile = Storage.get('profile', {});
    const report  = _buildReport();
    const subject = encodeURIComponent(`${profile.name || 'Corinne'}'s Job Search Update — ${new Date().toLocaleDateString()}`);
    const body    = encodeURIComponent(report);
    const to      = encodeURIComponent(emails.join(','));
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank', 'noopener');
    UI.notify('Opening Gmail...', 'success');
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(_buildReport()).then(() => {
      UI.notify('Report copied to clipboard', 'success');
    }).catch(() => {
      UI.notify('Copy failed — select the preview text manually', 'error');
    });
  }

  return { render, send, dismissIntroAndSend, copyToClipboard };
})();
