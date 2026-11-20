/* =========================================================
   Hero plotter
   A two-link planar arm draws the name (outline, then hatching), then
   hands over: it follows the pointer, and draws while you hold it down.
   Each joint is driven like a servo: a PD controller tracking the
   inverse-kinematics solution, with velocity feed-forward while plotting.
   ========================================================= */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero || !window.NAME_PATHS) return;

  const inkCv = hero.querySelector('.hero-ink'), armCv = hero.querySelector('.hero-arm');
  const ink = inkCv.getContext('2d'), arm = armCv.getContext('2d');
  const copy = hero.querySelector('.hero-copy'), panel = hero.querySelector('.hero-panel');
  const hint = hero.querySelector('[data-hint]');
  const penBtn = hero.querySelector('[data-act="pen"]');
  const out = Object.fromEntries([...hero.querySelectorAll('[data-r]')].map((el) => [el.dataset.r, el]));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const GRAPHITE = '#1D2226', SHEET = '#E7EAE4', SIGNAL = '#F4B400', PENCIL = '#5D666D';
  const TAU = Math.PI * 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const deg = (a) => (a * 180 / Math.PI);

  // ---------- geometry (set in layout) ----------
  let W = 0, H = 0, dpr = 1, narrow = false;
  let S = { x: 0, y: 0 }, L1 = 300, L2 = 260, R = 560, w1 = 24, w2 = 19, pedH = 40;
  let strokes = [];                     // the name, as plotter strokes in CSS px

  // ---------- arm state ----------
  const q = [Math.PI * 0.62, -2.4], qd = [...q], v = [0, 0];
  let target = null;                    // {x, y} in CSS px
  let mode = 'plot';                    // 'plot' | 'free'
  let penDown = false, userPen = false, penMode = false;
  let lastInk = null;

  // ---------- plotting program ----------
  let prog = null;                      // { i: stroke index, j: point index, t: 0..1 along segment, phase }

  function layout() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    narrow = W < 860;
    for (const cv of [inkCv, armCv]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ink.setTransform(dpr, 0, 0, dpr, 0, 0);
    arm.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- place the name ---
    const N = window.NAME_PATHS, A = N.words.Ali, K = N.words.Sakhaei, cap = N.cap;
    const capTop = Math.max(92, H * (narrow ? 0.14 : 0.17));
    const placed = [];
    let em;
    if (!narrow) {
      const total = A.w + N.space + K.w;
      em = Math.min((W * 0.86) / total, (H * 0.27) / cap);
      const x0 = (W - total * em) / 2, base = capTop + cap * em;
      placed.push({ wd: A, x: x0, y: base }, { wd: K, x: x0 + (A.w + N.space) * em, y: base });
    } else {
      em = Math.min((W * 0.9) / K.w, (H * 0.17) / cap);
      const x0 = (W - K.w * em) / 2, b1 = capTop + cap * em, b2 = b1 + cap * em * 1.3;
      placed.push({ wd: A, x: x0, y: b1 }, { wd: K, x: x0, y: b2 });
      const copyTop = b2 + Math.max(26, em * 0.42);
      copy.style.top = `${copyTop}px`;
      panel.style.top = `${copyTop + copy.offsetHeight + 10}px`;
      panel.style.bottom = 'auto';
    }
    if (!narrow) { copy.style.top = ''; panel.style.top = ''; panel.style.bottom = ''; }

    // hatching: keep the lines at least ~6px apart on screen
    const step = Math.max(1, Math.ceil(6 / (0.024 * em)));
    strokes = [];
    for (const p of placed) {
      const T = ([x, y]) => [p.x + x * em, p.y + y * em];
      p.wd.outline.forEach((c) => strokes.push({ pts: c.map(T), kind: 'o' }));
      let k = 0;
      p.wd.hatch.forEach((line, li) => {
        if (li % step) return;
        let segs = line.map((s) => s.map(T));
        if (k++ % 2) segs = segs.reverse().map((s) => [s[1], s[0]]);
        segs.forEach((s) => strokes.push({ pts: s, kind: 'h' }));
      });
    }

    // --- size the arm so it reaches every point of the name ---
    pedH = narrow ? 34 : 46;
    S = { x: narrow ? W * 0.5 : W * 0.5, y: H - pedH };
    let far = 0;
    for (const s of strokes) for (const [x, y] of s.pts) far = Math.max(far, Math.hypot(x - S.x, y - S.y));
    R = far * 1.04;
    L1 = R * 0.54; L2 = R * 0.46;
    w1 = clamp(R * 0.04, 14, 30); w2 = w1 * 0.78;

    // plotting speeds: whole name in about 6.5 s (less on small screens)
    let Lo = 0, Lh = 0, Lt = 0, prev = null;
    for (const s of strokes) {
      if (prev) Lt += Math.hypot(s.pts[0][0] - prev[0], s.pts[0][1] - prev[1]);
      for (let i = 1; i < s.pts.length; i++) {
        const d = Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
        if (s.kind === 'o') Lo += d; else Lh += d;
      }
      prev = s.pts[s.pts.length - 1];
    }
    const dur = narrow ? 5.5 : 6.5;
    const k = (Lo / 1 + Lh / 1.9 + Lt / 2.6) / dur;
    speeds = { o: k, h: k * 1.9, t: k * 2.6 };
  }
  let speeds = { o: 600, h: 1100, t: 1500 };

  // ---------- kinematics ----------
  function ik(tx, ty, cur) {
    const dx = tx - S.x, dy = S.y - ty;
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 0.5);
    const c2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const ang = Math.atan2(dy, dx);
    let best = null, bestCost = Infinity;
    for (const s of [1, -1]) {
      const b = s * Math.acos(c2);
      const a = ang - Math.atan2(L2 * Math.sin(b), L1 + L2 * Math.cos(b));
      const cost = Math.abs(wrap(a - cur[0])) + Math.abs(b - cur[1]);
      if (cost < bestCost) { bestCost = cost; best = [cur[0] + wrap(a - cur[0]), b]; }
    }
    return best;
  }
  const fk = (a) => {
    const e = { x: S.x + L1 * Math.cos(a[0]), y: S.y - L1 * Math.sin(a[0]) };
    return { e, t: { x: e.x + L2 * Math.cos(a[0] + a[1]), y: e.y - L2 * Math.sin(a[0] + a[1]) } };
  };

  // ---------- program stepping ----------
  function startPlot(instant = false) {
    ink.clearRect(0, 0, W, H);
    mode = 'plot';
    prog = { i: 0, j: 0, travel: true, wait: 0 };
    penDown = false; lastInk = null;
    setHint();
    if (instant || reduce) finishPlot();
    wake();
  }

  function finishPlot() {
    if (!prog) return;
    // draw whatever is left straight onto the sheet
    for (let i = prog.i; i < strokes.length; i++) {
      const s = strokes[i], from = i === prog.i ? Math.max(0, prog.travel ? 0 : prog.j) : 0;
      inkStyle(s.kind);
      ink.beginPath();
      if (i === prog.i && !prog.travel && lastInk) ink.moveTo(lastInk.x, lastInk.y); else ink.moveTo(...s.pts[from]);
      for (let k = from; k < s.pts.length; k++) ink.lineTo(...s.pts[k]);
      ink.stroke();
    }
    prog = null; mode = 'free'; penDown = false; lastInk = null;
    v[0] = v[1] = 0; qd[0] = q[0]; qd[1] = q[1];
    if (strokes.length) { const t = fk(q).t; target = { x: t.x, y: t.y }; }
    setHint();
  }

  function inkStyle(kind) {
    ink.strokeStyle = GRAPHITE; ink.lineCap = 'round'; ink.lineJoin = 'round';
    ink.lineWidth = kind === 'o' ? 1.7 : kind === 'h' ? 1 : 2.2;
    ink.globalAlpha = kind === 'h' ? 0.8 : 1;
  }

  // Moves the program's target along the strokes by `dist` px of pen travel.
  function advance(dt) {
    const tip = fk(q).t;
    const s = strokes[prog.i];
    if (!s) { finishPlot(); return; }
    if (prog.travel) {
      // pen up, head for the start of the stroke
      const [sx, sy] = s.pts[0];
      const dx = sx - target.x, dy = sy - target.y, d = Math.hypot(dx, dy), step = speeds.t * dt;
      if (d > step) { target.x += dx / d * step; target.y += dy / d * step; return; }
      target.x = sx; target.y = sy;
      // lower the pen once the arm has actually arrived
      if (Math.hypot(tip.x - sx, tip.y - sy) < 1.2 || (prog.wait += dt) > 0.12) {
        prog.travel = false; prog.j = 1; prog.wait = 0; penDown = true; lastInk = { x: tip.x, y: tip.y };
      }
      return;
    }
    let budget = (s.kind === 'o' ? speeds.o : speeds.h) * dt;
    while (budget > 0 && prog.j < s.pts.length) {
      const [px, py] = s.pts[prog.j];
      const dx = px - target.x, dy = py - target.y, d = Math.hypot(dx, dy);
      if (d <= budget) { target.x = px; target.y = py; budget -= d; prog.j++; }
      else { target.x += dx / d * budget; target.y += dy / d * budget; budget = 0; }
    }
    if (prog.j >= s.pts.length) {
      penDown = false; lastInk = null; prog.i++; prog.travel = true;
      if (prog.i >= strokes.length) { finishPlot(); park(); }
    }
  }

  // On phones the finished arm swings out of the way of the text, into the empty
  // space at the bottom of the sheet (the servo does the move, so it settles naturally).
  function park() {
    if (!narrow) return;
    const pb = panel.offsetTop + panel.offsetHeight;
    target = { x: W * 0.8, y: pb + (H - pb) * 0.55 };
    wake();
  }

  // ---------- simulation loop ----------
  let raf = 0, visible = true, frame = 0, still = 0;
  function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  let last = 0;

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const plotting = mode === 'plot' && prog;

    if (plotting) {
      // Plotting: the servo is stiff enough to count as exact, so step the
      // program in small slices and put the joints on the IK solution.
      const n = 8, h = dt / n;
      for (let s = 0; s < n && prog; s++) {
        advance(h);
        if (!prog) break;
        const sol = ik(target.x, target.y, q);
        v[0] = (sol[0] - q[0]) / h; v[1] = (sol[1] - q[1]) / h;
        q[0] = sol[0]; q[1] = sol[1];
        qd[0] = q[0]; qd[1] = q[1];
        if (penDown) {
          const t = fk(q).t;
          if (lastInk) { inkStyle(strokes[prog.i]?.kind || 'o'); ink.beginPath(); ink.moveTo(lastInk.x, lastInk.y); ink.lineTo(t.x, t.y); ink.stroke(); }
          lastInk = { x: t.x, y: t.y };
        }
      }
    } else {
      // Steering: each joint is a PD-controlled servo chasing the IK solution.
      if (target) { const sol = ik(target.x, target.y, qd); qd[0] = sol[0]; qd[1] = sol[1]; }
      const wn = reduce ? 22 : 9, kp = wn * wn, kd = 2 * wn;
      const n = 4, h = dt / n;
      for (let s = 0; s < n; s++) {
        for (let i = 0; i < 2; i++) { v[i] += (kp * (qd[i] - q[i]) - kd * v[i]) * h; q[i] += v[i] * h; }
        if (userPen) {
          const t = fk(q).t;
          if (lastInk) { inkStyle('u'); ink.beginPath(); ink.moveTo(lastInk.x, lastInk.y); ink.lineTo(t.x, t.y); ink.stroke(); }
          lastInk = { x: t.x, y: t.y };
        }
      }
      if (!userPen) lastInk = null;
    }

    drawArm();
    if (++frame % 4 === 0) readout();

    const moving = Math.abs(v[0]) + Math.abs(v[1]) > 1e-4 || Math.abs(qd[0] - q[0]) + Math.abs(qd[1] - q[1]) > 1e-4;
    still = moving ? 0 : still + 1;
    if (mode === 'plot' || userPen || still < 3) raf = requestAnimationFrame(tick);
    else readout();
  }

  // ---------- drawing the arm ----------
  function capsule(c, x, y, ang, len, w) {
    c.save(); c.translate(x, y); c.rotate(-ang);
    c.beginPath(); c.roundRect(-w / 2, -w / 2, len + w, w, w / 2);
    c.fillStyle = SHEET; c.fill(); c.stroke();
    c.setLineDash([5, 5]); c.globalAlpha = 0.4; c.lineWidth = 1;
    c.beginPath(); c.moveTo(w * 0.9, 0); c.lineTo(len - w * 0.9, 0); c.stroke();
    c.restore();
  }
  function joint(c, x, y, r, rot) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = SIGNAL; c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y, r * 0.34, 0, TAU); c.fillStyle = GRAPHITE; c.fill();
    c.beginPath(); c.moveTo(x + Math.cos(-rot) * r * 0.5, y + Math.sin(-rot) * r * 0.5);
    c.lineTo(x + Math.cos(-rot) * r * 0.86, y + Math.sin(-rot) * r * 0.86); c.stroke();
  }
  function label(c, text, x, y) {
    c.font = '600 13px Archivo, system-ui, sans-serif';
    if ('fontStretch' in c) c.fontStretch = 'condensed';
    const m = c.measureText(text).width;
    c.fillStyle = 'rgba(231,234,228,.88)'; c.fillRect(x - 4, y - 11, m + 8, 16);
    c.fillStyle = GRAPHITE; c.fillText(text, x, y + 1);
  }
  function angleMark(c, x, y, r, a0, a1, text) {
    c.save(); c.globalAlpha = 0.55; c.lineWidth = 1; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(x, y, r, -a0, -a1, a1 > a0); c.stroke(); c.restore();
    const am = (a0 + a1) / 2;
    label(c, text, x + Math.cos(am) * (r + 10) - (Math.cos(am) < 0 ? 64 : 0), y - Math.sin(am) * (r + 10));
  }

  function drawArm() {
    const c = arm;
    c.clearRect(0, 0, W, H);
    const { e, t } = fk(q);
    c.lineWidth = 1.5; c.strokeStyle = GRAPHITE; c.lineJoin = 'round';

    // pedestal and floor line
    const pw = w1 * 1.9;
    c.beginPath(); c.moveTo(S.x - pw * 1.25, H); c.lineTo(S.x - pw * 0.62, S.y); c.lineTo(S.x + pw * 0.62, S.y); c.lineTo(S.x + pw * 1.25, H); c.closePath();
    c.fillStyle = SHEET; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(S.x - pw * 2.4, H - 0.75); c.lineTo(S.x + pw * 2.4, H - 0.75); c.stroke();
    for (const k of [-0.8, 0.8]) { c.beginPath(); c.arc(S.x + pw * k, H - pedH * 0.32, 2.2, 0, TAU); c.fillStyle = GRAPHITE; c.fill(); }

    // angle annotations (only where there's room)
    if (!narrow) {
      c.save(); c.globalAlpha = 0.5; c.lineWidth = 1; c.setLineDash([6, 5]);
      c.beginPath(); c.moveTo(S.x, S.y); c.lineTo(S.x + L1 * 0.36, S.y); c.stroke();
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + Math.cos(q[0]) * L2 * 0.3, e.y - Math.sin(q[0]) * L2 * 0.3); c.stroke();
      c.restore();
      angleMark(c, S.x, S.y, L1 * 0.27, 0, q[0], `θ1 ${deg(wrap(q[0])).toFixed(1)}°`);
      angleMark(c, e.x, e.y, L2 * 0.22, q[0], q[0] + q[1], `θ2 ${deg(q[1]).toFixed(1)}°`);
    }

    capsule(c, S.x, S.y, q[0], L1, w1);
    capsule(c, e.x, e.y, q[0] + q[1], L2, w2);
    joint(c, e.x, e.y, w1 * 0.52, q[0] + q[1]);
    joint(c, S.x, S.y, w1 * 0.66, q[0]);

    // pen carriage
    const pen = mode === 'plot' ? penDown : userPen;
    c.beginPath(); c.arc(t.x, t.y, w2 * 0.46, 0, TAU); c.fillStyle = SHEET; c.fill(); c.stroke();
    c.beginPath(); c.arc(t.x, t.y, pen ? 3 : 4, 0, TAU);
    c.fillStyle = pen ? GRAPHITE : SIGNAL; c.fill(); if (!pen) c.stroke();
  }

  function readout() {
    const { t } = fk(q);
    out.t1.textContent = `${deg(wrap(q[0])).toFixed(1)}°`;
    out.t2.textContent = `${deg(q[1]).toFixed(1)}°`;
    out.xy.textContent = `${Math.round(t.x - S.x)}, ${Math.round(S.y - t.y)} px`;
    out.pen.textContent = (mode === 'plot' ? penDown : userPen) ? 'down' : 'up';
  }

  function setHint() {
    if (mode === 'plot') hint.textContent = coarse ? 'The arm is drawing my name. Tap to skip.' : 'The arm is drawing my name. Click to skip.';
    else if (coarse) hint.textContent = penMode ? 'Pen is on: drag on the sheet to draw. Turn it off to scroll.' : 'Your turn. Tap to move the arm, or turn on the pen to draw.';
    else hint.textContent = 'Your turn. Move to steer the arm, hold the button to draw.';
    penBtn.hidden = !(coarse && mode === 'free');
  }

  // ---------- input ----------
  const local = (e) => { const r = hero.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onUi = (e) => e.target.closest('a, button, input, label');

  hero.addEventListener('pointermove', (e) => {
    if (mode !== 'free') return;
    if (e.pointerType !== 'mouse' && !userPen) return;
    target = local(e); wake();
  });
  hero.addEventListener('pointerdown', (e) => {
    if (onUi(e) || e.button > 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();   // drawing shouldn't select the text
    if (mode === 'plot') { finishPlot(); }
    target = local(e);
    if (e.pointerType === 'mouse' || penMode) {
      userPen = true; lastInk = null;
      try { hero.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    wake();
  });
  const lift = () => { userPen = false; lastInk = null; wake(); };
  hero.addEventListener('pointerup', lift);
  hero.addEventListener('pointercancel', lift);

  hero.querySelector('[data-act="replot"]').addEventListener('click', () => startPlot());
  hero.querySelector('[data-act="clear"]').addEventListener('click', () => { finishPlot(); ink.clearRect(0, 0, W, H); });
  penBtn.addEventListener('click', () => {
    penMode = !penMode;
    penBtn.setAttribute('aria-pressed', String(penMode));
    hero.classList.toggle('is-drawing', penMode);
    setHint();
  });

  // ---------- boot ----------
  let lastW = 0, lastH = 0;
  function onResize() {
    const r = hero.getBoundingClientRect();
    if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 120) return;
    lastW = r.width; lastH = r.height;
    const wasPlotting = mode === 'plot';
    layout();
    if (wasPlotting) { startPlot(); return; }
    // keep the name on the sheet: redraw it straight away at the new size
    ink.clearRect(0, 0, W, H);
    prog = { i: 0, j: 0, travel: true }; finishPlot();
    const rest = fk(q).t; target = { x: rest.x, y: rest.y };
    drawArm(); readout();
  }

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(hero);

  const go = () => {
    lastW = hero.getBoundingClientRect().width; lastH = hero.getBoundingClientRect().height;
    layout();
    const rest = fk(q).t; target = { x: rest.x, y: rest.y };
    new ResizeObserver(() => onResize()).observe(hero);
    startPlot();
  };
  // wait for the webfont so the arm's labels don't jump; never longer than a moment
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))]).then(go);
})();
