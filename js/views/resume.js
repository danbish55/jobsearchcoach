/* Resume tracker view */
const Resume = (() => {

  const SECTIONS = [
    { id: 'contact',     label: 'Contact Info',       weight: 10 },
    { id: 'summary',     label: 'Summary / Objective', weight: 10 },
    { id: 'experience',  label: 'Work Experience',     weight: 35 },
    { id: 'education',   label: 'Education',           weight: 15 },
    { id: 'skills',      label: 'Skills',              weight: 15 },
    { id: 'projects',    label: 'Projects / Portfolio', weight: 10 },
    { id: 'extras',      label: 'Activities / Awards', weight:  5 },
  ];

  function _defaultData() {
    return {
      sections: SECTIONS.reduce((acc, s) => { acc[s.id] = 0; return acc; }, {}),
      notes: '',
      file_name: '',
      coach_reviewed: false,
      last_updated: null,
    };
  }

  function render() {
    const data = Storage.get('resume', _defaultData());
    const container = document.getElementById('resume-content');

    const score = _calcScore(data);

    container.innerHTML = `
      <div class="grid-2" style="margin-bottom:24px">
        <div class="card">
          <div class="card-title">Overall Score</div>
          <div class="resume-score-ring">
            <div>
              <div class="resume-score-value">${score}%</div>
              <div class="resume-score-label">${_scoreLabel(score)}</div>
            </div>
            <div style="flex:1">
              ${_scoreBar(score)}
            </div>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="coach-reviewed-cb" ${data.coach_reviewed ? 'checked' : ''}
                onchange="Resume.toggleCoachReviewed(this.checked)">
              Coach has reviewed this resume
            </label>
            <div style="font-size:12px;color:var(--text-muted)">
              ${data.last_updated ? 'Last updated: ' + new Date(data.last_updated).toLocaleDateString() : 'Not yet updated'}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Resume File</div>
          <div class="form-row">
            <label>File name / location</label>
            <input type="text" id="resume-filename" placeholder="e.g. Corinne_Smith_Resume_2024.pdf"
              value="${data.file_name || ''}" oninput="Resume.saveFileName(this.value)">
          </div>
          <div class="form-row">
            <label>Notes</label>
            <textarea id="resume-notes" rows="3" placeholder="Notes on current version, outstanding to-dos..."
              oninput="Resume.saveNotes(this.value)">${data.notes || ''}</textarea>
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-primary btn-sm" onclick="App.navigate('coach')">
              📋 Ask Coach to Review
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Section Completeness</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          Rate each section from 0–100%. Drag or type to update.
        </p>
        <div class="resume-sections" id="resume-sections">
          ${SECTIONS.map(s => _renderSection(s, data.sections[s.id] || 0)).join('')}
        </div>
      </div>`;
  }

  function _renderSection(section, value) {
    return `
      <div class="resume-section-row">
        <span class="resume-section-name">${section.label}
          <span style="font-size:11px;color:var(--text-muted)">(${section.weight}% weight)</span>
        </span>
        <div class="resume-section-bar">
          <div class="resume-section-fill" style="width:${value}%"></div>
        </div>
        <input type="number" min="0" max="100" value="${value}"
          style="width:56px;text-align:center;font-size:13px"
          onchange="Resume.updateSection('${section.id}', this.value)">
      </div>`;
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

  function updateSection(sectionId, value) {
    const data = Storage.get('resume', _defaultData());
    data.sections[sectionId] = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    data.last_updated = new Date().toISOString();
    Storage.set('resume', data);

    // Check DOSSIER task
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

  return { render, updateSection, toggleCoachReviewed, saveFileName, saveNotes };
})();
