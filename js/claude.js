/* Claude API — streaming proxy + context window management */
const Claude = (() => {
  const MAX_FULL_SESSIONS = 3;       // Keep this many sessions in full
  const COMPRESS_THRESHOLD = 10;     // Messages per session before compression candidate

  let _coachingContext = '';  // Loaded fresh from disk on every app launch

  async function loadContext() {
    try {
      const res = await fetch('/api/context');
      const data = await res.json();
      _coachingContext = data.content || '';
    } catch (e) {
      _coachingContext = '';
    }
  }

  // Build the system prompt — coaching context file is primary; live stats appended
  function buildSystemPrompt() {
    const profile = Storage.get('profile', {});
    const jobs    = Storage.get('jobs', { applications: [] });
    const usc     = Storage.get('usc', {});
    const milestoneContext = Milestones.buildContextSummary();

    const appCount       = jobs.applications.length;
    const interviewCount = jobs.applications.filter(a => ['interview','offer'].includes(a.status)).length;
    const offerCount     = jobs.applications.filter(a => a.status === 'offer').length;

    const liveStats = `
---
## Live Session Data (updated each session from the app)
- Name: ${profile.name || 'Corinne'}
- Applications submitted: ${appCount}
- Interviews active: ${interviewCount}${offerCount ? `\n- Offers received: ${offerCount}` : ''}
- USC alumni network: ${usc.alumni_dms || 0} DMs, ${usc.coffee_chats || 0} coffee chats, ${usc.events_attended || 0} events
- Target roles: ${(profile.target_roles || []).join(', ') || 'not yet specified'}
- Target industries: ${(profile.target_industries || []).join(', ') || 'not yet specified'}
- Mission progress: ${milestoneContext}`;

    if (_coachingContext) {
      return _coachingContext + liveStats;
    }

    // Fallback if context file not loaded
    return `You are JobSearchCoach — the personal AI career coach for ${profile.name || 'Corinne'}.
You are warm, direct, and results-oriented. Help with resume, applications, interviews, networking, and negotiation.
Never break character. You are always the coach, never an AI assistant.` + liveStats;
  }

  // Build the full messages array for the API call
  function buildMessages(currentSession) {
    const sessionsData = Storage.get('sessions', { sessions: [], compressed: [] });
    const messages = [];

    // Insert compressed summaries as a single context message if they exist
    if (sessionsData.compressed && sessionsData.compressed.length > 0) {
      const summaryText = sessionsData.compressed
        .map((s, i) => `Session ${i + 1} summary:\n${s}`)
        .join('\n\n---\n\n');
      messages.push({
        role: 'user',
        content: `[Previous coaching session summaries for context:]\n\n${summaryText}`,
      });
      messages.push({
        role: 'assistant',
        content: 'Understood — I have reviewed our previous sessions and have that context in mind.',
      });
    }

    // Add recent full sessions (up to MAX_FULL_SESSIONS)
    const recentSessions = sessionsData.sessions.slice(-MAX_FULL_SESSIONS);
    for (const session of recentSessions) {
      for (const msg of session.messages || []) {
        messages.push(msg);
      }
    }

    // Add current session messages
    for (const msg of currentSession) {
      messages.push(msg);
    }

    return messages;
  }

  // Stream a message to Claude, calling onChunk(text) with each delta
  async function sendMessage(sessionMessages, onChunk, onDone) {
    const payload = {
      model: Config.claudeModel(),
      max_tokens: 1024,
      stream: true,
      system: buildSystemPrompt(),
      messages: buildMessages(sessionMessages),
    };

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error?.message || err.error || 'API error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep partial line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              fullText += evt.delta.text;
              onChunk(evt.delta.text);
            }
          } catch {}
        }
      }

      onDone(fullText);
      return fullText;
    } catch (err) {
      onDone(null, err.message);
      throw err;
    }
  }

  // Compress a session into a 150-200 word summary
  async function compressSession(messages) {
    if (!messages || messages.length === 0) return null;

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Corinne' : 'Coach'}: ${m.content}`)
      .join('\n\n');

    const payload = {
      model: Config.claudeModel(),
      max_tokens: 400,
      stream: false,
      messages: [{
        role: 'user',
        content: `Summarize this coaching session in 150–200 words. Capture: key topics discussed, decisions made, action items identified, and any important insights. Write from the coach's perspective.\n\nSession transcript:\n\n${transcript}`,
      }],
    };

    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      return data.content?.[0]?.text || null;
    } catch {
      return null;
    }
  }

  // Save current session and compress old ones if needed
  async function saveSession(messages) {
    if (!messages || messages.length === 0) return;

    const sessionsData = Storage.get('sessions', { sessions: [], compressed: [] });

    // Add current session
    sessionsData.sessions.push({
      id: Date.now(),
      date: new Date().toISOString(),
      messages,
    });

    // If we have more than MAX_FULL_SESSIONS, compress the oldest
    while (sessionsData.sessions.length > MAX_FULL_SESSIONS) {
      const oldest = sessionsData.sessions.shift();
      if (oldest.messages.length >= COMPRESS_THRESHOLD) {
        const summary = await compressSession(oldest.messages);
        if (summary) {
          sessionsData.compressed = sessionsData.compressed || [];
          sessionsData.compressed.push(summary);
          // Keep only last 10 compressed summaries
          if (sessionsData.compressed.length > 10) {
            sessionsData.compressed = sessionsData.compressed.slice(-10);
          }
        }
      }
      // Short sessions (< COMPRESS_THRESHOLD) are dropped — not worth summarizing
    }

    Storage.set('sessions', sessionsData);
  }

  return { loadContext, sendMessage, saveSession, buildSystemPrompt };
})();
