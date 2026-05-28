/* Mission Discussion view */
const MissionDiscussion = (() => {
  let _missionId = 'dossier';
  let _messages = [];
  let _loading = false;

  const RESOURCE_LINKS = {
    dossier: [
      ['Harvard resume guide', 'https://careerservices.fas.harvard.edu/resources/bullet-point-resume-template/'],
      ['USC Career Center resumes', 'https://careers.usc.edu/resources/resumes/'],
    ],
    network: [
      ['USC Career Center networking', 'https://careers.usc.edu/resources/networking/'],
      ['LinkedIn alumni search', 'https://www.linkedin.com/school/usc/people/'],
    ],
    deploy: [
      ['Indeed application tracking tips', 'https://www.indeed.com/career-advice/finding-a-job/job-application-tracker'],
      ['The Muse job search guide', 'https://www.themuse.com/advice/job-search'],
    ],
    interview: [
      ['Big Interview answer guide', 'https://resources.biginterview.com/interviews-101/'],
      ['Google interview warmup', 'https://grow.google/certificates/interview-warmup/'],
    ],
    negotiate: [
      ['Harvard salary negotiation', 'https://careerservices.fas.harvard.edu/blog/2023/06/07/salary-negotiation/'],
      ['Levels.fyi compensation data', 'https://www.levels.fyi/'],
    ],
    extraction: [
      ['The Muse first week advice', 'https://www.themuse.com/advice/your-guide-to-your-first-week-on-the-job'],
      ['LinkedIn learning workplace tips', 'https://www.linkedin.com/learning/'],
    ],
  };

  const FALLBACK_STARTERS = {
    dossier: [
      'Your resume is not just a document. It is the story a busy recruiter tells themselves about you in about twelve seconds. What parts of your current resume feel strong, and what parts make you hesitate?',
      'Before we polish bullets, I want to understand your confidence level. When you imagine sending your resume to a role you really want, what worry comes up first?',
    ],
    network: [
      'Networking can feel weird because it asks you to start conversations before there is an obvious reason. What does networking feel like to you right now: awkward, useful, fake, exciting, intimidating, or something else?',
      'Let us make networking more human. Who is one person you would actually be curious to learn from, even if there were no job attached?',
    ],
    deploy: [
      'Applications are partly a numbers game, but not a random one. What usually slows you down most: finding roles, deciding if you are qualified, tailoring materials, or hitting submit?',
      'When you see a job posting, what makes you think “I should apply,” and what makes you talk yourself out of it?',
    ],
    interview: [
      'Interview prep is really story prep. What is one question you hope they ask because you know you can answer it well, and one question you dread?',
      'Before we practice answers, tell me how interviews feel in your body: energized, nervous, blank, overprepared, underprepared, or something else?',
    ],
    negotiate: [
      'Negotiation is not being difficult. It is calmly discussing terms like a professional. What feels hardest about asking for more: fear they will withdraw, not knowing your number, or feeling like you have not earned it?',
      'If an offer came tomorrow, what would you need to know before saying yes?',
    ],
    extraction: [
      'Starting a role is its own mission. What would make your first month feel successful: clarity, confidence, relationships, quick wins, or simply not feeling lost?',
      'Once you land, the goal changes from proving you deserve the job to learning how to thrive in it. What kind of teammate do you want people to experience you as?',
    ],
  };

  function open(missionId) {
    _missionId = missionId;
    _messages = _cleanMessages(Storage.get(`mission_discussion_${missionId}`, []));
    _save();
    App.navigate('mission-discussion');
    UI.updateSidebar();
  }

  function render() {
    const mission = _getMission();
    const root = document.getElementById('mission-discussion-root');
    if (!root || !mission) return;

    root.innerHTML = `
      <div class="mission-discussion-shell">
        <div class="mission-discussion-header">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">← Dashboard</button>
          <div>
            <div class="mission-discussion-code">${mission.codename}</div>
            <div class="mission-discussion-title">${mission.title}</div>
            <div class="mission-discussion-brief">${mission.briefing}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="MissionDiscussion.restart()">New Prompt</button>
        </div>

        <div class="mission-discussion-body">
          <div class="mission-resource-panel">
            <div class="card-title">Resources</div>
            ${_resourceHTML(mission.id)}
          </div>

          <div class="mission-chat-panel">
            <div class="messages-area mission-messages" id="mission-messages"></div>
            <div class="coach-input-area">
              <div class="input-row">
                <textarea id="mission-input" rows="1"
                  placeholder="Reply to your coach..."
                  onkeydown="MissionDiscussion.handleKeyDown(event)"
                  oninput="MissionDiscussion.autoResize(this)"></textarea>
                <button class="send-btn" id="mission-send-btn" onclick="MissionDiscussion.send()">➤</button>
              </div>
              <div class="input-hint">Enter to send · Shift+Enter for new line</div>
            </div>
          </div>
        </div>
      </div>`;

    _renderMessages();
    if (_messages.length === 0) _startConversation();
  }

  function restart() {
    Storage.remove(`mission_discussion_${_missionId}`);
    _messages = [];
    render();
  }

  async function _startConversation() {
    const mission = _getMission();
    _setLoading(true, 'Thinking about this mission...');
    const prompt = `You are opening a reflective coaching discussion with Corinne about the mission "${mission.title}".
Write 2-4 warm, specific paragraphs. Include a few fresh thoughts about why this topic matters, then ask ONE open-ended question that invites Corinne to discuss her feelings, experience, concerns, or hopes about this topic.
Be conversational, not generic. Do not include URLs, markdown links, or resource links in the chat message. The app shows subject-specific resources in a separate panel.`;

    const text = await _askClaude(prompt, _fallbackStarter(mission));
    _messages.push({ role: 'assistant', content: text });
    _save();
    _setLoading(false);
    _renderMessages();
  }

  async function send() {
    if (_loading) return;
    const input = document.getElementById('mission-input');
    const text = input?.value.trim();
    if (!text) return;

    input.value = '';
    autoResize(input);
    _messages.push({ role: 'user', content: text });
    _renderMessages();
    _save();

    const mission = _getMission();
    _setLoading(true, 'Listening...');
    const prompt = `Continue this mission coaching conversation about "${mission.title}".
Corinne just said: "${text}"

Respond like a thoughtful career coach. Acknowledge what she said, offer practical advice, and ask one follow-up question to keep the discussion genuine. Do not include URLs, markdown links, or resource links in the chat message.`;

    const fallback = _fallbackReply(mission, text);
    const reply = await _askClaude(prompt, fallback);
    _messages.push({ role: 'assistant', content: reply });
    _save();
    _setLoading(false);
    _renderMessages();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  async function _askClaude(prompt, fallback) {
    try {
      const history = _messages.slice(-8).map(m => `${m.role === 'user' ? 'Corinne' : 'Coach'}: ${m.content}`).join('\n\n');
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 700,
          stream: false,
          system: Claude.buildSystemPrompt(),
          messages: [{
            role: 'user',
            content: `${history ? `Conversation so far:\n${history}\n\n` : ''}${prompt}`,
          }],
        }),
      });
      if (!r.ok) throw new Error('Claude unavailable');
      const data = await r.json();
      return _stripLinks(data.content?.[0]?.text || fallback);
    } catch {
      return fallback;
    }
  }

  function _fallbackStarter(mission) {
    const starters = FALLBACK_STARTERS[mission.id] || FALLBACK_STARTERS.dossier;
    const thought = starters[Math.floor(Math.random() * starters.length)];
    return thought;
  }

  function _fallbackReply(mission, userText) {
    const lower = userText.toLowerCase();
    const feeling = lower.includes('nerv') || lower.includes('scared') || lower.includes('awkward')
      ? 'That reaction makes sense. This is exactly the kind of thing that gets easier when we break it into one small, low-pressure next step.'
      : 'That is useful context. I would treat this as a signal about where to focus first, not as a verdict about your ability.';

    return `${feeling}\n\nFor this mission, I would start by turning your answer into one concrete experiment you can try this week. Keep it small enough that you can actually do it, then we can learn from what happens.\n\nWhat would feel like a realistic first step for you here?`;
  }

  function _resourceHTML(missionId) {
    return (RESOURCE_LINKS[missionId] || RESOURCE_LINKS.dossier)
      .map(([label, url]) => `<a class="mission-resource-link" href="${url}" target="_blank" rel="noopener">
        <span class="mission-resource-icon">↗</span>
        <span>${label}</span>
      </a>`)
      .join('');
  }

  function _resourceSentence(missionId) {
    return (RESOURCE_LINKS[missionId] || RESOURCE_LINKS.dossier)
      .map(([label, url]) => `${label} (${url})`)
      .join(' and ');
  }

  function _renderMessages() {
    const el = document.getElementById('mission-messages');
    if (!el) return;
    el.innerHTML = _messages.map(m => `
      <div class="message ${m.role === 'user' ? 'user' : 'coach'}">
        <div class="msg-avatar ${m.role === 'user' ? 'user-av' : 'coach-av'}">${m.role === 'user' ? 'C' : '🎯'}</div>
        <div class="msg-bubble">${_formatContent(m.content)}</div>
      </div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  function _setLoading(loading, label = 'Thinking...') {
    _loading = loading;
    const btn = document.getElementById('mission-send-btn');
    if (btn) btn.disabled = loading;
    const el = document.getElementById('mission-messages');
    if (!el) return;
    const existing = document.getElementById('mission-loading');
    if (existing) existing.remove();
    if (loading) {
      el.insertAdjacentHTML('beforeend', `
        <div class="message coach" id="mission-loading">
          <div class="msg-avatar coach-av">🎯</div>
          <div class="typing-indicator" title="${_escape(label)}">
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
          </div>
        </div>`);
      el.scrollTop = el.scrollHeight;
    }
  }

  function _save() {
    Storage.set(`mission_discussion_${_missionId}`, _cleanMessages(_messages));
  }

  function _getMission() {
    return Milestones.getDefs().find(m => m.id === _missionId) || Milestones.getDefs()[0];
  }

  function _formatContent(text) {
    const escaped = _escape(_stripLinks(text || ''));
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  function _cleanMessages(messages) {
    return (messages || []).map(m => ({ ...m, content: _stripLinks(m.content || '') }));
  }

  function _stripLinks(text) {
    return String(text)
      .replace(/\s*\([^)]*https?:\/\/[^)]*\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/A few places that may help as we talk:[\s\S]*$/i, '')
      .replace(/One resource path worth checking:[\s\S]*?(?=\n\n|$)/gi, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function _escape(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCurrentMissionId() {
    return _missionId;
  }

  return { open, render, restart, send, handleKeyDown, autoResize, getCurrentMissionId };
})();
