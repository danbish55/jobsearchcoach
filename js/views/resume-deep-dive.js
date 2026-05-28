/* Resume Deep Dive Interview view */
const ResumeDeepDive = (() => {
  const SYSTEM_PROMPT = `"You are conducting a structured resume deep dive interview for Corinne, a USC Marshall MSBA graduate targeting data analytics roles in Los Angeles. You have her current resume in front of you. Your job is to ask specific probing questions about her actual resume content — not generic questions — to extract the real substance behind each bullet point. Then use her answers to suggest improved bullets.

Use this structure for every suggested rewrite:
[action verb] [what / scope] [tool or method] [outcome or decision]

Work through the resume in this exact order:
1. Work Experience (most important — spend the most time here)
2. Skills
3. Education
4. Projects / Portfolio
5. Summary / Objective

For Work Experience, probe for:
- Exact start and end dates and approximate hours per week for each role
- The specific datasets, tools, and methods she used — not just the tool name but what she actually did with it
- The actual business impact — numbers, decisions influenced, people who used her work
- Whether the work is still referenced or in use today
- Who she reported to and whether that person can serve as a reference

For each bullet point that is weak — meaning it has no outcome, no scale, or no specific tool — probe until you have enough information to write a strong replacement. Do not move to the next section until the current section has been fully explored.

When you have enough information to suggest a rewrite, output it in this exact format so the app can parse and display it in the rewrites panel:
SECTION: [section name]
ORIGINAL: [original bullet text]
SUGGESTED: [rewritten bullet text]

Rules for the conversation:
- Ask one question at a time. Never ask two questions in the same message.
- If her answer is vague, say so directly and ask again more specifically. Example: 'That's a start — can you give me a specific number or outcome? Even an estimate is better than nothing.'
- If she cannot answer a question about something on her resume, flag it explicitly as a resume risk: 'If a recruiter asks you this in an interview and you cannot answer it, that bullet is working against you. We should either strengthen it or remove it.'
- Be direct but warm. You are preparing her for a real recruiter conversation. Every word on her resume needs to be something she can defend in a room.
- Keep questions conversational, not clinical. This should feel like a smart colleague helping her prep, not a form she is filling out.
- After completing each major section, summarize what you found and what you are recommending before moving to the next section.

Begin by reading her resume carefully and opening with a specific observation about the strongest and weakest element you see, then ask your first question about Work Experience."`;

  function _defaults() {
    return {
      deep_dive_completed: false,
      deep_dive_date: null,
      deep_dive_conversation: [],
      resume_score_history: [],
      suggested_rewrites: [],
      accepted_rewrites: [],
      resume_text: '',
    };
  }

  function getData() {
    const data = Storage.get('deep_dive', {});
    return { ..._defaults(), ...(data || {}) };
  }

  function _save(data) {
    Storage.set('deep_dive', { ..._defaults(), ...(data || {}) });
  }

  function seedFromResume(resumeData = Resume.getCurrentData()) {
    const data = getData();
    const resumeText = resumeData.resume_text || Resume.getResumeText();
    if (resumeText) data.resume_text = resumeText;
    if (!data.resume_score_history.length && resumeData.coach_feedback) {
      data.resume_score_history = [{
        version: 1,
        score: Resume.calcScore(resumeData),
        date: resumeData.last_updated || new Date().toISOString(),
        section_scores: { ...(resumeData.sections || {}) },
      }];
    }
    _save(data);
  }

  function render() {
    const resumeData = Resume.getCurrentData();
    seedFromResume(resumeData);
    const data = getData();
    const container = document.getElementById('resume-deep-dive-content');
    const hasRatedResume = !!resumeData.coach_feedback && !!data.resume_text;

    if (!hasRatedResume) {
      container.innerHTML = `
        <div class="deep-dive-empty-state">
          <h2>You need to rate your resume before starting the Deep Dive Interview.</h2>
          <p>Go to the Resume page to upload and rate your resume first.</p>
          <button class="btn btn-primary" onclick="App.navigate('resume')">Go to Resume Page</button>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="deep-dive-page">
        <div class="deep-dive-topbar">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">Back to Dashboard</button>
          <div>
            <div class="view-title">Resume Deep Dive</div>
            <div class="view-subtitle">Turn resume claims into defensible, specific evidence.</div>
          </div>
        </div>

        <div class="deep-dive-layout">
          <aside class="deep-dive-resume-panel">
            ${_scrollControls('deep-dive-resume-text')}
            <div class="deep-dive-panel-title">Your Current Resume</div>
            <div class="deep-dive-section-list">
              ${_resumeSections(data.resume_text).map((section, i) => `
                <button class="deep-dive-section-link" onclick="ResumeDeepDive.scrollToSection(${i})">${_esc(section.title)}</button>
              `).join('')}
            </div>
            <div class="deep-dive-resume-text" id="deep-dive-resume-text">
              ${_renderResumeReference(data.resume_text)}
            </div>
          </aside>

          <section class="deep-dive-chat-panel">
            ${_scrollControls('deep-dive-chat-messages')}
            <div class="deep-dive-panel-title">Clarifying Discussion</div>
            <div class="deep-dive-chat-messages" id="deep-dive-chat-messages">
              ${_renderMessages(data.deep_dive_conversation)}
            </div>
            <div class="deep-dive-chat-input-row">
              <textarea id="deep-dive-input" rows="4" placeholder="Answer the coach..." onkeydown="ResumeDeepDive.handleKeyDown(event)"></textarea>
              <button class="btn btn-primary" id="deep-dive-send" onclick="ResumeDeepDive.send()">Send</button>
              <div class="deep-dive-input-hint">Press Enter to send · Shift+Enter for new line</div>
            </div>
          </section>

          <aside class="deep-dive-rewrites-panel">
            ${_scrollControls('deep-dive-rewrite-list')}
            <div class="deep-dive-panel-title">Suggested Rewrites</div>
            <div id="deep-dive-rewrite-list" class="deep-dive-rewrite-list">
              ${_renderRewrites(data.suggested_rewrites)}
            </div>
            <div class="deep-dive-build-footer">
              <button class="btn btn-gold" onclick="ResumeDeepDive.showBuildModal()">Build My Revised Resume</button>
            </div>
          </aside>
        </div>
      </div>`;

    _scrollChatToBottom();
    _updateScrollControlsSoon();
    if (!data.deep_dive_conversation.length) {
      _startInterview();
    }
  }

  async function _startInterview() {
    const data = getData();
    if (data.deep_dive_conversation.length) return;
    data.deep_dive_conversation.push({ role: 'assistant', content: 'Reading your resume and preparing the first question...' });
    _save(data);
    _rerenderMessages();
    try {
      const reply = await _callClaude([]);
      const fresh = getData();
      fresh.deep_dive_conversation = [{ role: 'assistant', content: reply }];
      _appendParsedRewrites(fresh, reply);
      _save(fresh);
    } catch (err) {
      const fresh = getData();
      fresh.deep_dive_conversation = [{
        role: 'assistant',
        content: `I could not start the interview yet: ${err.message || 'please try again.'}`,
      }];
      _save(fresh);
    }
    _rerenderAll();
  }

  function _scrollControls(targetId) {
    return `
      <div class="deep-dive-scroll-controls" data-scroll-target="${targetId}" aria-hidden="true">
        <button class="deep-dive-scroll-btn" onclick="ResumeDeepDive.scrollColumn('${targetId}', -200)" title="Scroll up">↑</button>
        <button class="deep-dive-scroll-btn" onclick="ResumeDeepDive.scrollColumn('${targetId}', 200)" title="Scroll down">↓</button>
      </div>`;
  }

  async function send() {
    const input = document.getElementById('deep-dive-input');
    const text = input?.value.trim();
    if (!text) return;

    const data = getData();
    data.deep_dive_conversation.push({ role: 'user', content: text });
    data.deep_dive_conversation.push({ role: 'assistant', content: 'Thinking...' });
    _save(data);
    input.value = '';
    _rerenderMessages();

    try {
      const conversationForApi = getData().deep_dive_conversation.slice(0, -1);
      const reply = await _callClaude(conversationForApi);
      const fresh = getData();
      fresh.deep_dive_conversation[fresh.deep_dive_conversation.length - 1] = { role: 'assistant', content: reply };
      _appendParsedRewrites(fresh, reply);
      _save(fresh);
    } catch (err) {
      const fresh = getData();
      fresh.deep_dive_conversation[fresh.deep_dive_conversation.length - 1] = {
        role: 'assistant',
        content: `I hit a snag sending that: ${err.message || 'please try again.'}`,
      };
      _save(fresh);
    }
    _rerenderAll();
  }

  async function _callClaude(messages) {
    const data = getData();
    const system = `${SYSTEM_PROMPT}

CURRENT RESUME TEXT:
${data.resume_text}`;

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Corinne' : 'Coach'}: ${m.content}`)
      .join('\n\n');
    const apiMessages = [{
      role: 'user',
      content: transcript
        ? `Continue the resume deep dive interview from this saved conversation. Respond only as the coach with the next answer or question.\n\n${transcript}`
        : 'Begin the resume deep dive interview now.',
    }];

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        stream: false,
        system,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || 'Claude request failed');
    }
    const payload = await response.json();
    return payload.content?.[0]?.text || '';
  }

  function parseSuggestedRewrites(text) {
    const pattern = /SECTION:\s*([\s\S]*?)\nORIGINAL:\s*([\s\S]*?)\nSUGGESTED:\s*([\s\S]*?)(?=\nSECTION:|$)/g;
    const rewrites = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      rewrites.push({
        id: `rewrite-${Date.now()}-${rewrites.length}-${Math.random().toString(16).slice(2)}`,
        section: match[1].trim(),
        original: match[2].trim(),
        suggested: match[3].trim(),
        accepted: false,
        created_at: new Date().toISOString(),
      });
    }
    return rewrites;
  }

  function _appendParsedRewrites(data, text) {
    const existing = new Set((data.suggested_rewrites || []).map(r => `${r.original}\n${r.suggested}`));
    const additions = parseSuggestedRewrites(text).filter(r => !existing.has(`${r.original}\n${r.suggested}`));
    if (additions.length) {
      data.suggested_rewrites = [...(data.suggested_rewrites || []), ...additions];
    }
  }

  function toggleRewriteAccepted(id, checked) {
    const data = getData();
    data.suggested_rewrites = data.suggested_rewrites.map(r => r.id === id ? { ...r, accepted: checked } : r);
    data.accepted_rewrites = data.suggested_rewrites.filter(r => r.accepted);
    _save(data);
  }

  async function copyRewrite(id) {
    const rewrite = getData().suggested_rewrites.find(r => r.id === id);
    if (!rewrite) return;
    await _copyText(rewrite.suggested);
    UI.notify('Rewrite copied', 'success');
  }

  function showBuildModal() {
    const data = getData();
    const accepted = (data.suggested_rewrites || []).filter(r => r.accepted);
    const revised = _buildRevisedResume(data.resume_text, accepted);
    UI.showModal('Build My Revised Resume', `
      <div class="deep-dive-modal-body">
        <textarea id="deep-dive-revised-text" rows="14" readonly>${_esc(revised)}</textarea>
        <button class="btn btn-primary btn-sm" onclick="ResumeDeepDive.copyRevisedResume()">Copy All</button>
        <p class="deep-dive-modal-note">Paste this into your Word document to update your resume.</p>
        <div class="deep-dive-rescore-box">
          <div class="settings-section-title">Ready to see your new score?</div>
          <p>Save your updated resume as a new file, then upload it here to get your new score.</p>
          <input type="file" id="deep-dive-rescore-file" accept=".docx,.pdf">
          <button class="btn btn-gold btn-sm" id="deep-dive-rescore-btn" onclick="ResumeDeepDive.rescore()">Rescore My Resume</button>
        </div>
      </div>
    `, [{ id: 'close', label: 'Close', class: 'btn-ghost' }]);
  }

  async function copyRevisedResume() {
    const text = document.getElementById('deep-dive-revised-text')?.value || '';
    await _copyText(text);
    UI.notify('Revised resume copied', 'success');
  }

  async function rescore() {
    const file = document.getElementById('deep-dive-rescore-file')?.files?.[0];
    if (!file) {
      UI.notify('Choose your updated resume file first.', 'error');
      return;
    }
    const btn = document.getElementById('deep-dive-rescore-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Rescoring...'; }

    try {
      const beforeResume = Resume.getCurrentData();
      const beforeScore = Resume.calcScore(beforeResume);
      const text = await Resume.readResumeFile(file);
      const result = await Resume.rateResumeText(text, beforeResume.notes || '');
      const updatedResume = Resume.applyRatingResult(result, text, file.name);
      const afterScore = Resume.calcScore(updatedResume);

      const data = getData();
      const history = Array.isArray(data.resume_score_history) ? [...data.resume_score_history] : [];
      if (!history.length) {
        history.push({
          version: 1,
          score: beforeScore,
          date: beforeResume.last_updated || new Date().toISOString(),
          section_scores: { ...(beforeResume.sections || {}) },
        });
      }
      history.push({
        version: history.length + 1,
        score: afterScore,
        date: new Date().toISOString(),
        section_scores: { ...(updatedResume.sections || {}) },
      });
      data.resume_text = text;
      data.resume_score_history = history;
      data.deep_dive_completed = true;
      data.deep_dive_date = history[history.length - 1].date;
      data.accepted_rewrites = (data.suggested_rewrites || []).filter(r => r.accepted);
      _save(data);

      UI.closeModal();
      App.navigate('resume');
      UI.notify('Rescore complete — check your updated score on the Resume page', 'success');
    } catch (err) {
      UI.notify(`Rescore failed: ${err.message || 'please try again.'}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Rescore My Resume'; }
    }
  }

  function _buildRevisedResume(resumeText, accepted) {
    let revised = resumeText || '';
    accepted.forEach(r => {
      if (r.original && revised.includes(r.original)) {
        revised = revised.split(r.original).join(r.suggested);
      } else {
        revised += `\n\n${r.section}\n${r.suggested}`;
      }
    });
    return revised;
  }

  function _resumeSections(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const known = /^(work experience|experience|skills|education|projects|portfolio|summary|objective|activities|awards)$/i;
    const sections = [];
    let current = { title: 'Resume', lines: [] };
    lines.forEach(line => {
      const isHeader = known.test(line) || (line.length < 40 && /^[A-Z][A-Z\s/&-]+$/.test(line));
      if (isHeader && current.lines.length) {
        sections.push(current);
        current = { title: line, lines: [] };
      } else if (isHeader) {
        current.title = line;
      } else {
        current.lines.push(line);
      }
    });
    sections.push(current);
    return sections.filter(s => s.title || s.lines.length);
  }

  function _renderResumeReference(text) {
    return _resumeSections(text).map((section, i) => `
      <div class="deep-dive-resume-section" id="deep-dive-resume-section-${i}">
        <button class="deep-dive-resume-heading" onclick="ResumeDeepDive.scrollToSection(${i})">${_esc(section.title)}</button>
        ${section.lines.map(line => `<div class="deep-dive-resume-line">${_esc(line)}</div>`).join('')}
      </div>
    `).join('');
  }

  function _renderMessages(messages) {
    return (messages || []).map(m => `
      <div class="deep-dive-message ${m.role === 'user' ? 'user' : 'assistant'}">
        <div class="deep-dive-message-bubble">${_formatMessage(m.content)}</div>
      </div>
    `).join('');
  }

  function _renderRewrites(rewrites) {
    if (!rewrites || !rewrites.length) {
      return `<div class="deep-dive-rewrite-empty">Your improved bullet points will appear here as we work through your resume.</div>`;
    }
    return rewrites.map(r => `
      <div class="deep-dive-rewrite-card">
        <div class="deep-dive-rewrite-section">${_esc(r.section)}</div>
        <div class="deep-dive-rewrite-label">Before:</div>
        <div class="deep-dive-rewrite-before">${_esc(r.original)}</div>
        <div class="deep-dive-rewrite-label">After:</div>
        <div class="deep-dive-rewrite-after">${_esc(r.suggested)}</div>
        <div class="deep-dive-rewrite-actions">
          <button class="btn btn-ghost btn-sm" onclick="ResumeDeepDive.copyRewrite('${r.id}')">Copy</button>
          <label><input type="checkbox" ${r.accepted ? 'checked' : ''} onchange="ResumeDeepDive.toggleRewriteAccepted('${r.id}', this.checked)"> Accept</label>
        </div>
      </div>
    `).join('');
  }

  function scrollToSection(index) {
    document.getElementById(`deep-dive-resume-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('deep-dive-chat-messages')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollColumn(targetId, amount) {
    document.getElementById(targetId)?.scrollBy({ top: amount, behavior: 'smooth' });
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function _rerenderMessages() {
    const area = document.getElementById('deep-dive-chat-messages');
    if (area) area.innerHTML = _renderMessages(getData().deep_dive_conversation);
    _scrollChatToBottom();
    _updateScrollControlsSoon();
  }

  function _rerenderAll() {
    const data = getData();
    _rerenderMessages();
    const list = document.getElementById('deep-dive-rewrite-list');
    if (list) list.innerHTML = _renderRewrites(data.suggested_rewrites);
    _scrollRewritesToBottom();
    _updateScrollControlsSoon();
  }

  function _scrollChatToBottom() {
    const area = document.getElementById('deep-dive-chat-messages');
    if (area) area.scrollTop = area.scrollHeight;
  }

  function _scrollRewritesToBottom() {
    const list = document.getElementById('deep-dive-rewrite-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  function _updateScrollControlsSoon() {
    requestAnimationFrame(_updateScrollControls);
  }

  function _updateScrollControls() {
    document.querySelectorAll('.deep-dive-scroll-controls').forEach(control => {
      const target = document.getElementById(control.dataset.scrollTarget);
      const scrollable = !!target && target.scrollHeight > target.clientHeight + 4;
      control.classList.toggle('visible', scrollable);
    });
  }

  async function _copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  function _formatMessage(text) {
    return _esc(text).replace(/\n/g, '<br>');
  }

  function _esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    render,
    getData,
    seedFromResume,
    send,
    handleKeyDown,
    scrollToSection,
    scrollColumn,
    parseSuggestedRewrites,
    toggleRewriteAccepted,
    copyRewrite,
    showBuildModal,
    copyRevisedResume,
    rescore,
  };
})();
