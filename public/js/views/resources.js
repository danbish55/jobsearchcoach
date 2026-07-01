/* Resources view */
const Resources = (() => {
  const sectionStates = {};
  const SECTION_DEFS = [
    {
      id: 'market_intel',
      title: 'MARKET INTEL',
      description: 'Hiring trends, salary data, and opportunities for entry-level analytics roles in 2026.',
      prompt: "Today is July 2026. Search for data analytics job market news published in June or July 2026 — hiring growth, business intelligence demand, analytics salary increases, or companies expanding data teams. Find 4 results from the last 60 days maximum. Reject anything published before May 2026. For each result return: headline (max 10 words), source name, publication date (must be June or July 2026), one-sentence summary in an upbeat tone, and the URL. STRICT RULES: No AI-doom or 'AI is replacing jobs' framing. No 'brutal market' or layoff statistics. No anxiety-inducing content. If you cannot find 4 results from the last 60 days, return only what you find — do not pad with older articles. Format as JSON array.",
    },
    {
      id: 'field_strategy',
      title: 'FIELD STRATEGY',
      description: 'Actionable job search tactics, networking moves, and resume tips for analytics candidates.',
      prompt: "Search for recent articles, LinkedIn posts, or blog posts (published in the last 90 days) with specific, actionable advice on: landing a first data analyst job, networking strategies for analytics careers, how to stand out in analytics interviews, building a data portfolio, or optimizing a resume for data roles. Find 4 results with genuinely useful tactics — not generic listicles. For each result return: headline (max 10 words), source name, publication date, one-sentence description of the specific takeaway, and the URL. STRICT RULES: Avoid any content framing AI as a threat to analytics jobs. Avoid doom-and-gloom job market takes. Focus only on empowering, practical, can-do advice. Format as JSON array.",
    },
    {
      id: 'skills_edge',
      title: 'SKILLS EDGE',
      description: 'Tools, certifications, and skills giving entry-level analysts a competitive edge right now.',
      prompt: "Search for recent articles or resources (2025-2026) about which specific tools, certifications, or skills are most in-demand for entry-level data analysts right now — things like SQL, Python, Tableau, Power BI, dbt, Excel, Looker, or data storytelling. Find 4 results that highlight specific skills worth developing or certifications worth earning. For each result return: headline (max 10 words), source name, publication date, one-sentence description of the specific skill or tool highlighted and why it matters, and the URL. STRICT RULES: Frame AI tools (Copilot, ChatGPT for analysts, etc.) only as productivity boosters the candidate can learn — NOT as job-replacement threats. No doom framing. No anxiety content. Format as JSON array.",
    },
    {
      id: 'briefing_room',
      title: 'BRIEFING ROOM',
      description: 'Fresh videos on interview prep, portfolios, and analyst career growth.',
      prompt: "Search YouTube for recent videos (last 90 days preferred) about data analyst interview prep, building a data analytics portfolio, SQL or Python practice for job seekers, or early-career data analyst advice. Strongly prioritize these trusted channels: Alex The Analyst, Luke Barousse, Ken Jee, StatQuest with Josh Starmer, Data School, codebasics, Chandoo, Keith Galli, Tina Huang, Sundas Khalid, and Sabrina Romonov. If fewer than 4 recent matches exist, include the most relevant videos from those channels regardless of date. For each result return: video title (max 10 words), channel name, approximate publish date, one-sentence description of why it is useful for an entry-level job seeker, and the YouTube URL. STRICT RULES: No 'AI will replace analysts' content. No doom takes. Only practical, skill-building, or career-growth videos. Format as JSON array.",
      webSearch: { max_uses: 8, allowed_domains: ['youtube.com', 'youtu.be'] },
    },
  ];

  function render() {
    const container = document.getElementById('resources-content');
    const progress = _progress();
    container.innerHTML = `
      <div class="resources-page">
        <div class="resources-header">
          <div>
            <div class="view-title">Intelligence Briefing Room</div>
            <div class="view-subtitle">Daily field reports, market intelligence, and tactical resources. Refreshed on demand.</div>
            <div class="resources-note">Resources open in a new tab. Save items to revisit later.</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Resources.refreshAll()">Refresh All</button>
        </div>
        <div class="resources-section-stack">
          ${SECTION_DEFS.map(def => _sectionHTML(def, progress)).join('')}
        </div>
        ${_savedHTML(progress)}
      </div>`;
  }

  function _sectionHTML(def, progress) {
    const items = progress[_itemsKey(def.id)] || [];
    const updated = progress[_updatedKey(def.id)] || null;
    return `
      <section class="resources-intel-section" id="resources-section-${def.id}">
        <div class="resources-section-top">
          <div>
            <div class="resources-section-title">${def.title}</div>
            <div class="resources-section-description">${def.description}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Resources.refreshSection('${def.id}')">Refresh Intel</button>
        </div>
        <div class="resources-updated">${updated ? `Last updated: ${_formatTime(updated)}` : 'No intel loaded yet.'}</div>
        <div class="resources-card-grid" id="resources-list-${def.id}">
          ${items.length ? items.map(item => _cardHTML(item, def.id, false, progress)).join('') : _emptyHTML(def.id)}
        </div>
        ${_sectionStatus(def.id) === 'loading' ? _loadingOverlayHTML(def.title) : ''}
      </section>`;
  }

  function _loadingOverlayHTML(title) {
    return `<div class="resources-loading-overlay">
      <div class="resources-loading-panel">
        <div class="resources-loading-title">${_esc(title)}</div>
        <div class="resources-loading-spinner" aria-hidden="true"></div>
        <div class="resources-loading-text">Running JobLeadsTool cycle... Please be patient - this takes a while.</div>
      </div>
    </div>`;
  }

  function _emptyHTML(sectionId) {
    return `<div class="resources-empty-card">
      No intel loaded yet. Click 'Refresh Intel' to scan the latest field reports.
    </div>`;
  }

  function _cardHTML(item, sectionId, savedView = false, progress = _progress()) {
    const saved = _isSaved(item.url, progress);
    return `
      <article class="resources-result-card ${saved ? 'saved' : ''}">
        ${saved && !savedView ? '<div class="resources-bookmark">Saved</div>' : ''}
        <div class="resources-source">${_esc(item.source || item.channel || 'FIELD REPORT')}</div>
        <div class="resources-headline">${_esc(item.headline || item.title || 'Untitled intel')}</div>
        <div class="resources-summary">${_esc(item.summary || item.description || '')}</div>
        <div class="resources-date">${_esc(item.publication_date || item.publish_date || item.date || '')}</div>
        <div class="resources-card-actions">
          <button class="btn btn-primary btn-sm" onclick="Resources.openItem('${_escAttr(item.url || '')}')">Open</button>
          <button class="btn btn-primary btn-sm" onclick="${savedView ? `Resources.unsaveItem('${_escAttr(item.url || '')}')` : `Resources.saveItem('${sectionId}', '${_escAttr(item.url || '')}')`}">
            ${savedView ? 'Unsave' : 'Save'}
          </button>
        </div>
      </article>`;
  }

  function _savedHTML(progress) {
    const saved = progress.saved_resources || [];
    return `
      <section class="resources-saved">
        <button class="resources-saved-toggle" onclick="Resources.toggleSaved()">
          <span>Saved Intel</span>
          <span class="resources-saved-badge">Saved (${saved.length})</span>
        </button>
        <div class="resources-saved-body hidden" id="resources-saved-body">
          ${saved.length ? saved.map(item => _cardHTML(item, item.section, true, progress)).join('') : '<div class="resources-empty-card">No saved intel yet.</div>'}
        </div>
      </section>`;
  }

  async function refreshSection(sectionId) {
    _setSectionLoading(sectionId);
    const def = SECTION_DEFS.find(section => section.id === sectionId);
    if (!def) return;
    if (!def.prompt) {
      _setSectionError(sectionId);
      return;
    }
    try {
      const items = await _fetchIntel(def);
      if (!items.length) throw new Error('No results');
      const progress = _progress();
      progress[_itemsKey(sectionId)] = items.map(item => ({ ...item, section: sectionId }));
      progress[_updatedKey(sectionId)] = new Date().toISOString();
      sectionStates[sectionId] = 'loaded';
      Storage.set('progress', progress);
      render();
    } catch {
      _setSectionError(sectionId);
    }
  }

  function refreshAll() {
    SECTION_DEFS.forEach(def => refreshSection(def.id));
  }

  function _setSectionLoading(sectionId) {
    sectionStates[sectionId] = 'loading';
    _showSectionOverlay(sectionId);
  }

  function _setSectionError(sectionId) {
    sectionStates[sectionId] = 'error';
    _removeSectionOverlay(sectionId);
    const list = document.getElementById(`resources-list-${sectionId}`);
    if (!list) return;
    list.innerHTML = `<div class="resources-empty-card">
      Intelligence unavailable. Check your API connection or try refreshing.
      <div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="Resources.refreshSection('${sectionId}')">Retry</button></div>
    </div>`;
  }

  function _showSectionOverlay(sectionId) {
    const section = document.getElementById(`resources-section-${sectionId}`);
    if (!section || section.querySelector('.resources-loading-overlay')) return;
    const def = SECTION_DEFS.find(item => item.id === sectionId);
    section.insertAdjacentHTML('beforeend', _loadingOverlayHTML(def?.title || 'INTEL'));
  }

  function _removeSectionOverlay(sectionId) {
    document.querySelector(`#resources-section-${sectionId} .resources-loading-overlay`)?.remove();
  }

  async function _fetchIntel(def) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Config.claudeModel(),
        max_tokens: 1400,
        stream: false,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, ...(def.webSearch || {}) }],
        messages: [{ role: 'user', content: def.prompt }],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || 'Search failed');
    }
    const payload = await response.json();
    const text = (payload.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('\n');
    return _parseItems(text);
  }

  function _parseItems(text) {
    const raw = String(text || '').replace(/```json|```/g, '').trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return _parseLooseVideoItems(raw);
    try {
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(item => ({
        headline: _firstValue(item, ['headline', 'title', 'video_title', 'videoTitle', 'video title']),
        source: _firstValue(item, ['source', 'source_name', 'sourceName', 'channel', 'channel_name', 'channelName', 'channel name']),
        publication_date: _firstValue(item, ['publication_date', 'publicationDate', 'publish_date', 'publishDate', 'approximate_publish_date', 'approximatePublishDate', 'approximate publish date', 'date']),
        summary: _firstValue(item, ['summary', 'description', 'insight']),
        url: _firstValue(item, ['url', 'URL', 'youtube_url', 'youtubeUrl', 'youtube URL', 'YouTube URL', 'video_url', 'videoUrl', 'video URL']),
      })).filter(item => item.headline && item.url);
    } catch {
      return _parseLooseVideoItems(raw);
    }
  }

  function _parseLooseVideoItems(text) {
    const urlPattern = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s),\]]+|youtu\.be\/[^\s),\]]+)/gi;
    const lines = String(text || '').split(/\n+/);
    const items = [];
    lines.forEach(line => {
      const urls = line.match(urlPattern);
      if (!urls) return;
      const url = urls[0].replace(/[.]+$/, '');
      const cleaned = line
        .replace(urlPattern, '')
        .replace(/^[-*\d.\s"']+/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const parts = cleaned.split(/\s+-\s+|\s+\|\s+/).map(part => part.trim()).filter(Boolean);
      items.push({
        headline: parts[0] || 'YouTube briefing',
        source: parts[1] || 'YouTube',
        publication_date: parts[2] || '',
        summary: parts.slice(3).join(' - '),
        url,
      });
    });
    return items.filter((item, index, all) =>
      item.url && all.findIndex(candidate => candidate.url === item.url) === index
    ).slice(0, 4);
  }

  function _firstValue(item, keys) {
    for (const key of keys) {
      if (item[key]) return item[key];
    }
    return '';
  }

  function openItem(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function saveItem(sectionId, url) {
    const progress = _progress();
    const item = (progress[_itemsKey(sectionId)] || []).find(entry => entry.url === url);
    if (!item) return;
    const saved = progress.saved_resources || [];
    if (!saved.some(entry => entry.url === url)) {
      saved.push({
        headline: item.headline || item.title || '',
        source: item.source || item.channel || '',
        url: item.url,
        date_saved: new Date().toISOString(),
        section: sectionId,
        summary: item.summary || item.description || '',
        publication_date: item.publication_date || item.publish_date || item.date || '',
      });
      progress.saved_resources = saved;
      Storage.set('progress', progress);
    }
    render();
  }

  function unsaveItem(url) {
    const progress = _progress();
    progress.saved_resources = (progress.saved_resources || []).filter(item => item.url !== url);
    Storage.set('progress', progress);
    render();
  }

  function toggleSaved() {
    document.getElementById('resources-saved-body')?.classList.toggle('hidden');
  }

  function _progress() {
    const progress = Storage.get('progress', {});
    const defaults = {
      resources_market_intel: [],
      resources_market_intel_updated: null,
      resources_field_strategy: [],
      resources_field_strategy_updated: null,
      resources_skills_edge: [],
      resources_skills_edge_updated: null,
      resources_briefing_room: [],
      resources_briefing_room_updated: null,
      saved_resources: [],
    };
    const missing = Object.keys(defaults).some(key => progress[key] === undefined);
    return missing ? Storage.merge('progress', { ...defaults, ...progress }) : progress;
  }

  function _itemsKey(sectionId) {
    return `resources_${sectionId}`;
  }

  function _updatedKey(sectionId) {
    return `resources_${sectionId}_updated`;
  }

  function _isSaved(url, progress = _progress()) {
    return !!url && (progress.saved_resources || []).some(item => item.url === url);
  }

  function _sectionStatus(sectionId, progress = _progress()) {
    if (sectionStates[sectionId]) return sectionStates[sectionId];
    return (progress[_itemsKey(sectionId)] || []).length ? 'loaded' : 'waiting';
  }

  function _formatTime(value) {
    try {
      return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function _esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(value) {
    return _esc(value).replace(/'/g, '&#39;');
  }

  return { render, refreshSection, refreshAll, openItem, saveItem, unsaveItem, toggleSaved };
})();
