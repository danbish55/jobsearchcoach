/* USC Fight On Easter eggs */
(() => {

  // ── Shared styles (injected once) ────────────────────────────────────────
  const _style = document.createElement('style');
  _style.textContent = `
    @keyframes fo-fall   { to { transform:translateY(110vh) rotate(720deg); opacity:0; } }
    @keyframes fo-pop    {
      from { opacity:0; transform:translate(-50%,-50%) scale(0.2); }
      60%  { opacity:1; transform:translate(-50%,-50%) scale(1.1); }
      to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
    }
    @keyframes fo-appear {
      from { opacity:0; transform:scale(0.85); }
      to   { opacity:1; transform:scale(1); }
    }`;
  document.head.appendChild(_style);

  // ── Fight On: melody + confetti ──────────────────────────────────────────
  function _play() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [
      [392,0.15],[392,0.15],[392,0.30],[330,0.15],[392,0.15],[440,0.30],
      [523,0.15],[494,0.15],[440,0.15],[392,0.55]
    ];
    let t = ctx.currentTime + 0.05;
    notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
      osc.start(t); osc.stop(t + dur);
      t += dur;
    });
  }

  function _confetti() {
    const colors = ['#990000','#FFCC00','#ffffff','#cc3333','#ffd700'];
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden';
    for (let i = 0; i < 100; i++) {
      const p = document.createElement('div');
      const size = 5 + Math.random() * 9;
      p.style.cssText =
        `position:absolute;top:-20px;left:${Math.random()*100}%;` +
        `width:${size}px;height:${size}px;background:${colors[i % colors.length]};` +
        `border-radius:${Math.random() > 0.5 ? '50%' : '2px'};` +
        `animation:fo-fall ${2 + Math.random()*2}s ${Math.random()*0.8}s ease-in forwards;`;
      wrap.appendChild(p);
    }
    const banner = document.createElement('div');
    banner.style.cssText =
      'position:fixed;top:45%;left:50%;' +
      'font-size:clamp(40px,8vw,80px);font-weight:900;letter-spacing:2px;' +
      'color:#FFCC00;text-shadow:3px 3px 0 #990000,6px 6px 16px rgba(0,0,0,0.6);' +
      'z-index:9999;pointer-events:none;white-space:nowrap;' +
      'animation:fo-pop 0.4s ease-out forwards;';
    banner.textContent = '✌️ FIGHT ON!';
    document.body.appendChild(wrap);
    document.body.appendChild(banner);
    setTimeout(() => { wrap.remove(); banner.remove(); }, 5000);
  }

  // ── Egg 1: Gauge goal hit ────────────────────────────────────────────────
  document.addEventListener('gauge-goal-hit', () => {
    try { _play(); } catch (_) {}
    _confetti();
  });

  // ── Egg 2: Coach avatar triple-click ─────────────────────────────────────
  const COACH_QUOTES = [
    "Every rejection is redirection. You've got this, Trojan! ✌️",
    "The right company is out there. Your job is to find them first. 🏆",
    "Trojans don't wait for opportunities. They create them. 💪",
    "Fight On, Corinne. One more application. One step closer. 🎯",
  ];
  let _coachClicks = 0, _coachTimer = null, _coachQIdx = 0;

  function _coachMotivate() {
    const avatar = document.querySelector('.coach-avatar');
    if (avatar) {
      let frame = 0;
      const dance = setInterval(() => {
        avatar.style.transform = [
          'rotate(-15deg) scale(1.3)',
          'rotate(15deg) scale(1.1)',
          'rotate(-10deg) scale(1.25)',
          'rotate(10deg) scale(1.1)',
          'rotate(0) scale(1)',
        ][frame % 5];
        if (++frame > 15) { clearInterval(dance); avatar.style.transform = ''; }
      }, 80);
    }
    const popup = document.createElement('div');
    popup.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:linear-gradient(135deg,#990000,#cc0000);color:#FFCC00;' +
      'padding:16px 28px;border-radius:16px;font-size:15px;font-weight:600;' +
      'text-align:center;max-width:360px;width:90%;z-index:9999;pointer-events:none;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:fo-appear 0.3s ease-out forwards;';
    popup.textContent = COACH_QUOTES[_coachQIdx++ % COACH_QUOTES.length];
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 4000);
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.coach-avatar')) return;
    _coachClicks++;
    clearTimeout(_coachTimer);
    if (_coachClicks >= 3) {
      _coachClicks = 0;
      _coachMotivate();
    } else {
      _coachTimer = setTimeout(() => { _coachClicks = 0; }, 1500);
    }
  });

  // ── Streak helper ────────────────────────────────────────────────────────
  function _today() { return new Date().toISOString().slice(0, 10); }

  function _recordAndCheckStreak(key, n) {
    const dates = JSON.parse(localStorage.getItem(key) || '[]');
    const today = _today();
    if (dates[dates.length - 1] === today) return false;
    dates.push(today);
    if (dates.length > n) dates.splice(0, dates.length - n);
    localStorage.setItem(key, JSON.stringify(dates));
    if (dates.length < n) return false;
    for (let i = dates.length - 1; i > 0; i--) {
      if ((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000 !== 1) return false;
    }
    return true;
  }

  // ── Egg 3: Open app 3 days in a row ─────────────────────────────────────
  function _showDayStreakMeme() {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9998;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.onclick = () => overlay.remove();

    const card = document.createElement('div');
    card.style.cssText =
      'background:#111;border:2px solid #FFCC00;border-radius:20px;' +
      'padding:28px 36px;max-width:420px;width:90%;text-align:center;' +
      'box-shadow:0 0 60px rgba(255,204,0,0.25);animation:fo-appear 0.35s ease-out forwards;';
    card.innerHTML = `
      <div style="font-size:42px;margin-bottom:6px">🔥</div>
      <div style="font-size:20px;font-weight:900;color:#FFCC00;margin-bottom:4px">3-DAY STREAK</div>
      <div style="font-size:13px;color:#888;margin-bottom:20px">You've shown up 3 days in a row. That's the game.</div>
      <div style="display:grid;grid-template-columns:48px 1fr;gap:10px;text-align:left;margin-bottom:20px;align-items:center">
        <div style="font-size:28px;text-align:center;filter:grayscale(1);opacity:0.4">🧑‍💻</div>
        <div style="background:#2a2a2a;border-radius:10px;padding:10px 14px;font-size:13px;color:#999">
          "Checking LinkedIn once and closing the laptop"
        </div>
        <div style="font-size:28px;text-align:center">😤</div>
        <div style="background:#5a0000;border:1px solid #FFCC00;border-radius:10px;padding:10px 14px;font-size:13px;color:#FFCC00;font-weight:600">
          Opening JobSearchCoach 3 days straight like the Trojan she is
        </div>
      </div>
      <div style="font-size:11px;color:#555">tap anywhere to close</div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  setTimeout(() => {
    if (_recordAndCheckStreak('jsc_open_streak', 3)) _showDayStreakMeme();
  }, 2500);

  // ── Egg 4: Run the scraper 3 days in a row ───────────────────────────────
  function _showScrapeStreakBadge() {
    const badge = document.createElement('div');
    badge.style.cssText =
      'position:fixed;top:24px;right:24px;z-index:9999;cursor:pointer;' +
      'animation:fo-appear 0.35s ease-out forwards;';
    badge.onclick = () => badge.remove();
    badge.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#0a0a14,#12122a);
        border:1px solid rgba(255,204,0,0.5);border-radius:16px;
        padding:18px 22px;max-width:260px;
        box-shadow:0 0 40px rgba(255,204,0,0.15),inset 0 0 20px rgba(255,204,0,0.04);
        font-family:monospace;">
        <div style="color:#FFCC00;font-size:10px;letter-spacing:3px;margin-bottom:8px">ACHIEVEMENT UNLOCKED</div>
        <div style="font-size:26px;margin-bottom:6px">🕵️‍♀️</div>
        <div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:4px">Data Detective</div>
        <div style="color:#999;font-size:12px;line-height:1.6;margin-bottom:12px">
          3-day scraping streak.<br>The algorithm fears you.
        </div>
        <div style="font-size:10px;color:#555;letter-spacing:1px">TAP TO DISMISS</div>
      </div>`;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 8000);
  }

  document.addEventListener('apify-scrape-complete', () => {
    if (_recordAndCheckStreak('jsc_scrape_streak', 3)) _showScrapeStreakBadge();
  });

})();
