/* Coach chat view */
const Coach = (() => {
  let _session = [];       // Current session messages [{role, content}]
  let _streaming = false;
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;
    _session = Storage.get('coach_current_session', []);
    if (Array.isArray(_session) && _session.length) {
      _renderPersistedSession();
    } else {
      _session = [];
      _renderWelcome();
    }
  }

  function _renderWelcome() {
    const profile = Storage.get('profile', {});
    const name = profile.name || 'there';
    const mission = Milestones.getCurrentMission();

    _appendMessage('coach', `Hey ${name}! Ready to work on your job search today? 🎯

I've got your current context — you're on **Mission ${mission.codename}**: *${mission.title}*.

What would you like to focus on? I can help you with:
- **Resume** — review, tailoring, or a specific section
- **Applications** — strategy, targeting, or cover letter help
- **Networking** — outreach scripts, LinkedIn, alumni connections
- **Interview prep** — behavioral questions, company research, salary negotiation
- Or just tell me what's on your mind.`);
  }

  function _appendMessage(role, content, isStreaming = false) {
    const area = document.getElementById('messages-area');
    const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.id = id;

    const isCoach = role === 'coach';
    div.innerHTML = `
      <div class="msg-avatar ${isCoach ? 'coach-av' : 'user-av'}">${isCoach ? '🎯' : '👤'}</div>
      <div class="msg-bubble">${_formatContent(content)}</div>`;

    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return id;
  }

  function _renderPersistedSession() {
    const area = document.getElementById('messages-area');
    if (area) area.innerHTML = '';
    _session.forEach(msg => _appendMessage(msg.role === 'assistant' ? 'coach' : msg.role, msg.content));
  }

  function _saveCurrentSession() {
    Storage.set('coach_current_session', _session);
  }

  function _showTyping() {
    const area = document.getElementById('messages-area');
    const div = document.createElement('div');
    div.className = 'message coach';
    div.id = 'typing-indicator';
    div.innerHTML = `
      <div class="msg-avatar coach-av">🎯</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  function _removeTyping() {
    document.getElementById('typing-indicator')?.remove();
  }

  function _formatContent(text) {
    // Basic markdown-ish formatting
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  async function send() {
    if (_streaming) return;
    const input = document.getElementById('coach-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = '44px';

    // Add user message to session and UI
    _session.push({ role: 'user', content: text });
    _saveCurrentSession();
    _appendMessage('user', text);

    _streaming = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('coach-status-label').textContent = '● Thinking...';
    document.getElementById('coach-status-label').style.color = 'var(--gold)';

    _showTyping();

    // Create streaming bubble
    let streamContent = '';
    let streamMsgId = null;

    try {
      await Claude.sendMessage(
        _session,
        // onChunk
        (chunk) => {
          _removeTyping();
          streamContent += chunk;
          if (!streamMsgId) {
            streamMsgId = _appendMessage('coach', '');
          }
          const bubble = document.querySelector(`#${streamMsgId} .msg-bubble`);
          if (bubble) bubble.innerHTML = _formatContent(streamContent);
          const area = document.getElementById('messages-area');
          area.scrollTop = area.scrollHeight;
        },
        // onDone
        (fullText, error) => {
          _removeTyping();
          if (error) {
            _appendMessage('coach', `Sorry, I hit a snag: *${error}*. Please check your API key in Settings and try again.`);
          } else if (fullText) {
            // Update final bubble with proper formatting
            const bubble = document.querySelector(`#${streamMsgId} .msg-bubble`);
            if (bubble) bubble.innerHTML = _formatContent(fullText);
            _session.push({ role: 'assistant', content: fullText });
            _saveCurrentSession();
          }
        }
      );
    } catch (err) {
      _removeTyping();
      _appendMessage('coach', `Something went wrong. Check that your API key is configured in **Settings**.`);
    }

    _streaming = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('coach-status-label').textContent = '● Ready';
    document.getElementById('coach-status-label').style.color = 'var(--success)';

    const area = document.getElementById('messages-area');
    area.scrollTop = area.scrollHeight;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function autoResize(el) {
    el.style.height = '44px';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  async function compressAndNewSession() {
    if (_session.length > 0) {
      document.getElementById('coach-status-label').textContent = '● Saving session...';
      await Claude.saveSession([..._session]);
      Storage.remove('coach_current_session');
      UI.notify('Session saved', 'success');
    }
    _session = [];
    document.getElementById('messages-area').innerHTML = '';
    _renderWelcome();
    document.getElementById('coach-status-label').textContent = '● Ready';
  }

  function showSessionHistory() {
    const data = Storage.get('sessions', { sessions: [], compressed: [] });
    const sessions = data.sessions || [];
    const compressed = data.compressed || [];

    if (sessions.length === 0 && compressed.length === 0) {
      UI.notify('No previous sessions yet', 'info');
      return;
    }

    const body = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        ${compressed.length} compressed summaries + ${sessions.length} full sessions stored.
      </div>
      ${sessions.map((s, i) => `
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
            ${new Date(s.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
            — ${s.messages.length} messages
          </div>
          <div style="font-size:13px;color:var(--text)">${s.messages[0]?.content.slice(0, 120)}...</div>
        </div>`).join('')}`;

    UI.showModal('Session History', body, [
      { id: 'close', label: 'Close', class: 'btn-ghost' },
    ]);
  }

  return { init, send, handleKeyDown, autoResize, compressAndNewSession, showSessionHistory };
})();
