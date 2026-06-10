/* Shared chat memory — cheap persistence during chats, Claude consolidation on exit */
const ChatMemory = (() => {
  const STORAGE_KEY = 'chat_memory';
  const FLUSH_INTERVAL_MS = 30000;
  const FAILURE_INDICATOR_THRESHOLD = 3;

  let _memory = _emptyMemory();
  let _loaded = false;
  let _dirty = false;
  let _revision = 0;
  let _flushPromise = null;
  let _regeneratePromise = null;
  let _intervalId = null;
  let _activeView = null;
  let _failureCount = 0;
  let _listenersBound = false;

  function _emptyMemory() {
    return { summary: '', pending: [], updated_at: '' };
  }

  function _normalize(value) {
    if (!value || typeof value !== 'object') return _emptyMemory();
    return {
      summary: typeof value.summary === 'string' ? value.summary : '',
      pending: Array.isArray(value.pending) ? value.pending.filter(Boolean) : [],
      updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
    };
  }

  function load() {
    if (!_loaded) {
      _memory = _normalize(Storage.get(STORAGE_KEY, _emptyMemory()));
      _loaded = true;
    }
    return _memory;
  }

  function getSummary() {
    load();
    return _memory.summary;
  }

  function appendMessage(role, content, source = _activeView || 'unknown') {
    if (!content || !String(content).trim()) return;
    load();
    _memory.pending.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      content: String(content),
      source,
      timestamp: new Date().toISOString(),
    });
    _memory.updated_at = new Date().toISOString();
    _revision += 1;
    _dirty = true;
  }

  async function flushPending() {
    load();
    if (!_dirty) return;
    if (_flushPromise) return _flushPromise;

    const revisionAtStart = _revision;
    const snapshot = _normalize(_memory);
    _flushPromise = Promise.resolve()
      .then(() => Storage.set(STORAGE_KEY, snapshot))
      .then(() => {
        _dirty = _revision !== revisionAtStart;
        _recordSuccess();
      })
      .catch(err => {
        _recordFailure(err);
      })
      .finally(() => {
        _flushPromise = null;
      });
    return _flushPromise;
  }

  async function regenerate() {
    load();
    if (_regeneratePromise) return _regeneratePromise;
    if (_memory.pending.length === 0) return;

    const previousSummary = _memory.summary;
    const pendingSnapshot = _memory.pending.slice();
    _regeneratePromise = (async () => {
      await flushPending();

      const transcript = pendingSnapshot
        .map(message => {
          const speaker = message.role === 'assistant' ? 'Coach' : 'Corinne';
          const source = message.source ? ` [${message.source}]` : '';
          return `${speaker}${source}: ${message.content}`;
        })
        .join('\n\n');

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Config.claudeModel(),
          max_tokens: 1200,
          stream: false,
          messages: [{
            role: 'user',
            content: `Consolidate this JobSearchCoach memory into one durable markdown summary.
Preserve concrete facts, companies, roles, people, deadlines, decisions, concerns, mission progress, resume details, open questions, and next priorities. Do not invent facts. Retain useful details from the prior summary while integrating the new conversation.

PRIOR SUMMARY:
${previousSummary || '(none)'}

NEW CONVERSATION:
${transcript}`,
          }],
        }),
      });
      if (!response.ok) throw new Error(`Chat memory regeneration failed (${response.status})`);
      const data = await response.json();
      const summary = data.content?.[0]?.text?.trim();
      if (!summary) throw new Error('Chat memory regeneration returned no summary');

      const remainingPending = _memory.pending.slice(pendingSnapshot.length);
      const nextMemory = {
        summary,
        pending: remainingPending,
        updated_at: new Date().toISOString(),
      };
      const priorMemory = _memory;
      _memory = nextMemory;
      _revision += 1;
      const revisionAtSave = _revision;
      try {
        await Storage.set(STORAGE_KEY, _normalize(nextMemory));
        _dirty = _revision !== revisionAtSave;
        _recordSuccess();
      } catch (err) {
        _memory = priorMemory;
        _dirty = true;
        localStorage.setItem(`jsc_${STORAGE_KEY}`, JSON.stringify(_memory));
        _recordFailure(err);
      }
    })()
      .catch(err => {
        _recordFailure(err);
      })
      .finally(() => {
        _regeneratePromise = null;
      });
    return _regeneratePromise;
  }

  function mount(viewId) {
    load();
    _activeView = viewId;
    _bindGlobalListeners();
    if (_intervalId === null) {
      _intervalId = setInterval(() => {
        void flushPending();
      }, FLUSH_INTERVAL_MS);
    }
  }

  function unmount({ consolidate = true } = {}) {
    _activeView = null;
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    if (consolidate) {
      void regenerate();
    } else {
      void flushPending();
    }
  }

  function _bindGlobalListeners() {
    if (_listenersBound) return;
    _listenersBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushPending();
    });
    window.addEventListener('beforeunload', () => {
      void flushPending();
    });
  }

  function _recordSuccess() {
    _failureCount = 0;
    document.getElementById('chat-memory-status')?.remove();
  }

  function _recordFailure(err) {
    _failureCount += 1;
    console.warn('JobSearchCoach chat memory could not be saved:', err);
    if (_failureCount < FAILURE_INDICATOR_THRESHOLD || !document.body) return;
    let indicator = document.getElementById('chat-memory-status');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chat-memory-status';
      indicator.setAttribute('role', 'status');
      indicator.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:7px 10px;border:1px solid var(--danger);border-radius:6px;background:var(--card-bg);color:var(--text);font-size:12px;box-shadow:var(--shadow)';
      document.body.appendChild(indicator);
    }
    indicator.textContent = 'Chat memory sync paused';
  }

  return { load, getSummary, appendMessage, flushPending, regenerate, mount, unmount };
})();
