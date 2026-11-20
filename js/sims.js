/* =========================================================
   Project models
   Six small simulations, one per project. Each runs only while it is on
   screen, and the ones with nothing moving don't run at all.
   ========================================================= */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const C = { ink: '#1D2226', pencil: '#5D666D', sheet: '#E7EAE4', sheet2: '#DCE0D9', signal: '#F4B400', rule: 'rgba(29,34,38,.16)', faint: 'rgba(29,34,38,.07)' };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- shared drawing helpers ----------
  function text(c, s, x, y, { size = 13, color = C.pencil, align = 'left', weight = 600, bg = false } = {}) {
    c.font = `${weight} ${size}px Archivo, system-ui, sans-serif`;
    if ('fontStretch' in c) c.fontStretch = 'condensed';
    c.textAlign = align; c.textBaseline = 'middle';
    if (bg) {
      const w = c.measureText(s).width, x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      c.fillStyle = 'rgba(231,234,228,.9)'; c.fillRect(x0 - 3, y - size * 0.62, w + 6, size * 1.24);
    }
    c.fillStyle = color; c.fillText(s, x, y);
    c.textAlign = 'left';
  }
  function arrow(c, x0, y0, x1, y1, head = 7) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.beginPath(); c.moveTo(x1, y1);
    c.lineTo(x1 - head * Math.cos(a - 0.38), y1 - head * Math.sin(a - 0.38));
    c.lineTo(x1 - head * Math.cos(a + 0.38), y1 - head * Math.sin(a + 0.38)); c.closePath();
    c.fillStyle = c.strokeStyle; c.fill();
  }
  function wallHatch(c, pts, side, len = 7, gap = 9) {
    // short diagonal ticks along a wall, on its outer side (drafting convention)
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const d = Math.hypot(x1 - x0, y1 - y0); acc += d;
      while (acc > gap) {
        acc -= gap;
        const t = 1 - acc / d, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + len * 0.7, y + side * len); c.stroke();
      }
    }
  }

  // ---------- harness ----------
  function mount(el, def) {
    const cv = el.querySelector('canvas'), c = cv.getContext('2d'), readEl = el.querySelector('[data-read]');
    const api = { c, cv, W: 0, H: 0, s: { ...def.state }, dirty: true, wake, t: 0 };
    let raf = 0, visible = false, last = 0, readStr = '';

    api.read = (rows) => {
      const s = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      if (s !== readStr) { readStr = s; readEl.innerHTML = s; }
    };
    function size() {
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
      api.W = r.width; api.H = r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      def.resize && def.resize(api);
      api.dirty = true; wake();
    }
    function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    let skip = false;
    function tick(now) {
      raf = 0;
      // phones: ambient motion at 30 fps (every other frame); input still feels instant
      if (coarse && !api.dirty && (skip = !skip)) { raf = requestAnimationFrame(tick); return; }
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      api.t += dt;
      const animating = def.frame(api, reduce ? 0 : dt);
      api.dirty = false;
      if (visible && animating && !reduce) raf = requestAnimationFrame(tick);
    }

    // controls
    el.querySelectorAll('[data-in]').forEach((inp) => {
      const k = inp.dataset.in, o = el.querySelector(`[data-out="${k}"]`);
      const upd = () => {
        api.s[k] = parseFloat(inp.value);
        if (o && def.fmt && def.fmt[k]) o.textContent = def.fmt[k](api.s[k]);
        def.change && def.change(api, k);
        api.dirty = true; wake();
      };
      inp.addEventListener('input', upd); upd();
    });
    el.querySelectorAll('[data-toggle]').forEach((b) => {
      const k = b.dataset.toggle;
      api.s[k] = b.getAttribute('aria-pressed') === 'true';
      b.addEventListener('click', () => {
        api.s[k] = !api.s[k]; b.setAttribute('aria-pressed', String(api.s[k]));
        def.change && def.change(api, k); api.dirty = true; wake();
      });
    });
    el.querySelectorAll('[data-set]').forEach((b) => {
      const k = b.dataset.set;
      if (b.getAttribute('aria-pressed') === 'true') api.s[k] = parseFloat(b.dataset.val);
      b.addEventListener('click', () => {
        api.s[k] = parseFloat(b.dataset.val);
        el.querySelectorAll(`[data-set="${k}"]`).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
        def.change && def.change(api, k); api.dirty = true; wake();
      });
    });
    def.pointer && def.pointer(api);

    new ResizeObserver(size).observe(cv);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { rootMargin: '0px' }).observe(cv);
  }

  // =========================================================
  // 1. Airfoil — Joukowski airfoil, potential flow with the Kutta condition
  // =========================================================
  const cx = (a, b) => [a, b];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const csqrt = (a) => { const r = Math.hypot(a[0], a[1]); const re = Math.sqrt((r + a[0]) / 2), im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [re, im]; };
  const MU = [-0.09, 0.075], RC = Math.hypot(1 - MU[0], MU[1]), BETA = Math.atan2(MU[1], 1 - MU[0]);

  const airfoil = {
    state: { aoa: 6 },
    fmt: { aoa: (v) => `${v}°` },
    resize(a) {
      a.sc = Math.min(a.W / 5.2, a.H / 3.3);
      a.ox = a.W * 0.5; a.oy = a.H * 0.53;
      a.n = coarse ? 110 : 240;
      a.parts = Array.from({ length: a.n }, () => this.spawn(a, true));
      this.change(a);
    },
    spawn(a, anywhere) {
      const hw = a.W / a.sc / 2, hh = a.H / a.sc / 2;
      return { x: anywhere ? (Math.random() * 2 - 1) * hw : -hw - Math.random() * 0.3, y: (Math.random() * 2 - 1) * hh };
    },
    // velocity (u, v) at z, or null inside the body
    vel(a, x, y) {
      const z = [x, y];
      const r = csqrt([z[0] * z[0] - z[1] * z[1] - 4, 2 * z[0] * z[1]]);
      let zeta = [(z[0] + r[0]) / 2, (z[1] + r[1]) / 2];
      const alt = [(z[0] - r[0]) / 2, (z[1] - r[1]) / 2];
      if (Math.hypot(alt[0] - MU[0], alt[1] - MU[1]) > Math.hypot(zeta[0] - MU[0], zeta[1] - MU[1])) zeta = alt;
      const zp = [zeta[0] - MU[0], zeta[1] - MU[1]];
      if (Math.hypot(zp[0], zp[1]) < RC * 1.002) return null;
      const al = a.al, ea = [Math.cos(al), Math.sin(al)], ema = [Math.cos(al), -Math.sin(al)];
      const zp2 = cmul(zp, zp);
      let dw = [ema[0], ema[1]];
      const t2 = cdiv([RC * RC * ea[0], RC * RC * ea[1]], zp2);
      dw = [dw[0] - t2[0], dw[1] - t2[1]];
      const t3 = cdiv([0, a.G / TAU], zp);
      dw = [dw[0] + t3[0], dw[1] + t3[1]];
      const dz = [1 - cdiv([1, 0], cmul(zeta, zeta))[0], -cdiv([1, 0], cmul(zeta, zeta))[1]];
      const w = cdiv(dw, dz);
      let u = w[0], v = -w[1];
      const sp = Math.hypot(u, v);
      if (sp > 3) { u *= 3 / sp; v *= 3 / sp; }
      return [u, v];
    },
    change(a) {
      a.al = a.s.aoa * Math.PI / 180;
      if (!a.W) return;
      a.G = 4 * Math.PI * RC * Math.sin(a.al + BETA);
      // airfoil outline
      a.body = [];
      for (let i = 0; i <= 160; i++) {
        const th = (i / 160) * TAU, zeta = [MU[0] + RC * Math.cos(th), MU[1] + RC * Math.sin(th)];
        const inv = cdiv([1, 0], zeta);
        a.body.push([zeta[0] + inv[0], zeta[1] + inv[1]]);
      }
      // a few streamlines, traced once per change
      const hh = a.H / a.sc / 2, hw = a.W / a.sc / 2;
      a.lines = [];
      for (let k = -7; k <= 7; k++) {
        let x = -hw - 0.1, y = k * hh / 7.5 + Math.tan(a.al) * 0;
        const pts = [[x, y]];
        for (let i = 0; i < 700 && x < hw + 0.1; i++) {
          const v1 = this.vel(a, x, y); if (!v1) break;
          const h = 0.025 / Math.max(0.3, Math.hypot(v1[0], v1[1]));
          const v2 = this.vel(a, x + v1[0] * h / 2, y + v1[1] * h / 2); if (!v2) break;
          x += v2[0] * h; y += v2[1] * h; pts.push([x, y]);
        }
        a.lines.push(pts);
      }
    },
    frame(a, dt) {
      const c = a.c, X = (x) => a.ox + x * a.sc, Y = (y) => a.oy - y * a.sc;
      c.clearRect(0, 0, a.W, a.H);
      c.lineWidth = 1; c.strokeStyle = C.rule;
      for (const l of a.lines) { c.beginPath(); l.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); }

      // particles as short streaks (length ~ local speed)
      const hw = a.W / a.sc / 2;
      c.strokeStyle = C.ink; c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < a.parts.length; i++) {
        const p = a.parts[i];
        const v = this.vel(a, p.x, p.y);
        if (!v || p.x > hw + 0.2) { a.parts[i] = this.spawn(a, false); continue; }
        p.x += v[0] * dt * 0.9; p.y += v[1] * dt * 0.9;
        c.moveTo(X(p.x), Y(p.y)); c.lineTo(X(p.x - v[0] * 0.07), Y(p.y - v[1] * 0.07));
      }
      c.stroke();

      // body
      c.beginPath(); a.body.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath();
      c.fillStyle = C.signal; c.fill(); c.lineWidth = 1.5; c.strokeStyle = C.ink; c.stroke();
      // chord line + angle
      c.save(); c.setLineDash([4, 4]); c.lineWidth = 1; c.strokeStyle = C.pencil;
      c.beginPath(); c.moveTo(X(-2.05), Y(0)); c.lineTo(X(2.2), Y(0)); c.stroke(); c.restore();
      c.strokeStyle = C.ink; c.lineWidth = 1.2;
      arrow(c, X(-2.5), Y(0) + Math.tan(a.al) * 0.5 * a.sc, X(-2.0), Y(0), 6);
      text(c, 'free stream', X(-2.55), Y(0) + Math.tan(a.al) * 0.5 * a.sc + 14, { size: 12 });

      const cl = 2 * Math.PI * RC * Math.sin(a.al + BETA);
      a.read([['Lift coefficient', cl.toFixed(2)], ['Circulation', a.G.toFixed(2)], ['Note', a.s.aoa > 11 ? 'a real wing would be near stall' : 'potential flow, no viscosity']]);
      return true;
    },
  };

  // =========================================================
  // 2. Pump — crank-slider driven by a drooping motor, with or without flywheel
  // =========================================================
  const pump = {
    state: { rpm: 100, flywheel: false },
    resize(a) {
      a.hist = a.hist || [];
      if (a.th === undefined) { a.th = 0; a.w = 100 * TAU / 60; }
    },
    change(a, k) { if (k === 'rpm') a.hist = []; },
    // load torque on the crank (normalised): big on the delivery stroke, small on suction
    load(th) {
      const r = 1, l = 3.2, s = Math.sin(th), co = Math.cos(th);
      const dx = -r * s - (r * r * s * co) / Math.sqrt(l * l - r * r * s * s); // dx/dθ
      return dx < 0 ? -dx * 1.0 : dx * 0.12;
    },
    frame(a, dt) {
      const s = a.s, wset = s.rpm * TAU / 60, J = s.flywheel ? 0.2 : 0.022, Tm = (1.0 + 0.12) / Math.PI, K = 0.06;
      // simulate in slow motion so the 300 rpm case stays readable
      const T = dt * 0.5, n = Math.max(1, Math.ceil(T / 0.0005)), h = T / n;
      for (let i = 0; i < n; i++) {
        const tq = Tm + K * (wset - a.w) - this.load(a.th);
        a.w += (tq / J) * h; a.th += a.w * h;
      }
      a.hist.push(a.w / wset); if (a.hist.length > 420) a.hist.shift();

      const c = a.c, W = a.W, H = a.H;
      c.clearRect(0, 0, W, H);
      c.lineWidth = 1.5; c.strokeStyle = C.ink; c.lineJoin = 'round';
      const sc = Math.min(W / 7.4, H / 4.4), Cx = W * 0.2, Cy = H * 0.36, r = sc * 0.82, l = r * 3.2;
      const th = -a.th;                                       // screen: clockwise looks right
      const px = Cx + r * Math.cos(th) + Math.sqrt(l * l - (r * Math.sin(th)) ** 2), py = Cy;
      const ex = Cx + r * Math.cos(th), ey = Cy + r * Math.sin(th);

      // flywheel / crank disc
      const fr = s.flywheel ? r * 1.65 : r * 1.18;
      c.beginPath(); c.arc(Cx, Cy, fr, 0, TAU); c.fillStyle = s.flywheel ? C.signal : C.sheet; c.fill(); c.stroke();
      if (s.flywheel) {
        c.beginPath(); c.arc(Cx, Cy, fr * 0.78, 0, TAU); c.stroke();
        for (let k = 0; k < 5; k++) { const q = th + k * TAU / 5; c.beginPath(); c.moveTo(Cx + Math.cos(q) * r * 0.25, Cy + Math.sin(q) * r * 0.25); c.lineTo(Cx + Math.cos(q) * fr * 0.78, Cy + Math.sin(q) * fr * 0.78); c.stroke(); }
      }
      // cylinder
      const pw = sc * 0.5, cyl0 = Cx + l - r - pw * 0.5 - 6, cyl1 = Cx + l + r + pw * 0.5 + sc * 0.5, ch = sc * 0.62;
      c.fillStyle = C.sheet2; c.fillRect(cyl0, Cy - ch, cyl1 - cyl0, ch * 2);
      c.beginPath(); c.moveTo(cyl0, Cy - ch); c.lineTo(cyl1, Cy - ch); c.lineTo(cyl1, Cy + ch); c.lineTo(cyl0, Cy + ch); c.stroke();
      c.fillStyle = C.sheet; c.fillRect(cyl1 - sc * 0.08, Cy - ch, sc * 0.08, ch * 2);
      c.save(); c.lineWidth = 1; c.strokeStyle = C.pencil;
      wallHatch(c, [[cyl0, Cy - ch], [cyl1, Cy - ch]], -1, 6, 8); wallHatch(c, [[cyl0, Cy + ch], [cyl1, Cy + ch]], 1, 6, 8); c.restore();
      // valves at the head: delivery opens on the way in
      const delivering = Math.sin(th) < 0 === (a.w > 0) ? false : true;
      const vx = cyl1, open = this.load(a.th) > 0.2;
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(vx, Cy - ch * 0.5); c.lineTo(vx + sc * 0.5, Cy - ch * 0.5); c.moveTo(vx, Cy + ch * 0.5); c.lineTo(vx + sc * 0.5, Cy + ch * 0.5); c.stroke();
      c.strokeStyle = C.ink; c.lineWidth = 1.2;
      if (open) arrow(c, vx + 4, Cy - ch * 0.75, vx + sc * 0.62, Cy - ch * 0.75, 6);
      else arrow(c, vx + sc * 0.62, Cy + ch * 0.75, vx + 4, Cy + ch * 0.75, 6);
      text(c, open ? 'delivery' : 'suction', vx + sc * 0.66, open ? Cy - ch * 0.75 : Cy + ch * 0.75, { size: 12 });
      void delivering;
      // piston + rod
      c.lineWidth = 1.5;
      c.fillStyle = C.sheet; c.fillRect(px - pw / 2, Cy - ch + 2, pw, ch * 2 - 4); c.strokeRect(px - pw / 2, Cy - ch + 2, pw, ch * 2 - 4);
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(px, py); c.lineWidth = sc * 0.16; c.strokeStyle = C.ink; c.stroke();
      c.lineWidth = sc * 0.16 - 3; c.strokeStyle = C.sheet; c.stroke();
      c.lineWidth = 1.5; c.strokeStyle = C.ink;
      c.beginPath(); c.moveTo(Cx, Cy); c.lineTo(ex, ey); c.lineWidth = sc * 0.2; c.stroke(); c.lineWidth = 1.5;
      for (const [x, y, rr] of [[Cx, Cy, sc * 0.16], [ex, ey, sc * 0.1], [px, py, sc * 0.1]]) { c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fillStyle = C.sheet; c.fill(); c.stroke(); }

      // speed trace
      const gx0 = W * 0.06, gx1 = W * 0.94, gy0 = H * 0.76, gy1 = H * 0.95, mid = (gy0 + gy1) / 2, span = (gy1 - gy0) / 2;
      c.lineWidth = 1; c.strokeStyle = C.rule;
      c.beginPath(); c.moveTo(gx0, mid); c.lineTo(gx1, mid); c.stroke();
      c.strokeStyle = C.ink; c.lineWidth = 1.5; c.beginPath();
      const hs = a.hist, nn = hs.length;
      for (let i = 0; i < nn; i++) {
        const x = gx1 - (nn - 1 - i) * ((gx1 - gx0) / 420), y = mid - clamp((hs[i] - 1) / 0.35, -1, 1) * span;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      text(c, 'crank speed vs set speed (±35%)', gx0, gy0 - 8, { size: 12 });

      let lo = Infinity, hi = -Infinity;
      for (let i = Math.max(0, nn - 200); i < nn; i++) { lo = Math.min(lo, hs[i]); hi = Math.max(hi, hs[i]); }
      const rip = nn > 50 ? ((hi - lo) / 2 * 100) : 0;
      a.read([['Crank speed', `${Math.round(a.w * 60 / TAU)} rpm`], ['Speed ripple', `±${rip.toFixed(1)}%`], ['Playback', 'half speed']]);
      return true;
    },
  };

  // =========================================================
  // 3. DC motor — PI speed loop, armature voltage limit (no anti-windup)
  // =========================================================
  const motor = {
    state: { kp: 2, ki: 18, sat: true },
    fmt: { kp: (v) => v.toFixed(1), ki: (v) => String(Math.round(v)) },
    sim(s, closed) {
      const R = 1, Lm = 0.05, K = 0.5, J = 0.02, b = 0.01, Vss = (R * b + K * K) / K, Vmax = Vss * 2.2;
      const dt = 0.0005, T = 1.2, out = [], volt = [];
      let i = 0, w = 0, I = 0;
      for (let t = 0; t <= T; t += dt) {
        const e = 1 - w;
        let V;
        if (closed) { I += e * dt; V = s.kp * e + s.ki * I; } else V = Vss;
        if (s.sat) V = clamp(V, -Vmax, Vmax);
        i += ((V - R * i - K * w) / Lm) * dt;
        w += ((K * i - b * w) / J) * dt;
        out.push(w); volt.push(V / Vss);
      }
      return { out, volt, dt, T, Vlim: Vmax / Vss };
    },
    change(a) { a.cl = this.sim(a.s, true); a.ol = this.sim(a.s, false); a.sweep = 0; },
    resize(a) { if (!a.cl) this.change(a); },
    frame(a, dt) {
      const c = a.c, W = a.W, H = a.H, { cl, ol } = a;
      a.sweep = Math.min(1, (a.sweep || 0) + (reduce ? 1 : dt / 0.7));
      c.clearRect(0, 0, W, H);
      const x0 = W * 0.08, x1 = W * 0.96, y0 = H * 0.2, y1 = H * 0.66, ymax = 1.6;
      const X = (t) => x0 + (t / cl.T) * (x1 - x0), Y = (v) => y1 - (v / ymax) * (y1 - y0);
      // axes and grid
      c.lineWidth = 1; c.strokeStyle = C.rule;
      for (let v = 0.5; v <= 1.5; v += 0.5) { c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke(); }
      for (let t = 0.2; t < cl.T; t += 0.2) { c.beginPath(); c.moveTo(X(t), y0); c.lineTo(X(t), y1); c.stroke(); text(c, `${t.toFixed(1)} s`, X(t), y1 + 12, { size: 11, align: 'center' }); }
      c.strokeStyle = C.ink; c.beginPath(); c.moveTo(x0, y0 - 6); c.lineTo(x0, y1); c.lineTo(x1, y1); c.stroke();
      const n = Math.floor(cl.out.length * a.sweep);
      c.save(); c.beginPath(); c.rect(x0, y0 - 8, x1 - x0, y1 - y0 + 8); c.clip();
      // error area
      c.beginPath(); c.moveTo(X(0), Y(1));
      for (let i = 0; i < n; i += 4) c.lineTo(X(i * cl.dt), Y(cl.out[i]));
      c.lineTo(X((n - 1) * cl.dt), Y(1)); c.closePath();
      c.fillStyle = 'rgba(244,180,0,.45)'; c.fill();
      // reference, open loop, closed loop
      c.save(); c.setLineDash([5, 4]); c.lineWidth = 1.2; c.strokeStyle = C.ink;
      c.beginPath(); c.moveTo(X(0), Y(1)); c.lineTo(x1, Y(1)); c.stroke();
      c.strokeStyle = C.pencil; c.setLineDash([2, 4]); c.beginPath();
      for (let i = 0; i < n; i += 4) (i ? c.lineTo(X(i * ol.dt), Y(ol.out[i])) : c.moveTo(X(0), Y(ol.out[0])));
      c.stroke(); c.restore();
      c.lineWidth = 2; c.strokeStyle = C.ink; c.beginPath();
      for (let i = 0; i < n; i += 2) (i ? c.lineTo(X(i * cl.dt), Y(cl.out[i])) : c.moveTo(X(0), Y(cl.out[0])));
      c.stroke();
      c.restore();
      text(c, 'speed / target', x0 + 6, y0 - 10, { size: 12 });
      text(c, 'target', x1, Y(1) - 10, { size: 12, align: 'right' });
      text(c, 'open loop', X(ol.T * 0.62), Y(ol.out[Math.floor(ol.out.length * 0.62)]) + 13, { size: 12, align: 'center', bg: true });

      // armature voltage strip
      const vy0 = H * 0.78, vy1 = H * 0.95, vmax = Math.max(cl.Vlim * 1.15, 3);
      const VY = (v) => vy1 - (clamp(v, -0.3, vmax) / vmax) * (vy1 - vy0);
      text(c, 'armature voltage', x0 + 6, vy0 - 8, { size: 12 });
      c.lineWidth = 1; c.strokeStyle = C.rule; c.beginPath(); c.moveTo(x0, vy1); c.lineTo(x1, vy1); c.stroke();
      if (a.s.sat) { c.save(); c.setLineDash([3, 3]); c.strokeStyle = C.pencil; c.beginPath(); c.moveTo(x0, VY(cl.Vlim)); c.lineTo(x1, VY(cl.Vlim)); c.stroke(); c.restore(); text(c, 'limit', x1, VY(cl.Vlim) - 8, { size: 11, align: 'right' }); }
      c.lineWidth = 1.5; c.strokeStyle = C.ink; c.beginPath();
      for (let i = 0; i < n; i += 4) (i ? c.lineTo(X(i * cl.dt), VY(cl.volt[i])) : c.moveTo(X(0), VY(cl.volt[0])));
      c.stroke();

      // numbers
      const o = cl.out, peak = Math.max(...o), os = Math.max(0, (peak - 1) * 100);
      let ts = null; for (let i = o.length - 1; i >= 0; i--) if (Math.abs(o[i] - 1) > 0.02) { ts = (i + 1) * cl.dt; break; }
      const settled = ts !== null && ts < cl.T - 0.01;
      const tail = o.slice(-400), swing = Math.max(...tail) - Math.min(...tail);
      if (peak > 3 || swing > 0.3) { a.read([['Loop', 'unstable'], ['Try', 'less Ki or more Kp']]); return a.sweep < 1; }
      a.read([['Overshoot', `${os.toFixed(1)}%`], ['Settling (2%)', settled ? `${ts.toFixed(2)} s` : 'not yet'], ['Final error', `${(Math.abs(1 - o[o.length - 1]) * 100).toFixed(1)}%`]]);
      return a.sweep < 1;
    },
  };

  // =========================================================
  // 4. Forklift — tipping about the front axle
  // =========================================================
  const MT = 4300, CG = 1.15;                     // truck + attachment mass (kg), CG behind front axle (m)
  const forklift = {
    state: { mass: 1200, reach: 1.6 },
    fmt: { mass: (v) => `${Math.round(v)} kg`, reach: (v) => `${v.toFixed(2)} m` },
    resize(a) { a.tilt = a.tilt || 0; },
    pointer(a) {
      let drag = false;
      const reachIn = a.cv.closest('.sim').querySelector('[data-in="reach"]');
      const toReach = (e) => {
        const r = a.cv.getBoundingClientRect(), x = e.clientX - r.left;
        return clamp((x - a.fx) / a.sc, 0.6, 3.4);
      };
      a.cv.addEventListener('pointerdown', (e) => {
        const r = a.cv.getBoundingClientRect(), x = e.clientX - r.left;
        if (Math.abs(x - (a.fx + a.s.reach * a.sc)) < 40) { drag = true; a.cv.setPointerCapture(e.pointerId); }
      });
      a.cv.addEventListener('pointermove', (e) => {
        const r = a.cv.getBoundingClientRect(), x = e.clientX - r.left;
        a.cv.style.cursor = Math.abs(x - (a.fx + a.s.reach * a.sc)) < 40 || drag ? 'ew-resize' : '';
        if (!drag) return;
        reachIn.value = toReach(e).toFixed(2); reachIn.dispatchEvent(new Event('input'));
      });
      const up = () => { drag = false; };
      a.cv.addEventListener('pointerup', up); a.cv.addEventListener('pointercancel', up);
    },
    frame(a, dt) {
      const c = a.c, W = a.W, H = a.H, s = a.s;
      const ratio = (MT * CG) / (s.mass * s.reach);
      const goal = ratio < 1 ? Math.min(7, (1 / ratio - 1) * 25) * Math.PI / 180 : 0;   // + = clockwise: nose down, rear wheel up
      a.tilt = reduce ? goal : lerp(a.tilt, goal, Math.min(1, dt * 6));
      a.sc = Math.min(W / 7.6, H / 3.6); a.fx = W * 0.42;
      const sc = a.sc, gy = H * 0.86, fx = a.fx, wr = 0.32 * sc;
      c.clearRect(0, 0, W, H);
      // ground
      c.lineWidth = 1.5; c.strokeStyle = C.ink;
      c.beginPath(); c.moveTo(W * 0.03, gy); c.lineTo(W * 0.97, gy); c.stroke();
      c.save(); c.lineWidth = 1; c.strokeStyle = C.pencil; wallHatch(c, [[W * 0.03, gy], [W * 0.97, gy]], 1, 6, 10); c.restore();

      c.save();
      c.translate(fx, gy); c.rotate(a.tilt); c.translate(-fx, -gy);   // tip about the front wheel contact
      const X = (m) => fx + m * sc, Y = (m) => gy - m * sc;
      c.lineWidth = 1.5; c.strokeStyle = C.ink; c.fillStyle = C.sheet;
      // body + counterweight
      c.beginPath(); c.moveTo(X(-2.55), Y(0.45)); c.lineTo(X(-2.55), Y(1.15)); c.lineTo(X(-1.9), Y(1.25)); c.lineTo(X(-0.2), Y(1.1)); c.lineTo(X(-0.2), Y(0.45)); c.closePath(); c.fill(); c.stroke();
      // roll cage
      c.beginPath(); c.moveTo(X(-1.75), Y(1.2)); c.lineTo(X(-1.6), Y(2.15)); c.lineTo(X(-0.55), Y(2.15)); c.lineTo(X(-0.35), Y(1.12)); c.stroke();
      c.beginPath(); c.moveTo(X(-1.6), Y(2.15)); c.lineTo(X(-1.45), Y(2.2)); c.lineTo(X(-0.62), Y(2.2)); c.stroke();
      // mast
      c.fillStyle = C.sheet; c.fillRect(X(0.02), Y(2.45), 0.13 * sc, 2.0 * sc); c.strokeRect(X(0.02), Y(2.45), 0.13 * sc, 2.0 * sc);
      // carriage + boom (the attachment)
      const by = 1.85;
      c.fillRect(X(0.15), Y(by + 0.35), 0.16 * sc, 0.7 * sc); c.strokeRect(X(0.15), Y(by + 0.35), 0.16 * sc, 0.7 * sc);
      c.beginPath(); c.moveTo(X(0.31), Y(by + 0.1)); c.lineTo(X(3.55), Y(by + 0.04)); c.lineTo(X(3.55), Y(by - 0.12)); c.lineTo(X(0.31), Y(by - 0.2)); c.closePath(); c.fill(); c.stroke();
      // truss lines on the boom
      c.save(); c.lineWidth = 1; c.strokeStyle = C.pencil; c.beginPath();
      for (let m = 0.4; m < 3.5; m += 0.3) { c.moveTo(X(m), Y(by + 0.08)); c.lineTo(X(m + 0.15), Y(by - 0.16)); }
      c.stroke(); c.restore();
      // wheels
      for (const [x, rr] of [[0, wr], [-2.0, wr * 0.85]]) { c.beginPath(); c.arc(X(x), gy - rr, rr, 0, TAU); c.fillStyle = C.sheet; c.fill(); c.stroke(); c.beginPath(); c.arc(X(x), gy - rr, rr * 0.35, 0, TAU); c.stroke(); }
      // trolley rides on the boom (rotates with the truck)
      const lx = X(s.reach), ly = Y(by - 0.12);
      c.fillStyle = C.sheet; c.fillRect(lx - 0.12 * sc, ly - 0.02 * sc, 0.24 * sc, 0.12 * sc); c.strokeRect(lx - 0.12 * sc, ly - 0.02 * sc, 0.24 * sc, 0.12 * sc);
      const cgx0 = X(-CG), cgy0 = Y(0.95);
      c.beginPath(); c.arc(cgx0, cgy0, 7, 0, TAU); c.fillStyle = C.sheet; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(cgx0, cgy0); c.arc(cgx0, cgy0, 7, -Math.PI / 2, 0); c.lineTo(cgx0, cgy0); c.arc(cgx0, cgy0, 7, Math.PI / 2, Math.PI); c.fillStyle = C.ink; c.fill();
      c.restore();

      // where those points ended up after tipping
      const rot = (x, y) => { const co = Math.cos(a.tilt), si = Math.sin(a.tilt), dx = x - fx, dy = y - gy; return [fx + dx * co - dy * si, gy + dx * si + dy * co]; };
      const [hx, hy] = rot(lx, ly + 0.1 * sc), [cgx, cgy] = rot(cgx0, cgy0);

      // chain and load hang straight down; weights always point down (gravity doesn't tilt)
      c.lineWidth = 1.5; c.strokeStyle = C.ink;
      const side = 0.32 + 0.3 * Math.sqrt(s.mass / 3000), hang = 0.5;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy + hang * sc); c.stroke();
      c.beginPath(); c.moveTo(hx, hy + hang * sc); c.lineTo(hx - side * sc / 2, hy + (hang + 0.22) * sc); c.moveTo(hx, hy + hang * sc); c.lineTo(hx + side * sc / 2, hy + (hang + 0.22) * sc); c.stroke();
      // the load can't go through the floor: once it touches down it rests there
      const bx = hx - side * sc / 2, byy = Math.min(hy + (hang + 0.22) * sc, gy - side * sc - 1);
      c.fillStyle = C.signal; c.fillRect(bx, byy, side * sc, side * sc); c.strokeRect(bx, byy, side * sc, side * sc);
      const aw = (m) => clamp(m / 4300, 0.15, 1.2) * 0.9 * sc;
      // load weight acts at the centre of the load
      const lcy = byy + side * sc / 2, la = Math.min(aw(s.mass), gy - 3 - lcy);
      arrow(c, hx, lcy, hx, lcy + la, 8);
      c.beginPath(); c.arc(hx, lcy, 2.5, 0, TAU); c.fillStyle = C.ink; c.fill();
      const roomRight = bx + side * sc + 62 < W;
      text(c, `${(s.mass * 9.81 / 1000).toFixed(1)} kN`, roomRight ? bx + side * sc + 6 : bx - 6, lcy, { size: 12, bg: true, align: roomRight ? 'left' : 'right' });
      arrow(c, cgx, cgy + 9, cgx, cgy + 9 + aw(MT), 8);
      text(c, `${(MT * 9.81 / 1000).toFixed(1)} kN`, cgx + 8, cgy + 9 + aw(MT) * 0.55, { size: 12, bg: true });

      // pivot marker and lever arms (not tilted: they describe the check)
      c.fillStyle = C.ink; c.beginPath(); c.moveTo(fx, gy); c.lineTo(fx - 6, gy + 10); c.lineTo(fx + 6, gy + 10); c.closePath(); c.fill();
      c.save(); c.lineWidth = 1; c.strokeStyle = C.pencil; c.setLineDash([3, 3]);
      const dimY = gy + 22;
      c.beginPath(); c.moveTo(X0(-CG), dimY); c.lineTo(fx, dimY); c.lineTo(X0(s.reach), dimY); c.stroke(); c.restore();
      function X0(m) { return fx + m * sc; }
      text(c, `${CG.toFixed(2)} m`, (X0(-CG) + fx) / 2, dimY + 11, { size: 11, align: 'center' });
      text(c, `${s.reach.toFixed(2)} m`, (X0(s.reach) + fx) / 2, dimY + 11, { size: 11, align: 'center' });

      const state = ratio < 1 ? 'tips forward' : ratio < 1.5 ? 'below 1.5 margin' : 'stable';
      const maxLoad = (MT * CG) / (1.5 * s.reach);
      a.read([['Stability ratio', ratio.toFixed(2)], ['Verdict', state], ['Max load here', `${Math.round(maxLoad / 10) * 10} kg`]]);
      return Math.abs(a.tilt - goal) > 1e-4;
    },
  };

  // =========================================================
  // 5. Gearbox — two stages, 42/14 × 40/15 = 8 : 1
  // =========================================================
  function gearPath(z, m) {
    const r = z * m / 2, ra = r + m, rf = r - 1.25 * m, p = TAU / z, P = new Path2D();
    for (let i = 0; i < z; i++) {
      const a = i * p;
      const pts = [[rf, a - p * 0.5], [rf, a - p * 0.3], [ra, a - p * 0.13], [ra, a + p * 0.13], [rf, a + p * 0.3]];
      pts.forEach(([rr, aa], k) => { const x = rr * Math.cos(aa), y = rr * Math.sin(aa); (i === 0 && k === 0) ? P.moveTo(x, y) : P.lineTo(x, y); });
    }
    P.closePath();
    return P;
  }
  const Z = [14, 42, 15, 40];
  const gearbox = {
    state: { rpm: 60 },
    fmt: { rpm: (v) => `${Math.round(v)} rpm` },
    resize(a) {
      a.m = Math.min(a.W / 92, a.H / 52);
      const m = a.m, r = Z.map((z) => z * m / 2);
      const span = 2 * r[0] + r[1] + r[2] + 2 * r[3] + 2 * m;
      const y = a.H * 0.5, x1 = a.W * 0.5 - span / 2 + r[0] + m;
      a.c1 = [x1, y]; a.c2 = [x1 + r[0] + r[1], y]; a.c3 = [a.c2[0] + r[2] + r[3], y];
      a.paths = Z.map((z) => gearPath(z, m));
      if (a.th === undefined) { a.th = 0; a.w = 0; }
    },
    pointer(a) {
      let drag = false, lastAng = 0, lastT = 0;
      const ang = (e) => { const r = a.cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - a.c1[1], e.clientX - r.left - a.c1[0]); };
      const near = (e) => { const r = a.cv.getBoundingClientRect(); return Math.hypot(e.clientX - r.left - a.c1[0], e.clientY - r.top - a.c1[1]) < Z[0] * a.m / 2 + a.m * 3; };
      a.cv.addEventListener('pointerdown', (e) => { if (!near(e)) return; drag = true; a.drag = true; lastAng = ang(e); lastT = performance.now(); a.cv.setPointerCapture(e.pointerId); a.wake(); });
      a.cv.addEventListener('pointermove', (e) => {
        a.cv.style.cursor = near(e) || drag ? 'grab' : '';
        if (!drag) return;
        const an = ang(e), d = Math.atan2(Math.sin(an - lastAng), Math.cos(an - lastAng)), now = performance.now();
        a.th += d; a.w = lerp(a.w, d / Math.max(0.008, (now - lastT) / 1000), 0.5); lastAng = an; lastT = now; a.wake();
      });
      const up = () => { drag = false; a.drag = false; a.wake(); };
      a.cv.addEventListener('pointerup', up); a.cv.addEventListener('pointercancel', up);
    },
    frame(a, dt) {
      const c = a.c, m = a.m, s = a.s;
      const wset = s.rpm * TAU / 60;
      if (!a.drag) { a.w = lerp(a.w, wset, Math.min(1, dt * 2.5)); a.th += a.w * dt; }
      const th1 = a.th, phi = 0;
      const mesh = (thA, zA, zB) => -(zA / zB) * (thA - phi) + phi + Math.PI + Math.PI / zB;
      const th2 = mesh(th1, Z[0], Z[1]), th3 = th2, th4 = mesh(th3, Z[2], Z[3]);
      c.clearRect(0, 0, a.W, a.H);
      const draw = (P, [x, y], th, fill, back) => {
        c.save(); c.translate(x, y); c.rotate(th);
        c.fillStyle = fill; c.fill(P);
        c.lineWidth = back ? 1 : 1.5; c.strokeStyle = back ? C.pencil : C.ink; c.stroke(P);
        c.restore();
      };
      const hub = ([x, y], rr, th) => {
        c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fillStyle = C.sheet; c.fill(); c.lineWidth = 1.5; c.strokeStyle = C.ink; c.stroke();
        c.save(); c.translate(x, y); c.rotate(th); c.fillStyle = C.ink; c.fillRect(-rr * 0.18, -rr - 1, rr * 0.36, rr * 0.45); c.restore();
      };
      // back plane: stage 1 driven gear
      draw(a.paths[1], a.c2, th2, C.sheet2, true);
      // pitch circles (dashed)
      c.save(); c.setLineDash([4, 5]); c.lineWidth = 1; c.strokeStyle = C.rule;
      [[a.c1, 0], [a.c2, 1], [a.c2, 2], [a.c3, 3]].forEach(([p, i]) => { c.beginPath(); c.arc(p[0], p[1], Z[i] * m / 2, 0, TAU); c.stroke(); });
      c.restore();
      draw(a.paths[0], a.c1, th1, C.signal, false);
      draw(a.paths[3], a.c3, th4, C.sheet, false);
      draw(a.paths[2], a.c2, th3, C.sheet, false);
      hub(a.c1, m * 2.2, th1); hub(a.c2, m * 2.2, th3); hub(a.c3, m * 2.6, th4);
      text(c, 'input', a.c1[0], a.c1[1] + Z[0] * m / 2 + m * 3.2, { size: 12, align: 'center' });
      text(c, 'output', a.c3[0], a.c3[1] + Z[3] * m / 2 + m * 3, { size: 12, align: 'center' });
      text(c, `${Z[0]} : ${Z[1]} teeth`, (a.c1[0] + a.c2[0]) / 2, a.c1[1] - Z[1] * m / 2 - m * 2.5, { size: 12, align: 'center' });
      text(c, `${Z[2]} : ${Z[3]} teeth`, (a.c2[0] + a.c3[0]) / 2 + m * 6, a.c1[1] - Z[3] * m / 2 - m * 2.5, { size: 12, align: 'center' });

      const ratio = (Z[1] / Z[0]) * (Z[3] / Z[2]), rin = a.w * 60 / TAU;
      a.read([['Ratio', `${ratio.toFixed(1)} : 1`], ['Input', `${Math.round(Math.abs(rin))} rpm`], ['Output', `${(Math.abs(rin) / ratio).toFixed(1)} rpm`], ['Output torque', `× ${ratio.toFixed(1)} (ideal)`]]);
      return a.drag || Math.abs(a.w) > 1e-3 || Math.abs(a.w - wset) > 1e-3;
    },
  };

  // =========================================================
  // 6. Nozzle — isentropic flow, design condition (shock-free)
  // =========================================================
  const G = 1.4;
  const areaRatio = (M) => (1 / M) * ((2 / (G + 1)) * (1 + (G - 1) / 2 * M * M)) ** ((G + 1) / (2 * (G - 1)));
  function machFrom(Ar, sup) {
    let lo = sup ? 1 : 1e-4, hi = sup ? 8 : 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2, f = areaRatio(mid) - Ar;
      if ((f > 0) === sup) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  const XT = 0.36, AIN = 2.6;
  const nozzle = {
    state: { ar: 2 },
    fmt: { ar: (v) => v.toFixed(2) },
    area(x, ae) {
      if (x <= XT) { const u = x / XT; return 1 + (AIN - 1) * (0.5 + 0.5 * Math.cos(Math.PI * u)); }
      const u = (x - XT) / (1 - XT); return 1 + (ae - 1) * (1 - Math.cos(Math.PI * u * 0.5)) ** 0.9;
    },
    change(a) {
      a.prof = [];
      for (let i = 0; i <= 200; i++) {
        const x = i / 200, A = this.area(x, a.s.ar);
        const M = Math.abs(x - XT) < 1e-6 ? 1 : machFrom(A, x > XT);
        a.prof.push({ x, A, M, V: M / Math.sqrt(1 + 0.2 * M * M) });
      }
    },
    resize(a) {
      a.n = coarse ? 120 : 220;
      a.parts = a.parts || Array.from({ length: a.n }, () => ({ x: Math.random(), e: Math.random() * 2 - 1 }));
      this.change(a);
    },
    frame(a, dt) {
      const c = a.c, W = a.W, H = a.H, s = a.s;
      const x0 = W * 0.07, x1 = W * 0.93, cy = H * 0.34, rmax = H * 0.24;
      const rs = rmax / Math.sqrt(Math.max(AIN, 4));
      const X = (x) => x0 + x * (x1 - x0), Rr = (A) => Math.sqrt(A) * rs;
      const at = (x) => a.prof[clamp(Math.round(x * 200), 0, 200)];
      c.clearRect(0, 0, W, H);
      // walls
      const top = a.prof.map((p) => [X(p.x), cy - Rr(p.A)]), bot = a.prof.map((p) => [X(p.x), cy + Rr(p.A)]);
      c.lineWidth = 1; c.strokeStyle = C.pencil; wallHatch(c, top, -1, 6, 8); wallHatch(c, bot, 1, 6, 8);
      c.lineWidth = 1.6; c.strokeStyle = C.ink;
      for (const w of [top, bot]) { c.beginPath(); w.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
      c.save(); c.setLineDash([6, 4, 1, 4]); c.lineWidth = 1; c.strokeStyle = C.pencil;
      c.beginPath(); c.moveTo(x0 - 10, cy); c.lineTo(x1 + 10, cy); c.stroke(); c.restore();
      // gas
      c.strokeStyle = C.ink; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath();
      for (const p of a.parts) {
        const q = at(p.x);
        p.x += q.V * dt * 0.16;
        if (p.x > 1) { p.x = 0; p.e = Math.random() * 2 - 1; }
        const y = cy + p.e * Rr(q.A) * 0.9, x = X(p.x), len = q.V * 16;
        c.moveTo(x, y); c.lineTo(x - len, y);
      }
      c.stroke();
      // Mach number along the nozzle
      const gy0 = H * 0.66, gy1 = H * 0.95, mmax = Math.max(3.2, Math.ceil(at(1).M + 0.3));
      const GY = (M) => gy1 - (M / mmax) * (gy1 - gy0);
      c.beginPath(); c.moveTo(X(0), gy1); a.prof.forEach((p) => c.lineTo(X(p.x), GY(p.M))); c.lineTo(X(1), gy1); c.closePath();
      c.fillStyle = 'rgba(244,180,0,.45)'; c.fill();
      c.beginPath(); a.prof.forEach((p, i) => (i ? c.lineTo(X(p.x), GY(p.M)) : c.moveTo(X(p.x), GY(p.M)))); c.lineWidth = 1.8; c.strokeStyle = C.ink; c.stroke();
      c.lineWidth = 1; c.strokeStyle = C.rule; c.beginPath(); c.moveTo(x0, gy1); c.lineTo(x1, gy1); c.stroke();
      c.save(); c.setLineDash([3, 3]); c.strokeStyle = C.pencil; c.beginPath(); c.moveTo(x0, GY(1)); c.lineTo(x1, GY(1)); c.moveTo(X(XT), cy + Rr(1) + 4); c.lineTo(X(XT), gy1); c.stroke(); c.restore();
      text(c, 'Mach 1', x1, GY(1) - 9, { size: 11, align: 'right' });
      text(c, 'Mach number along the nozzle', x0, gy0 - 10, { size: 12 });
      text(c, 'throat', X(XT) + 6, cy + Rr(1) + 14, { size: 12 });

      const e = at(1), M = e.M, pr = (1 + 0.2 * M * M) ** -3.5, tr = 1 / (1 + 0.2 * M * M);
      a.read([['Exit Mach', M.toFixed(2)], ['Exit pressure', `${(pr * 100).toFixed(1)}% of p₀`], ['Exit temperature', `${(tr * 100).toFixed(0)}% of T₀`]]);
      return true;
    },
  };

  const defs = { airfoil, pump, motor, forklift, gearbox, nozzle };
  document.querySelectorAll('.sim[data-sim]').forEach((el) => { const d = defs[el.dataset.sim]; if (d) mount(el, d); });
})();
