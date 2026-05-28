/* Resume tracker view */
const Resume = (() => {

  const QUOTES = [
    "Your next breakthrough is just around the corner.",
    "Believe in yourself. Your hard work will pay off.",
    "Keep your head up. Great things take time.",
    "You are capable of amazing things. Stay focused!",
    "Your skills are valuable. Someone will see that soon.",
    "Don't stop now. Your dream job is waiting.",
    "Every effort matters. You are closer than yesterday.",
    "Stay positive. The right door will open next.",
    "Your resilience is your superpower. Keep moving forward!",
    "Trust the process. You are doing just fine.",
    "New days bring new opportunities. Keep searching!",
    "You are worthy of a great career. Move forward.",
    "Focus on your goals. Success is coming.",
    "Celebrate small wins. You are making real progress.",
    "You have what it takes. Never give up.",
    "Keep casting your net. Your big catch is coming.",
    "Your talent is undeniable. Stay patient and persistent.",
    "Every application is a step toward your future.",
    "You are built for this. Keep grinding out there.",
    "The perfect fit is searching for you too.",
    "Today is a fresh start. Keep your chin up.",
    "Your determination will turn into a great offer.",
    "Stay confident. You bring so much to the table.",
    "Progress over perfection. Just keep moving today.",
    "This tough phase will pass. Your success is next.",
    "Fight on to victory. Your next offer is waiting.",
    "Always compete, dare to be great, and let it rip.",
    "All you need is for just one person to say yes.",
    "Bear Down: Fight, and persevere in every challenge.",
    "Step outside your comfort zone and take that chance.",
    "Believe in your ability to succeed. You can win.",
  ];

  const SECTIONS = [
    { id: 'contact',     label: 'Contact Info',        weight: 10 },
    { id: 'summary',     label: 'Summary / Objective',  weight: 10 },
    { id: 'experience',  label: 'Work Experience',      weight: 35 },
    { id: 'education',   label: 'Education',            weight: 15 },
    { id: 'skills',      label: 'Skills',               weight: 15 },
    { id: 'projects',    label: 'Projects / Portfolio', weight: 10 },
    { id: 'extras',      label: 'Activities / Awards',  weight:  5 },
  ];

  const RATE_PROMPT = `You are an expert career coach evaluating a resume for a recent college graduate.

Analyze the resume and score each section 0–100 based on completeness, quality, and professional standards for entry-level job seekers. Be honest and rigorous — inflated scores do not help the candidate improve.

Scoring guide:
0–20: Missing or completely unusable
21–40: Exists but needs major work
41–60: Acceptable, clear room to improve
61–80: Good quality, minor improvements possible
81–100: Strong, professional level

Sections to score (use these exact JSON keys):
- contact: Name, email, phone, LinkedIn URL, location
- summary: Summary or objective statement
- experience: Work/internship history — job titles, bullet points, quantified results, relevance
- education: Degree, institution, graduation date, GPA if notable
- skills: Technical and soft skills, relevance to target roles
- projects: Side projects, portfolio, GitHub, relevant work samples
- extras: Activities, awards, volunteer work, certifications

For each section's feedback, write 1–3 honest, specific sentences the candidate can act on.

Return ONLY valid JSON — no preamble, no explanation, no markdown fences:
{"scores":{"contact":0,"summary":0,"experience":0,"education":0,"skills":0,"projects":0,"extras":0},"feedback":{"contact":"","summary":"","experience":"","education":"","skills":"","projects":"","extras":""},"overall_notes":""}`;

  let _resumeText = '';

  function _defaultData() {
    return {
      sections: SECTIONS.reduce((acc, s) => { acc[s.id] = 0; return acc; }, {}),
      notes: '',
      file_name: '',
      resume_text: '',
      coach_reviewed: false,
      coach_feedback: null,
      coach_notes: null,
      last_updated: null,
    };
  }

  function _dailyQuote() {
    const idx = Math.floor(Date.now() / 86400000) % QUOTES.length;
    return QUOTES[idx];
  }

  function _quoteFontSize(quote) {
    const len = quote.length;
    if (len < 50) return 27;
    if (len < 70) return 23;
    if (len < 90) return 20;
    return 18;
  }

  function render() {
    const data = Storage.get('resume', _defaultData());
    const container = document.getElementById('resume-content');

    const score = _calcScore(data);
    const hasCoachRating = !!data.coach_feedback;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:16px;margin-bottom:24px">
        ${_scoreComparisonPanel(score)}

        <div class="card">
          <div class="card-title" style="margin-bottom:6px">Overall Score</div>
          <div class="resume-score-value">${score}%</div>
          <div class="resume-score-label">${_scoreLabel(score)}</div>
          <div style="margin:8px 0">${_scoreBar(score)}</div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
            <input type="checkbox" id="coach-reviewed-cb" ${data.coach_reviewed ? 'checked' : ''}
              onchange="Resume.toggleCoachReviewed(this.checked)">
            Coach has reviewed this resume
          </label>
        </div>

        <div class="card">
          <div class="card-title">Resume File</div>
          <div class="form-row">
            <label>File Name / Location</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="resume-filename" placeholder="Select your resume file..."
                value="${data.file_name || ''}" readonly
                style="flex:1;cursor:default;color:var(--text-muted)">
              <button class="btn btn-ghost btn-sm" onclick="Resume.selectFile()"
                style="white-space:nowrap;flex-shrink:0">Browse</button>
            </div>
            <input type="file" id="resume-file-input" accept=".docx,.pdf" style="display:none"
              onchange="Resume.onFileSelected(this)">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              Supports .docx and .pdf — requires internet connection to parse
            </div>
          </div>
          <div class="form-row">
            <label>Any Notes for Coach?</label>
            <textarea id="resume-notes" rows="3" placeholder="Optional context for the Coach..."
              oninput="Resume.saveNotes(this.value)">${data.notes || ''}</textarea>
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-primary btn-sm" id="rate-resume-btn" onclick="Resume.rateWithCoach()">
              🎓 Rate My Resume
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Resume Completeness</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:${data.coach_notes ? '8px' : '16px'}">
          ${hasCoachRating
            ? 'See below what Coach has to say about your resume.'
            : 'Select your resume file and click <strong>Rate My Resume</strong> to get a Coach assessment.'
          }
        </p>
        ${data.coach_notes ? `<div class="coach-overall-note">${data.coach_notes}</div>` : ''}
        <div class="resume-sections" id="resume-sections">
          ${SECTIONS.map(s => _renderSection(s, data.sections[s.id] || 0, data.coach_feedback?.[s.id])).join('')}
        </div>
        ${_renderDeepDiveTrigger(hasCoachRating)}
      </div>`;
  }

  function _scoreComparisonPanel(score) {
    const deepDive = typeof ResumeDeepDive !== 'undefined' ? ResumeDeepDive.getData() : {};
    const history = Array.isArray(deepDive.resume_score_history) ? deepDive.resume_score_history : [];
    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const hasRescore = !!(deepDive.deep_dive_completed && latest && previous);

    if (!hasRescore) {
      return `
        <div class="resume-score-comparison-card">
          <div class="card-title">Score Snapshot</div>
          <div class="resume-score-comparison-current">${score}%</div>
          <div class="resume-score-comparison-label">${_scoreLabel(score)}</div>
          <div class="resume-score-comparison-message">
            Complete a Deep Dive Interview to improve your score.
          </div>
        </div>`;
    }

    const delta = latest.score - previous.score;
    const improved = delta >= 0;
    return `
      <div class="resume-score-comparison-card">
        <div class="card-title">Score Comparison</div>
        <div class="resume-score-previous">Previous Score: ${previous.score}%</div>
        <div class="resume-score-new ${improved ? 'improved' : 'lower'}">→ New Score: ${latest.score}%</div>
        <div class="resume-score-delta ${improved ? 'improved' : 'lower'}">${delta >= 0 ? '+' : ''}${delta} points</div>
        <div class="resume-score-date">${_formatDate(latest.date)}</div>
      </div>`;
  }

  function _renderDeepDiveTrigger(hasCoachRating) {
    return `
      <div class="resume-deep-dive-trigger">
        <button class="btn btn-gold" onclick="Resume.startDeepDive()" ${hasCoachRating ? '' : 'style="display:none"'}>
          Start Deep Dive Interview — Improve Your Score
        </button>
        <div id="resume-deep-dive-inline-message" class="resume-deep-dive-inline-message ${hasCoachRating ? 'hidden' : ''}">
          Rate your resume first — click 'Rate My Resume' above to get your initial score.
        </div>
      </div>`;
  }

  function _renderSection(section, value, feedback) {
    const isLong = feedback && feedback.length > 130;
    const commentHtml = feedback
      ? `<span class="comment-text" id="comment-text-${section.id}">${feedback}</span>${isLong ? `<button class="comment-toggle" onclick="Resume.toggleComment('${section.id}')">more ▾</button>` : ''}`
      : `<span style="font-style:italic;color:var(--text-muted);opacity:0.5">No Coach feedback yet</span>`;

    return `
      <div class="resume-section-row">
        <input type="number" min="0" max="100" value="${value}" class="resume-section-score-input"
          onchange="Resume.updateSection('${section.id}', this.value)">
        <div class="resume-section-left">
          <span class="resume-section-name">${section.label}
            <span class="resume-section-weight">(${section.weight}%)</span>
          </span>
          <div class="resume-section-bar">
            <div class="resume-section-fill" style="width:${value}%"></div>
          </div>
        </div>
        <div class="resume-section-comment" id="comment-col-${section.id}">
          ${commentHtml}
        </div>
      </div>`;
  }

  function toggleComment(sectionId) {
    const col = document.getElementById(`comment-col-${sectionId}`);
    const btn = col?.querySelector('.comment-toggle');
    if (!col) return;
    const expanded = col.classList.toggle('expanded');
    if (btn) btn.textContent = expanded ? 'less ▴' : 'more ▾';
  }

  function selectFile() {
    document.getElementById('resume-file-input')?.click();
  }

  async function onFileSelected(input) {
    const file = input.files?.[0];
    if (!file) return;

    const filenameEl = document.getElementById('resume-filename');
    if (filenameEl) filenameEl.value = file.name;

    const data = Storage.get('resume', _defaultData());
    data.file_name = file.name;
    data.resume_text = '';
    Storage.set('resume', data);

    const btn = document.getElementById('rate-resume-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Reading file…'; }

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        _resumeText = await _readDocx(file);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        _resumeText = await _readPdf(file);
      } else {
        UI.notify('Please select a .docx or .pdf file.', 'error');
        return;
      }
      const fresh = Storage.get('resume', _defaultData());
      fresh.file_name = file.name;
      fresh.resume_text = _resumeText;
      fresh.last_updated = new Date().toISOString();
      Storage.set('resume', fresh);
      UI.notify('Resume loaded. Click "Rate My Resume" to get Coach feedback.', 'success');
    } catch (e) {
      UI.notify(`Could not read file: ${e.message || 'make sure it is a valid .docx or .pdf.'}`, 'error');
      _resumeText = '';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🎓 Rate My Resume'; }
    }
  }

  async function _readDocx(file) {
    try {
      return await _readDocxViaServer(file);
    } catch {}

    if (typeof mammoth !== 'undefined') {
      try {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawValue({ arrayBuffer: buffer });
        if (result.value?.trim()) return result.value;
      } catch {}
    }
    return _readDocxViaServer(file);
  }

  async function _readResumeFile(file) {
    if (file.name.toLowerCase().endsWith('.docx')) return _readDocx(file);
    if (file.name.toLowerCase().endsWith('.pdf')) return _readPdf(file);
    throw new Error('Unsupported resume file type');
  }

  async function _readDocxViaServer(file) {
    const data = await _fileToBase64(file);
    const response = await fetch('/api/extract-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, data }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.text) {
      throw new Error(payload.error || 'Could not extract .docx text');
    }
    return payload.text;
  }

  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function _readPdf(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js not loaded');
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n');
  }

  async function rateWithCoach() {
    const data = Storage.get('resume', _defaultData());
    let resumeText = _resumeText || data.resume_text || '';

    if (!resumeText) {
      const selectedFile = document.getElementById('resume-file-input')?.files?.[0];
      if (selectedFile) {
        const btn = document.getElementById('rate-resume-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Reading file…'; }
        try {
          resumeText = await _readResumeFile(selectedFile);
          _resumeText = resumeText;
          const fresh = Storage.get('resume', _defaultData());
          fresh.file_name = selectedFile.name;
          fresh.resume_text = resumeText;
          fresh.last_updated = new Date().toISOString();
          Storage.set('resume', fresh);
        } catch (e) {
          UI.notify(`Could not read that resume file: ${e.message || 'please select a .docx or .pdf file and try again.'}`, 'error');
          if (btn) { btn.disabled = false; btn.textContent = '🎓 Rate My Resume'; }
          return;
        }
      }
    }

    if (!resumeText) {
      UI.notify('Select your resume file first, then wait for the "Resume loaded" message.', 'error');
      return;
    }

    if (data.coach_feedback) {
      const ok = window.confirm('This will update your previous Coach rating with a fresh assessment based on your current resume. Continue?');
      if (!ok) return;
    }

    const btn = document.getElementById('rate-resume-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Rating…'; }

    try {
      const result = await rateResumeText(resumeText, data.notes);

      const fresh = Storage.get('resume', _defaultData());
      fresh.sections = { ..._defaultData().sections, ...(fresh.sections || {}) };
      SECTIONS.forEach(s => {
        const v = result.scores?.[s.id];
        if (typeof v === 'number') fresh.sections[s.id] = Math.max(0, Math.min(100, Math.round(v)));
      });
      fresh.coach_reviewed = true;
      fresh.coach_feedback = result.feedback || null;
      fresh.coach_notes = result.overall_notes || null;
      fresh.last_updated = new Date().toISOString();
      Storage.set('resume', fresh);
      _ensureInitialScoreHistory(fresh);

      render();
      UI.updateSidebar();
      UI.notify('Resume rated by Coach!', 'success');

      const score = _calcScore(fresh);
      if (score > 30 && !Milestones.getMissionState('dossier').tasks['resume_draft']) {
        Milestones.toggleTask('dossier', 'resume_draft');
      }
      const mResult = Milestones.toggleTask('dossier', 'coach_reviewed');
      if (mResult.justCompleted) UI.showMissionComplete(mResult.mission);

    } catch (e) {
      UI.notify('Rating failed — please try again.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🎓 Rate My Resume'; }
    }
  }

  function _calcScore(data) {
    let weighted = 0;
    let totalWeight = 0;
    for (const s of SECTIONS) {
      weighted += (data.sections[s.id] || 0) * s.weight;
      totalWeight += s.weight;
    }
    return Math.round(weighted / totalWeight);
  }

  async function rateResumeText(resumeText, notes = '') {
    const noteText = notes ? `\n\nNotes from candidate: ${notes}` : '';
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1400,
        stream: false,
        system: RATE_PROMPT,
        messages: [{ role: 'user', content: `Rate this resume:${noteText}\n\n${resumeText}` }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || 'Resume rating failed');
    }

    const payload = await res.json();
    const raw = payload.content?.[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  }

  function applyRatingResult(result, resumeText, fileName = '') {
    const fresh = Storage.get('resume', _defaultData());
    fresh.sections = { ..._defaultData().sections, ...(fresh.sections || {}) };
    SECTIONS.forEach(s => {
      const v = result.scores?.[s.id];
      if (typeof v === 'number') fresh.sections[s.id] = Math.max(0, Math.min(100, Math.round(v)));
    });
    if (resumeText) fresh.resume_text = resumeText;
    if (fileName) fresh.file_name = fileName;
    fresh.coach_reviewed = true;
    fresh.coach_feedback = result.feedback || null;
    fresh.coach_notes = result.overall_notes || null;
    fresh.last_updated = new Date().toISOString();
    Storage.set('resume', fresh);
    return fresh;
  }

  function _ensureInitialScoreHistory(data) {
    if (typeof ResumeDeepDive === 'undefined') return;
    const deepDive = ResumeDeepDive.getData();
    const history = Array.isArray(deepDive.resume_score_history) ? deepDive.resume_score_history : [];
    if (history.length > 0) return;
    deepDive.resume_score_history = [{
      version: 1,
      score: _calcScore(data),
      date: new Date().toISOString(),
      section_scores: { ...(data.sections || {}) },
    }];
    Storage.set('deep_dive', deepDive);
  }

  function _scoreLabel(score) {
    if (score < 30) return 'Needs Work';
    if (score < 60) return 'In Progress';
    if (score < 80) return 'Getting There';
    if (score < 95) return 'Almost Ready';
    return 'Field-Ready 🎯';
  }

  function _scoreBar(score) {
    const color = score < 50 ? 'var(--danger)' : score < 80 ? 'var(--gold)' : 'var(--success)';
    return `<div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${score}%;background:${color};border-radius:4px;transition:width 0.5s ease"></div>
    </div>`;
  }

  function _formatDate(value) {
    if (!value) return '';
    try {
      return `Rescored ${new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return '';
    }
  }

  function updateSection(sectionId, value) {
    const data = Storage.get('resume', _defaultData());
    data.sections[sectionId] = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    data.last_updated = new Date().toISOString();
    Storage.set('resume', data);

    const score = _calcScore(data);
    if (!Milestones.getMissionState('dossier').tasks['resume_draft'] && score > 30) {
      Milestones.toggleTask('dossier', 'resume_draft');
    }
    if (!Milestones.getMissionState('dossier').tasks['proofread'] && score >= 90) {
      const result = Milestones.toggleTask('dossier', 'proofread');
      if (result.justCompleted) UI.showMissionComplete(result.mission);
    }

    render();
    UI.updateSidebar();
  }

  function toggleCoachReviewed(checked) {
    const data = Storage.get('resume', _defaultData());
    data.coach_reviewed = checked;
    Storage.set('resume', data);
    if (checked) {
      const result = Milestones.toggleTask('dossier', 'coach_reviewed');
      if (result.justCompleted) UI.showMissionComplete(result.mission);
    }
    UI.updateSidebar();
  }

  function saveFileName(name) {
    const data = Storage.get('resume', _defaultData());
    data.file_name = name;
    data.last_updated = new Date().toISOString();
    Storage.set('resume', data);
  }

  function saveNotes(notes) {
    const data = Storage.get('resume', _defaultData());
    data.notes = notes;
    Storage.set('resume', data);
  }

  function startDeepDive() {
    const data = Storage.get('resume', _defaultData());
    if (!data.coach_feedback || !_calcScore(data)) {
      const msg = document.getElementById('resume-deep-dive-inline-message');
      if (msg) msg.classList.remove('hidden');
      UI.notify("Rate your resume first — click 'Rate My Resume' above to get your initial score.", 'info');
      return;
    }
    if (typeof ResumeDeepDive !== 'undefined') ResumeDeepDive.seedFromResume(data);
    App.navigate('resume-deep-dive');
  }

  function getCurrentData() {
    return Storage.get('resume', _defaultData());
  }

  function getResumeText() {
    const data = Storage.get('resume', _defaultData());
    return _resumeText || data.resume_text || '';
  }

  function calcScore(data = Storage.get('resume', _defaultData())) {
    return _calcScore(data);
  }

  function getSections() {
    return SECTIONS.map(s => ({ ...s }));
  }

  return {
    render,
    updateSection,
    toggleCoachReviewed,
    saveFileName,
    saveNotes,
    selectFile,
    onFileSelected,
    rateWithCoach,
    toggleComment,
    startDeepDive,
    getCurrentData,
    getResumeText,
    getSections,
    calcScore,
    rateResumeText,
    applyRatingResult,
    readResumeFile: _readResumeFile,
  };
})();
