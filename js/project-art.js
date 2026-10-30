/* =========================================================
   Project illustrations
   Monochrome line art drawn on canvas, so the cards match the site
   and WebGL can use them as textures even when index.html is opened
   straight from disk (image files would be blocked there).
   Each drawing works in a 1000 × 600 design space.
   ========================================================= */
window.ProjectArt = (() => {
  'use strict';

  const W = 1000, H = 600;
  const TAU = Math.PI * 2;
  const BG = '#0a0a0b';
  const ACCENT = '#63e2cf';
  const white = (a) => `rgba(255,255,255,${a})`;

  // ---------- drawing helpers ----------
  const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

  function pen(g, a, w = 1.6, color) {
    g.strokeStyle = color || white(a);
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }
  function glow(g, blur = 10, color = 'rgba(255,255,255,.55)') { g.shadowColor = color; g.shadowBlur = blur; }
  function noGlow(g) { g.shadowColor = 'transparent'; g.shadowBlur = 0; }
  function path(g, pts, close) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (close) g.closePath();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function solid(g, fill = BG) { g.fillStyle = fill; g.fill(); }
  function label(g, s, x, y, { a = 0.5, size = 13, align = 'left', color, knock } = {}) {
    noGlow(g);
    g.font = `500 ${size}px "JetBrains Mono", monospace`;
    g.textAlign = align;
    if (knock) { g.lineWidth = 7; g.strokeStyle = BG; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = color || white(a);
    g.fillText(s, x, y);
    g.textAlign = 'left';
  }
  function arrow(g, x1, y1, x2, y2, head = 9) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
    g.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
    g.closePath();
    g.fillStyle = g.strokeStyle;
    g.fill();
  }
  // Hollow bar: a thick bright stroke with a dark core, so it reads as an outlined link.
  function bar(g, x1, y1, x2, y2, w, a = 0.85) {
    glow(g, 8);
    pen(g, a, w);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    noGlow(g);
    pen(g, 1, w - 3.2, BG);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  function hatch(g, x, y, w, h, gap = 9, a = 0.28) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    pen(g, a, 1);
    g.beginPath();
    for (let k = -h; k < w; k += gap) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); }
    g.stroke();
    g.restore();
  }
  function dimension(g, x1, y1, x2, y2, text, off = 22) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = (-(y2 - y1) / len) * off, ny = ((x2 - x1) / len) * off;
    const a1 = [x1 + nx, y1 + ny], a2 = [x2 + nx, y2 + ny];
    noGlow(g);
    pen(g, 0.22, 1);
    path(g, [[x1 + nx * 0.2, y1 + ny * 0.2], [x1 + nx * 1.2, y1 + ny * 1.2]]); g.stroke();
    path(g, [[x2 + nx * 0.2, y2 + ny * 0.2], [x2 + nx * 1.2, y2 + ny * 1.2]]); g.stroke();
    pen(g, 0.5, 1);
    path(g, [a1, a2]); g.stroke();
    [a1, a2].forEach(([x, y]) => { path(g, [[x - 5, y + 5], [x + 5, y - 5]]); g.stroke(); });
    g.save();
    g.translate((a1[0] + a2[0]) / 2 + nx * 0.55, (a1[1] + a2[1]) / 2 + ny * 0.55);
    let ang = Math.atan2(y2 - y1, x2 - x1);
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    g.rotate(ang);
    label(g, text, 0, 4, { a: 0.55, size: 12, align: 'center' });
    g.restore();
  }
  // Soft square-wave teeth, the same profile as the loader's gear.
  function gearPts(cx, cy, r, teeth, depth, rot = 0) {
    const pts = [], n = teeth * 28, k = Math.tanh(2.6);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = r + (depth * Math.tanh(2.6 * Math.sin(teeth * (a - rot)))) / k;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    return pts;
  }
  function plotAxes(g, x0, y0, x1, y1) {
    noGlow(g);
    pen(g, 0.25, 1);
    path(g, [[x0, y1], [x0, y0], [x1, y0]]); g.stroke();
    pen(g, 0.08, 1);
    for (let y = y0 - 32; y > y1; y -= 32) { path(g, [[x0, y], [x1, y]]); g.stroke(); }
  }
  function curve(g, x0, x1, fn, steps = 220) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([x0 + (x1 - x0) * t, fn(t)]);
    }
    path(g, pts);
  }

  // ---------- 01 · Airfoil flow (exact potential flow, Joukowski) ----------
  function pinn(g) {
    const U = 1, c0x = -0.1, c0y = 0.12, al = (8 * Math.PI) / 180;
    const R = Math.hypot(1 - c0x, c0y), be = Math.atan2(c0y, 1 - c0x);
    const G = 4 * Math.PI * U * R * Math.sin(al + be); // Kutta condition
    const ca = Math.cos(al), sa = Math.sin(al);
    const S = 172, OX = 515, OY = 318;

    // cylinder plane → airfoil plane (z = ζ + 1/ζ) → screen, free stream horizontal
    const toScreen = (x, y) => {
      const zx = c0x + x * ca - y * sa, zy = c0y + x * sa + y * ca;
      const d = zx * zx + zy * zy;
      const wx = zx + zx / d, wy = zy - zy / d;
      return [OX + (wx * ca + wy * sa) * S, OY - (wy * ca - wx * sa) * S];
    };
    const vel = (x, y) => {
      const r2 = x * x + y * y, r4 = r2 * r2;
      const re = U * (1 - (R * R * (x * x - y * y)) / r4) + (G * y) / (2 * Math.PI * r2);
      const im = U * ((R * R * 2 * x * y) / r4) + (G * x) / (2 * Math.PI * r2);
      return [re, -im];
    };
    const psi = (x, y) => U * (y - (R * R * y) / (x * x + y * y)) + (G / (2 * Math.PI)) * Math.log(Math.hypot(x, y));
    const trace = (y0) => {
      let x = -7, y = y0;
      const pts = [toScreen(x, y)], h = 0.022;
      for (let k = 0; k < 1500 && x < 7; k++) {
        let [u, v] = vel(x, y), s = Math.hypot(u, v) || 1e-6;
        const mx = x + (u / s) * h * 0.5, my = y + (v / s) * h * 0.5;
        [u, v] = vel(mx, my); s = Math.hypot(u, v) || 1e-6;
        x += (u / s) * h; y += (v / s) * h;
        pts.push(toScreen(x, y));
      }
      return pts;
    };

    // dividing streamline: same ψ as the stagnation point on the body
    const psiS = (G / (2 * Math.PI)) * Math.log(R);
    let lo = -3, hi = 3;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (psi(-7, m) < psiS) lo = m; else hi = m; }
    const ys = (lo + hi) / 2;

    glow(g, 6);
    for (let y0 = -3.3; y0 <= 3.31; y0 += 0.3) {
      if (Math.abs(y0 - ys) < 0.12) continue;
      pen(g, 0.1 + 0.6 * Math.exp(-Math.abs(y0 - ys) * 0.85), 1.25);
      path(g, trace(y0)); g.stroke();
    }
    glow(g, 12, 'rgba(99,226,207,.7)');
    pen(g, 1, 1.8, ACCENT);
    path(g, trace(ys + 0.004)); g.stroke();
    path(g, trace(ys - 0.004)); g.stroke();

    // collocation points (PINN), sampled outside the body in the cylinder plane
    const rnd = seeded(7);
    noGlow(g);
    g.fillStyle = white(0.4);
    for (let i = 0; i < 160; i++) {
      const a = rnd() * TAU, r = R * (1.08 + rnd() * 1.6);
      const [px, py] = toScreen(r * Math.cos(a), r * Math.sin(a));
      if (px > 60 && px < 940 && py > 150 && py < 560) { g.beginPath(); g.arc(px, py, 1.6, 0, TAU); g.fill(); }
    }

    // the section itself
    const body = [];
    for (let i = 0; i <= 360; i++) { const a = (i / 360) * TAU; body.push(toScreen(R * Math.cos(a), R * Math.sin(a))); }
    path(g, body, true);
    solid(g);
    glow(g, 14);
    pen(g, 0.95, 2.2);
    g.stroke();
    // chord line, trailing edge to the opposite point of the circle
    noGlow(g);
    const te = toScreen(R * Math.cos(-al - be), R * Math.sin(-al - be));
    const le = toScreen(R * Math.cos(Math.PI - al - be), R * Math.sin(Math.PI - al - be));
    g.setLineDash([4, 6]);
    pen(g, 0.3, 1);
    path(g, [le, te]); g.stroke();
    g.setLineDash([]);

    // network sketch: (x, y) → u, v, p
    const layers = [[2, 800], [4, 850], [4, 900], [3, 950]].map(([n, x]) => Array.from({ length: n }, (_, i) => [x - 30, 92 + (i - (n - 1) / 2) * 22]));
    pen(g, 0.16, 1);
    for (let l = 0; l < layers.length - 1; l++) {
      layers[l].forEach(([ax, ay]) => layers[l + 1].forEach(([bx, by]) => { path(g, [[ax, ay], [bx, by]]); g.stroke(); }));
    }
    layers.flat().forEach(([x, y]) => { circle(g, x, y, 5); solid(g); pen(g, 0.8, 1.3); g.stroke(); });
    label(g, 'x, y', 748, 97, { a: 0.55, size: 12, align: 'right' });
    label(g, 'u, v, p', 934, 97, { a: 0.55, size: 12 });
    label(g, 'ψ = Im W(ζ)   ·   α = 8°', 70, 110, { a: 0.5 });
    label(g, 'Kutta condition', 70, 132, { color: ACCENT, size: 12 });
  }

  // ---------- 02 · Reciprocating pump (slider-crank + flywheel) ----------
  function pump(g) {
    const cx = 245, cy = 230, rc = 88, L = 300, th = -0.78;
    const px = cx + rc * Math.cos(th), py = cy + rc * Math.sin(th);
    const sx = px + Math.sqrt(L * L - (py - cy) ** 2);

    // flywheel
    glow(g, 10);
    pen(g, 0.9, 2.2); circle(g, cx, cy, 150); g.stroke();
    pen(g, 0.4, 1.2); circle(g, cx, cy, 130); g.stroke();
    pen(g, 0.55, 1.4);
    for (let k = 0; k < 6; k++) {
      const a = 0.35 + (k * TAU) / 6;
      path(g, [[cx + 30 * Math.cos(a), cy + 30 * Math.sin(a)], [cx + 130 * Math.cos(a), cy + 130 * Math.sin(a)]]); g.stroke();
    }
    noGlow(g);
    pen(g, 0.3, 1);
    g.beginPath(); g.arc(cx, cy, 52, th, 0); g.stroke();
    label(g, 'θ', cx + 58, cy - 14, { color: ACCENT, size: 15 });

    // cylinder
    const top = cy - 62, bot = cy + 50, x0 = sx - 80, x1 = 880;
    hatch(g, x0, top, x1 - x0, 12); hatch(g, x0, bot, x1 - x0, 12); hatch(g, x1 - 12, top, 12, 124);
    glow(g, 8); pen(g, 0.85, 1.6);
    g.strokeRect(x0, top, x1 - x0, 12); g.strokeRect(x0, bot, x1 - x0, 12); g.strokeRect(x1 - 12, top, 12, 124);
    // valves + flow
    [[805, top, -1, 'suction'], [805, bot + 12, 1, 'discharge']].forEach(([vx, vy, dir, name]) => {
      const end = vy + dir * 92;
      glow(g, 8); pen(g, 0.8, 1.5);
      path(g, [[vx - 14, vy], [vx - 14, end]]); g.stroke();
      path(g, [[vx + 14, vy], [vx + 14, end]]); g.stroke();
      const m = vy + dir * 46;
      path(g, [[vx - 14, m - 10], [vx + 14, m + 10], [vx + 14, m - 10], [vx - 14, m + 10]], true); g.stroke();
      noGlow(g); pen(g, 1, 1.4, ACCENT);
      arrow(g, vx, dir < 0 ? end - 2 : vy + 18, vx, dir < 0 ? vy - 18 : end + 2);
      label(g, name, vx + 28, m + 4, { a: 0.5, size: 12 });
    });

    // piston
    glow(g, 10); pen(g, 0.95, 2);
    g.beginPath(); g.rect(sx - 34, top + 14, 96, 98); solid(g); g.stroke();
    pen(g, 0.4, 1.2);
    [[sx + 40], [sx + 50]].forEach(([x]) => { path(g, [[x, top + 14], [x, bot - 2]]); g.stroke(); });

    // crank and connecting rod
    bar(g, cx, cy, px, py, 28);
    bar(g, px, py, sx, cy, 18);
    [[cx, cy, 16], [sx, cy, 9]].forEach(([x, y, r]) => { circle(g, x, y, r); solid(g); glow(g, 8); pen(g, 0.95, 1.8); g.stroke(); });
    circle(g, px, py, 9); glow(g, 14, 'rgba(99,226,207,.8)'); solid(g, ACCENT);
    circle(g, cx, cy, 5); noGlow(g); solid(g, white(0.95));

    dimension(g, sx - 34 - 2 * rc, top - 4, sx - 34, top - 4, 'stroke = 2r', -30);
    label(g, '100 / 300 rpm', 120, 418, { a: 0.5 });

    // torque over two revolutions
    const X0 = 120, X1 = 890, Y0 = 560, mid = 500;
    plotAxes(g, X0, Y0, X1, 440);
    const T = (t) => 30 * Math.sin(t) + 22 * Math.sin(2 * t);
    glow(g, 4); pen(g, 0.55, 1.4);
    curve(g, X0, X1, (t) => mid - T(t * 2 * TAU)); g.stroke();
    glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 2, ACCENT);
    curve(g, X0, X1, (t) => mid - 0.3 * T(t * 2 * TAU)); g.stroke();
    label(g, 'T(θ)', X0 + 8, 456, { a: 0.5, size: 12 });
    label(g, '— without flywheel', X1, 456, { a: 0.55, size: 12, align: 'right' });
    label(g, '— with flywheel', X1, 474, { color: ACCENT, size: 12, align: 'right' });
  }

  // ---------- 03 · DC motor speed control ----------
  function motor(g) {
    const y = 170;
    glow(g, 8); pen(g, 0.85, 1.6);
    label(g, 'ω_ref', 62, y - 14, { a: 0.6 });
    glow(g, 8); pen(g, 0.85, 1.6);
    arrow(g, 62, y, 146, y);
    circle(g, 170, y, 23); g.stroke();
    path(g, [[154, y - 16], [186, y + 16]]); g.stroke();
    path(g, [[154, y + 16], [186, y - 16]]); g.stroke();
    label(g, '+', 132, y - 12, { a: 0.7, size: 15 });
    label(g, '−', 182, y + 44, { a: 0.7, size: 15 });
    glow(g, 8); pen(g, 0.85, 1.6);
    arrow(g, 193, y, 246, y);

    // PI controller
    g.strokeRect(248, y - 42, 150, 84);
    label(g, 'Kp + Ki/s', 323, y + 6, { a: 0.92, size: 17, align: 'center' });
    label(g, 'PI', 256, y - 52, { color: ACCENT, size: 12 });
    glow(g, 8); pen(g, 0.85, 1.6);
    arrow(g, 398, y, 452, y);

    // saturation
    g.strokeRect(454, y - 42, 96, 84);
    pen(g, 0.3, 1);
    path(g, [[472, y], [532, y]]); g.stroke();
    path(g, [[502, y - 30], [502, y + 30]]); g.stroke();
    glow(g, 8); pen(g, 0.95, 1.8);
    path(g, [[470, y + 20], [488, y + 20], [516, y - 20], [534, y - 20]]); g.stroke();
    label(g, 'V_a limit', 502, y - 52, { a: 0.45, size: 11, align: 'center' });
    glow(g, 8); pen(g, 0.85, 1.6);
    arrow(g, 550, y, 610, y);

    // motor
    const mx = 680;
    circle(g, mx, y, 64); solid(g); g.stroke();
    pen(g, 0.45, 1.2); circle(g, mx, y, 52); g.stroke();
    circle(g, mx, y, 32); g.stroke();
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10;
      path(g, [[mx + 12 * Math.cos(a), y + 12 * Math.sin(a)], [mx + 32 * Math.cos(a), y + 32 * Math.sin(a)]]); g.stroke();
    }
    glow(g, 8); pen(g, 0.9, 1.6);
    g.strokeRect(744, y - 8, 54, 16);
    label(g, 'M', mx, y + 6, { a: 0.95, size: 18, align: 'center' });
    glow(g, 8); pen(g, 0.85, 1.6);
    arrow(g, 798, y, 930, y);
    label(g, 'ω', 912, y - 14, { a: 0.7, size: 15 });

    // feedback
    const fy = y + 150;
    circle(g, 860, y, 4); solid(g, white(0.95));
    path(g, [[860, y], [860, fy], [578, fy]]); g.stroke();
    path(g, [[466, fy], [170, fy]]); g.stroke();
    arrow(g, 170, fy, 170, y + 26);
    g.strokeRect(466, fy - 26, 112, 52);
    pen(g, 0.8, 1.4);
    g.beginPath(); g.arc(522, fy + 12, 22, Math.PI, 0); g.stroke();
    pen(g, 1, 1.6, ACCENT);
    path(g, [[522, fy + 12], [536, fy - 4]]); g.stroke();

    // step response
    const X0 = 120, X1 = 890, Y0 = 568, S = 118;
    plotAxes(g, X0, Y0, X1, 410);
    const z = 0.5, wd = Math.sqrt(1 - z * z);
    g.setLineDash([5, 6]); noGlow(g); pen(g, 0.4, 1.2);
    path(g, [[X0, Y0 - S], [X1, Y0 - S]]); g.stroke();
    pen(g, 0.55, 1.4);
    curve(g, X0, X1, (t) => Y0 - S * 0.8 * (1 - Math.exp((-t * 14) / 3))); g.stroke();
    g.setLineDash([]);
    glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 2, ACCENT);
    curve(g, X0, X1, (t) => { const s = t * 14; return Y0 - S * (1 - Math.exp(-z * s) * (Math.cos(wd * s) + (z / wd) * Math.sin(wd * s))); }); g.stroke();
    label(g, 'step response', X0 + 8, 426, { a: 0.5, size: 12 });
    label(g, '— closed loop (PI)', X1, 426, { color: ACCENT, size: 12, align: 'right' });
    label(g, '-- open loop', X1, 444, { a: 0.55, size: 12, align: 'right' });
  }

  // ---------- 04 · Forklift crane attachment ----------
  function forklift(g) {
    const ground = 548;
    noGlow(g); pen(g, 0.4, 1.2);
    path(g, [[50, ground], [950, ground]]); g.stroke();
    pen(g, 0.18, 1);
    for (let x = 56; x < 950; x += 16) { path(g, [[x, ground + 2], [x - 10, ground + 12]]); g.stroke(); }

    // mast + carriage + fork
    glow(g, 8); pen(g, 0.85, 1.7);
    g.strokeRect(118, 70, 22, ground - 70); g.strokeRect(156, 70, 22, ground - 70);
    [[100], [250], [400]].forEach(([yy]) => { g.strokeRect(140, yy, 16, 10); });
    g.strokeRect(178, 372, 26, 140);
    path(g, [[204, 494], [572, 494], [594, 500], [572, 506], [204, 506]], true); g.stroke();
    label(g, '3 t forklift', 70, 50, { a: 0.5, size: 12 });

    // attachment: fork pockets, base, post
    g.beginPath(); g.rect(248, 484, 290, 32); solid(g); g.stroke();
    hatch(g, 248, 484, 290, 32, 10, 0.18);
    pen(g, 0.85, 1.7); g.strokeRect(248, 484, 290, 32);
    g.beginPath(); g.rect(236, 462, 316, 22); solid(g); g.stroke();
    g.beginPath(); g.rect(298, 300, 38, 162); solid(g); g.stroke();

    // boom (outer + telescoping inner section)
    const P = [317, 312], a = -0.42, len = 590;
    const at = (d, o = 0) => [P[0] + d * Math.cos(a) - o * Math.sin(a), P[1] + d * Math.sin(a) + o * Math.cos(a)];
    g.save(); g.translate(P[0], P[1]); g.rotate(a);
    glow(g, 10); pen(g, 0.9, 1.8);
    g.beginPath(); g.rect(-22, -18, 360, 36); solid(g); g.stroke();
    g.beginPath(); g.rect(320, -12, 270, 24); solid(g); g.stroke();
    noGlow(g); pen(g, 0.55, 1.2);
    for (let d = 370; d <= 560; d += 38) { circle(g, d, 0, 5); g.stroke(); }
    pen(g, 0.3, 1);
    path(g, [[0, -18], [-22, 0]]); g.stroke();
    g.restore();

    // strut
    const B = at(225, 18);
    bar(g, 330, 450, B[0], B[1], 16);
    [[317, 312, 11], [330, 450, 8], [B[0], B[1], 8]].forEach(([x, y, r]) => { circle(g, x, y, r); solid(g); glow(g, 8); pen(g, 0.95, 1.7); g.stroke(); });

    // sheave, cable, hook
    const T = at(len - 14);
    circle(g, T[0], T[1], 15); solid(g); glow(g, 8); pen(g, 0.95, 1.8); g.stroke();
    const hx = T[0] + 15, hy = T[1] + 150;
    glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 1.6, ACCENT);
    path(g, [[hx, T[1]], [hx, hy]]); g.stroke();
    g.strokeRect(hx - 9, hy, 18, 22);
    pen(g, 1, 3, ACCENT);
    g.beginPath(); g.moveTo(hx, hy + 22); g.lineTo(hx, hy + 44);
    g.arc(hx - 17, hy + 44, 17, 0, Math.PI, false); g.lineTo(hx - 34, hy + 34); g.stroke();

    // annotations
    noGlow(g); pen(g, 0.35, 1);
    g.beginPath(); g.arc(P[0], P[1], 70, a, 0); g.stroke();
    path(g, [[P[0], P[1]], [P[0] + 92, P[1]]]); g.stroke();
    label(g, 'adj. angle', P[0] + 100, P[1] + 5, { a: 0.55, size: 12 });
    dimension(g, ...at(0, -18), ...at(len, -18), 'adjustable reach', -26);
    label(g, 'bolts · pins · welds checked', 560, 528, { a: 0.45, size: 12 });
  }

  // ---------- 05 · Two-stage gearbox ----------
  function gearbox(g) {
    // housing
    glow(g, 8); pen(g, 0.6, 2);
    g.beginPath(); g.roundRect(140, 92, 720, 420, 30); g.stroke();
    noGlow(g); pen(g, 0.18, 1);
    g.beginPath(); g.roundRect(156, 108, 688, 388, 22); g.stroke();
    pen(g, 0.6, 1.6);
    g.strokeRect(170, 512, 140, 22); g.strokeRect(690, 512, 140, 22);
    [[176, 128], [824, 128], [176, 476], [824, 476], [240, 523], [760, 523]].forEach(([x, y]) => {
      circle(g, x, y, 7); g.stroke();
      path(g, [[x - 4, y], [x + 4, y]]); g.stroke(); path(g, [[x, y - 4], [x, y + 4]]); g.stroke();
    });

    const ang = -0.5;
    const P1 = [298, 338], r1 = 52, n1 = 13;
    const G1 = [P1[0] + r1 + 118, 338], r2 = 118, n2 = 30;
    const r3 = 46, n3 = 12, r4 = 124, n4 = 32;
    const G2 = [G1[0] + (r3 + r4) * Math.cos(ang), G1[1] + (r3 + r4) * Math.sin(ang)];

    function gear([x, y], r, n, rot, holes) {
      path(g, gearPts(x, y, r, n, 6, rot), true);
      solid(g);
      glow(g, 10); pen(g, 0.92, 1.9); g.stroke();
      noGlow(g); pen(g, 0.3, 1.1);
      circle(g, x, y, r - 18); g.stroke();
      circle(g, x, y, Math.max(20, r * 0.26)); g.stroke();
      if (holes) for (let k = 0; k < 5; k++) {
        const a = rot + (k * TAU) / 5;
        circle(g, x + r * 0.56 * Math.cos(a), y + r * 0.56 * Math.sin(a), r * 0.15); g.stroke();
      }
      g.setLineDash([3, 6]); pen(g, 0.16, 1); circle(g, x, y, r); g.stroke(); g.setLineDash([]);
    }
    function shaft([x, y]) {
      circle(g, x, y, 15); solid(g); glow(g, 8); pen(g, 0.95, 1.6); g.stroke();
      noGlow(g); circle(g, x, y, 6); solid(g, white(0.92));
    }

    gear(P1, r1, n1, -Math.PI / (2 * n1), false);
    gear(G1, r2, n2, Math.PI + Math.PI / (2 * n2), true);
    gear(G1, r3, n3, ang - Math.PI / (2 * n3), false);
    gear(G2, r4, n4, ang + Math.PI + Math.PI / (2 * n4), true);
    [P1, G1, G2].forEach(shaft);

    // centre lines
    g.setLineDash([10, 5, 2, 5]); pen(g, 0.22, 1);
    path(g, [[P1[0] - 90, P1[1]], [G1[0] + 150, G1[1]]]); g.stroke();
    path(g, [G1, [G2[0] + 60 * Math.cos(ang), G2[1] + 60 * Math.sin(ang)]]); g.stroke();
    g.setLineDash([]);

    // rotation arrows
    glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 2, ACCENT);
    g.beginPath(); g.arc(P1[0], P1[1], 80, 2.3, 3.9); g.stroke();
    arrow(g, P1[0] + 80 * Math.cos(3.8), P1[1] + 80 * Math.sin(3.8), P1[0] + 80 * Math.cos(3.92), P1[1] + 80 * Math.sin(3.92), 10);
    glow(g, 6); pen(g, 0.8, 1.6);
    g.beginPath(); g.arc(G2[0], G2[1], 150, -0.2, 0.6); g.stroke();
    arrow(g, G2[0] + 150 * Math.cos(-0.1), G2[1] + 150 * Math.sin(-0.1), G2[0] + 150 * Math.cos(-0.22), G2[1] + 150 * Math.sin(-0.22), 10);
    label(g, 'input', P1[0] - 128, P1[1] + 4, { color: ACCENT, size: 12 });
    label(g, 'output', G2[0] + 158, G2[1] + 40, { a: 0.6, size: 12 });
    label(g, 'stage 1', P1[0] + 40, 470, { a: 0.45, size: 12 });
    label(g, 'stage 2', G2[0] + 118, 134, { a: 0.45, size: 12 });
  }

  // ---------- 06 · CFD: converging–diverging nozzle ----------
  function fluent(g) {
    const cy = 232, x0 = 80, x1 = 920, xt = 420;
    const r = (x) => (x < xt ? 54 + 112 * ((xt - x) / (xt - x0)) ** 2 : 54 + 118 * ((x - xt) / (x1 - xt)) ** 1.35);
    const xs = Array.from({ length: 181 }, (_, i) => x0 + ((x1 - x0) * i) / 180);

    // streamlines, brighter as the flow accelerates
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, white(0.18)); grad.addColorStop((xt - x0) / (x1 - x0), white(0.7)); grad.addColorStop(1, white(0.95));
    glow(g, 6);
    for (let k = -6; k <= 6; k++) {
      const f = (k / 6.6) * 0.94;
      g.globalAlpha = 1 - Math.abs(k) / 9;
      pen(g, 1, 1.25, grad);
      path(g, xs.map((x) => [x, cy + f * r(x)])); g.stroke();
    }
    g.globalAlpha = 1;

    // walls
    [-1, 1].forEach((s) => {
      const inner = xs.map((x) => [x, cy + s * r(x)]);
      const outer = xs.map((x) => [x, cy + s * (r(x) + 14)]).reverse();
      g.save(); path(g, inner.concat(outer), true); g.clip();
      noGlow(g); pen(g, 0.25, 1); g.beginPath();
      for (let x = x0 - 40; x < x1; x += 10) { g.moveTo(x, cy + s * 40); g.lineTo(x + 30 * s, cy + s * 200); }
      g.stroke(); g.restore();
      glow(g, 10); pen(g, 0.9, 1.9);
      path(g, inner); g.stroke();
      pen(g, 0.5, 1.2);
      path(g, xs.map((x) => [x, cy + s * (r(x) + 14)])); g.stroke();
    });

    // throat
    g.setLineDash([5, 6]); glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 1.6, ACCENT);
    path(g, [[xt, cy - r(xt) - 30], [xt, cy + r(xt) + 30]]); g.stroke(); g.setLineDash([]);
    label(g, 'throat  M = 1', xt + 10, cy - r(xt) - 38, { color: ACCENT, size: 12, knock: true });
    label(g, 'p₀, T₀', x0 + 26, cy + 5, { a: 0.75, size: 13, knock: true });
    label(g, 'supersonic', x1 - 26, cy + 5, { a: 0.75, size: 13, align: 'right', knock: true });

    // axial Mach number and pressure
    const X0 = 120, X1 = 890, Y0 = 570, S = 130;
    plotAxes(g, X0, Y0, X1, 420);
    const M = (t) => { const x = x0 + (x1 - x0) * t; return x < xt ? 0.22 + 0.78 * ((x - x0) / (xt - x0)) ** 2 : 1 + 1.35 * ((x - xt) / (x1 - xt)) ** 0.7; };
    g.setLineDash([5, 6]); noGlow(g); pen(g, 0.35, 1.1);
    const y1 = Y0 - S / 2.4;
    path(g, [[X0, y1], [X1, y1]]); g.stroke();
    pen(g, 0.6, 1.4);
    curve(g, X0, X1, (t) => Y0 - S * Math.pow(1 + 0.2 * M(t) ** 2, -3.5)); g.stroke();
    g.setLineDash([]);
    glow(g, 10, 'rgba(99,226,207,.7)'); pen(g, 1, 2, ACCENT);
    curve(g, X0, X1, (t) => Y0 - (S * M(t)) / 2.4); g.stroke();
    label(g, 'diffuser · elbow · nozzle studies', X0 + 8, 436, { a: 0.45, size: 12 });
    label(g, '— Mach', X1, 436, { color: ACCENT, size: 12, align: 'right' });
    label(g, '-- p / p₀', X1, 454, { a: 0.55, size: 12, align: 'right' });
  }

  const ARTS = { pinn, pump, motor, forklift, gearbox, fluent };

  // ---------- canvases ----------
  function background(g, w, h) {
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(w * 0.82, -h * 0.2, 0, w * 0.82, -h * 0.2, w);
    rg.addColorStop(0, 'rgba(255,255,255,.14)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.fillStyle = white(0.055);
    for (let y = 30; y < h; y += 30) for (let x = 30; x < w; x += 30) g.fillRect(x, y, 1.3, 1.3);
    noGlow(g);
    pen(g, 0.1, 1); g.strokeRect(24.5, 24.5, w - 49, h - 49);
    pen(g, 0.55, 1.3);
    [[24.5, 24.5, 1, 1], [w - 24.5, 24.5, -1, 1], [24.5, h - 24.5, 1, -1], [w - 24.5, h - 24.5, -1, -1]].forEach(([x, y, sx, sy]) => {
      path(g, [[x + 18 * sx, y], [x, y], [x, y + 18 * sy]]); g.stroke();
    });
  }
  function grain(g, w, h, seed) {
    const rnd = seeded(seed * 97 + 13);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }
  function drawArt(g, key, x, y, w) {
    g.save();
    g.translate(x, y);
    g.scale(w / W, w / W);
    ARTS[key](g);
    g.restore();
    noGlow(g);
  }
  function wrapLines(g, text, max) {
    const lines = []; let line = '';
    text.split(' ').forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > max && line) { lines.push(line); line = word; } else line = test;
    });
    lines.push(line);
    return lines;
  }

  // Ribbon card: illustration + typeset label.
  function card(p, i, total) {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 800;
    const g = c.getContext('2d');
    background(g, 1200, 800);
    drawArt(g, p.key, 100, 34, 1000);
    const fade = g.createLinearGradient(0, 430, 0, 800);
    fade.addColorStop(0, 'rgba(10,10,11,0)');
    fade.addColorStop(0.55, 'rgba(10,10,11,.86)');
    fade.addColorStop(1, 'rgba(10,10,11,.97)');
    g.fillStyle = fade; g.fillRect(0, 430, 1200, 370);
    const n = String(i + 1).padStart(2, '0'), t = String(total).padStart(2, '0');
    g.fillStyle = ACCENT; g.beginPath(); g.arc(62, 66, 5, 0, TAU); g.fill();
    label(g, `PROJECT ${n} / ${t}`, 78, 72, { a: 0.8, size: 21 });
    label(g, p.type.toUpperCase(), 1144, 72, { a: 0.5, size: 21, align: 'right' });
    g.fillStyle = '#fff';
    g.font = '800 82px Outfit, sans-serif';
    wrapLines(g, p.title.toUpperCase(), 1060).reverse().forEach((l, k) => g.fillText(l, 54, 700 - k * 78));
    label(g, p.tags.join('  ·  ').toUpperCase(), 58, 752, { a: 0.55, size: 19 });
    grain(g, 1200, 800, i + 1);
    return c;
  }

  // Illustration only, for the project modal and the no-WebGL fallback.
  const cache = {};
  function image(p) {
    if (cache[p.key]) return cache[p.key];
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 800;
    const g = c.getContext('2d');
    background(g, 1200, 800);
    drawArt(g, p.key, 100, 100, 1000);
    grain(g, 1200, 800, 3);
    return (cache[p.key] = c.toDataURL('image/jpeg', 0.9));
  }

  return { card, image };
})();
