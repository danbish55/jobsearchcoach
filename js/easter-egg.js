/* USC Fight On Easter egg — fires when any dashboard gauge hits its goal */
(() => {

  function _play() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Fight On opening phrase approximation
    const notes = [
      [392,0.15],[392,0.15],[392,0.30],[330,0.15],[392,0.15],[440,0.30],
      [523,0.15],[494,0.15],[440,0.15],[392,0.55]
    ];
    let t = ctx.currentTime + 0.05;
    notes.forEach(([freq, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  }

  function _confetti() {
    const colors = ['#990000','#FFCC00','#ffffff','#cc3333','#ffd700'];
    const wrap   = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fo-fall { to { transform:translateY(110vh) rotate(720deg); opacity:0; } }
      @keyframes fo-pop  {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.2); }
        60%  { opacity:1; transform:translate(-50%,-50%) scale(1.1); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1);   }
      }`;
    document.head.appendChild(style);

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
      'position:fixed;top:45%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:clamp(40px,8vw,80px);font-weight:900;letter-spacing:2px;' +
      'color:#FFCC00;text-shadow:3px 3px 0 #990000,6px 6px 16px rgba(0,0,0,0.6);' +
      'z-index:9999;pointer-events:none;white-space:nowrap;' +
      'animation:fo-pop 0.4s ease-out forwards;';
    banner.textContent = '✌️ FIGHT ON!';

    document.body.appendChild(wrap);
    document.body.appendChild(banner);
    setTimeout(() => { wrap.remove(); banner.remove(); style.remove(); }, 5000);
  }

  document.addEventListener('gauge-goal-hit', () => {
    try { _play(); } catch (_) {}
    _confetti();
  });
})();
