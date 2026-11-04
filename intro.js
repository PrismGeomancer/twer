// TOWER's 5-second opening: a radar scope draws in, four flights ping, a radio call is made,
// the tower answers CLEARED, the logo resolves and the overlay lifts. Standalone (no bundle needed),
// so it appears on first paint. The timeline and play-once rules are pure and unit-tested in Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TWIntro = api; api.boot(); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DURATION = 5000;
  const TAU = Math.PI * 2;
  const RADIO = { pilot: 'TOWER, TWR-001 requesting clearance.', tower: 'TWR-001, cleared for takeoff.' };
  // Four flights, one per verdict shape: [callsign, bearing (rad), radius 0..1, shape, spawn ms]
  const BLIPS = [
    ['TWR-001', 0.7, 0.3, 'ring'], ['TWR-002', 2.1, 0.5, 'diamond'], ['TWR-003', 3.6, 0.7, 'square'], ['TWR-004', 5.2, 0.86, 'triangle'],
  ].map((b, i) => [...b, 1200 + Math.round((i * 1400) / 3)]);

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  function phase(time) {
    const t = clamp(time, 0, DURATION);
    return {
      scope: ramp(t, 0, 1000),
      sweep: (t * TAU) / 2400,
      blips: t < 1200 ? 0 : Math.min(4, Math.floor(((t - 1200) * 3) / 1400) + 1),
      radio: {
        pilot: Math.floor(ramp(t, 2500, 3100) * RADIO.pilot.length),
        tower: Math.floor(ramp(t, 3150, 3700) * RADIO.tower.length),
      },
      stamp: ramp(t, 3700, 3950),
      logo: ramp(t, 3800, 4400),
      exit: ramp(t, 4500, 5000),
      done: t >= DURATION,
    };
  }

  function shouldPlay(o) {
    if (o.forced) return true;
    return !!o.enabled && !o.seen && !o.reduced && !o.deepLink;
  }
  const introEnabled = (cfg) => !(cfg && cfg.intro === false);

  // ---- browser player ------------------------------------------------------------------------
  function drawScope(ctx, w, h, t, ph) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.43, R = Math.min(w * 0.42, h * 0.34);
    const orange = (a) => `rgba(255,106,19,${a})`;
    const ease = 1 - Math.pow(1 - ph.scope, 3);
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { ctx.strokeStyle = orange(0.28 * ph.scope + (k === 4 ? 0.2 : 0)); ctx.beginPath(); ctx.arc(cx, cy, (R * k / 4) * ease, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = orange(0.14 * ph.scope);
    ctx.beginPath(); ctx.moveTo(cx, cy - R * ease); ctx.lineTo(cx, cy + R * ease); ctx.moveTo(cx - R * ease, cy); ctx.lineTo(cx + R * ease, cy); ctx.stroke();
    for (let d = 0; d < 360 * ph.scope; d += 5) { // bearing ticks draw round the rim
      const a = (d / 180) * Math.PI, major = d % 30 === 0, l = major ? 11 : 5;
      ctx.strokeStyle = orange(major ? 0.8 : 0.4);
      ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R); ctx.lineTo(cx + Math.sin(a) * (R + l), cy - Math.cos(a) * (R + l)); ctx.stroke();
    }
    const sweepOn = clamp((ph.scope - 0.7) / 0.3, 0, 1);
    if (sweepOn > 0) {
      const ang = ph.sweep - Math.PI / 2, trail = 1.1;
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(ang - trail, cx, cy);
        g.addColorStop(0, orange(0)); g.addColorStop(trail / TAU, orange(0.4 * sweepOn)); g.addColorStop(Math.min(0.999, trail / TAU + 0.0005), orange(0)); g.addColorStop(1, orange(0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = orange(0.95 * sweepOn); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke(); ctx.lineWidth = 1;
    }
    BLIPS.forEach(([code, a, r, shape, spawn], i) => {
      if (i >= ph.blips) return;
      const x = cx + Math.sin(a) * r * R, y = cy - Math.cos(a) * r * R, age = (t - spawn) / 700;
      if (age < 1) { ctx.strokeStyle = orange((1 - age) * 0.85); ctx.beginPath(); ctx.arc(x, y, 6 + age * 38, 0, TAU); ctx.stroke(); }
      const white = shape === 'ring';
      ctx.strokeStyle = ctx.fillStyle = white ? '#ffffff' : '#ff6a13'; ctx.lineWidth = 1.8; ctx.beginPath();
      if (shape === 'ring') { ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); }
      else if (shape === 'diamond') { ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.stroke(); }
      else if (shape === 'square') { ctx.rect(x - 6, y - 6, 12, 12); ctx.fill(); }
      else { ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x - 8, y + 6); ctx.closePath(); ctx.fill(); }
      ctx.lineWidth = 1; ctx.font = '500 11px "Geist Mono",ui-monospace,monospace'; ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textAlign = x > cx ? 'left' : 'right'; ctx.fillText(code, x + (x > cx ? 14 : -14), y + 4);
    });
    ctx.fillStyle = '#ff6a13'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }

  function play() {
    const doc = document;
    const el = doc.createElement('div');
    el.id = 'tw-intro';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'TOWER intro');
    el.innerHTML =
      '<canvas class="tw-intro__scope" aria-hidden="true"></canvas>' +
      '<div class="tw-intro__radio" aria-hidden="true"><p><i>PILOT ›</i> <span data-pilot></span></p><p class="is-tower"><i>TOWER ›</i> <span data-tower></span></p></div>' +
      '<div class="tw-intro__stamp" aria-hidden="true">CLEARED</div>' +
      '<img class="tw-intro__logo" src="./brand/logo-lockup.svg" alt="TOWER — Solana control tower">' +
      '<button type="button" class="tw-intro__skip">Skip <kbd>Esc</kbd></button>';
    doc.body.insertBefore(el, doc.body.firstChild);
    doc.documentElement.classList.add('tw-intro-on');

    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
    const pilot = el.querySelector('[data-pilot]'), tower = el.querySelector('[data-tower]');
    const stamp = el.querySelector('.tw-intro__stamp'), logo = el.querySelector('.tw-intro__logo');
    let w = 0, h = 0, raf = 0, ended = false;
    const fit = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    const finish = (fast) => {
      if (ended) return;
      ended = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit); doc.removeEventListener('keydown', onKey);
      const remove = () => { el.remove(); doc.documentElement.classList.remove('tw-intro-on'); };
      if (fast) { el.classList.add('is-leaving'); setTimeout(remove, 380); } else remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(true); };
    doc.addEventListener('keydown', onKey);
    el.addEventListener('click', () => finish(true));
    el.querySelector('.tw-intro__skip').focus({ preventScroll: true });

    const t0 = performance.now();
    const frame = (now) => {
      if (ended) return;
      const t = now - t0, ph = phase(t);
      if (ph.done) { finish(false); return; }
      drawScope(ctx, w, h, t, ph);
      cv.style.opacity = String(1 - ph.logo * 0.88); // the scope recedes so the logo has clear air
      pilot.textContent = RADIO.pilot.slice(0, ph.radio.pilot);
      tower.textContent = RADIO.tower.slice(0, ph.radio.tower);
      stamp.style.opacity = String(ph.stamp);
      stamp.style.transform = `translate(-50%,-50%) rotate(-4deg) scale(${1 + (1 - ph.stamp) * 0.7})`;
      logo.style.opacity = String(ph.logo);
      logo.style.transform = `translate(-50%,0) translateY(${(1 - ph.logo) * 18}px)`;
      el.style.transform = `translateY(${-ph.exit * 100}%)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function boot() {
    if (typeof document === 'undefined') return;
    let seen = false;
    try { seen = sessionStorage.getItem('tower-intro') === '1'; } catch (e) { /* storage blocked: treat as unseen */ }
    const run = shouldPlay({
      enabled: introEnabled(window.TOWER_CONFIG),
      seen,
      reduced: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      forced: /[?&]intro=1(&|$)/.test(location.search),
      deepLink: location.hash.indexOf('#case/') === 0,
    });
    if (!run) return;
    try { sessionStorage.setItem('tower-intro', '1'); } catch (e) { /* ignore */ }
    play();
  }

  return { DURATION, RADIO, BLIPS, phase, shouldPlay, introEnabled, boot };
});
