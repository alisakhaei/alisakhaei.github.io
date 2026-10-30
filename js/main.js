/* =========================================================
   Ali Sakhaei — Portfolio interactions
   GSAP + ScrollTrigger · Lenis · Three.js
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pad = (n) => String(n).padStart(2, '0');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------------------------------------------------------
  // Content
  // ---------------------------------------------------------
  const PROJECTS = [
    {
      key: 'pinn', type: 'Computational methods', title: 'Airfoil Flow with PINNs',
      description: 'A computational study of two-dimensional airfoil flow using potential-flow methods and physics-informed neural networks. The repository includes Python notebooks, trained models, MATLAB scripts, datasets, and flow-field results.',
      tags: ['Python', 'PyTorch', 'PINN', 'Potential flow'],
      link: 'https://github.com/alisakhaei/airfoil-flow-pinn',
    },
    {
      key: 'pump', type: 'Multibody dynamics', title: 'Reciprocating Pump Dynamics',
      description: 'A Simscape Multibody model of a reciprocating pump mechanism. The study compares operation at 100 and 300 rpm and examines how adding a flywheel changes torque and system response.',
      tags: ['MATLAB', 'Simscape Multibody', 'Dynamics', 'Flywheel'],
      link: 'https://github.com/alisakhaei/reciprocating-pump-dynamics',
    },
    {
      key: 'motor', type: 'Control & simulation', title: 'DC Motor Speed Control',
      description: 'Modeling and simulation of a separately excited DC motor. The repository compares open-loop behavior with closed-loop speed regulation using a PI controller and armature-voltage saturation in MATLAB/Simulink.',
      tags: ['MATLAB', 'Simulink', 'Dynamic modeling', 'PI control'],
      link: 'https://github.com/alisakhaei/dc-motor-speed-control',
    },
    {
      key: 'forklift', type: 'Mechanical design', title: 'Forklift Crane Attachment',
      description: 'A removable and manually adjustable crane attachment developed for a 3-ton forklift. The work includes stability checks, static loading, bolts, pins, welds, structural members, manufacturing drawings, and a complete SolidWorks assembly. This is an academic design and has not been fabricated or certified for lifting operations.',
      tags: ['SolidWorks', 'Machine design', 'Structural analysis', 'Engineering drawings'],
      link: 'https://github.com/alisakhaei/forklift-crane-attachment',
    },
    {
      key: 'gearbox', type: 'Machine design', title: 'Two-Stage Gearbox',
      description: 'Mechanical design and analysis of a two-stage gearbox, covering gears, shafts, bearings, housing, component selection, engineering calculations, and the final SolidWorks assembly.',
      tags: ['SolidWorks', 'Gear design', 'Shaft design', 'Bearings'],
      link: 'https://github.com/alisakhaei/gearbox-design',
    },
    {
      key: 'fluent', type: 'CFD', title: 'ANSYS Fluent Flow Analysis',
      description: 'A collection of CFD studies covering diffuser flow, pressure loss in pipe elbows, and compressible nozzle flow. MATLAB scripts are used for additional data processing and result visualization.',
      tags: ['ANSYS Fluent', 'MATLAB', 'CFD', 'Post-processing'],
      link: 'https://github.com/alisakhaei/ansys-fluent-flow-analysis',
    },
  ];

  const TOOLS = [
    { name: 'MATLAB', cat: 'Numerical computing', used: 'DC motor control · Fluent post-processing · PINN scripts' },
    { name: 'Simulink', cat: 'Control & simulation', used: 'Open- vs closed-loop DC motor speed control' },
    { name: 'Simscape', cat: 'Multibody dynamics', used: 'Reciprocating pump & flywheel study' },
    { name: 'Python', cat: 'Scientific computing', used: 'Airfoil-flow notebooks & datasets' },
    { name: 'PyTorch', cat: 'Machine learning', used: 'Physics-informed neural networks' },
    { name: 'SolidWorks', cat: 'CAD & assemblies', used: 'Forklift crane attachment · two-stage gearbox' },
    { name: 'ANSYS Fluent', cat: 'Computational fluid dynamics', used: 'Diffuser · pipe elbow · compressible nozzle' },
    { name: 'Arduino', cat: 'Embedded & electronics', used: 'Sensors & embedded implementation' },
    { name: 'LaTeX', cat: 'Technical writing', used: 'Reports, calculations & documentation' },
  ];

  // Without GSAP there is no motion layer: show the page as-is.
  if (!window.gsap || !window.ScrollTrigger) {
    document.body.classList.remove('is-loading');
    $('.loader')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // The intro always plays from the top.
  ScrollTrigger.clearScrollMemory('manual');
  window.scrollTo(0, 0);

  // ---------------------------------------------------------
  // Smooth scroll
  // ---------------------------------------------------------
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollY = () => window.scrollY || document.documentElement.scrollTop;
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.8, force: true });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // ---------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    return [...text].map((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c === ' ' ? ' ' : c;
      s.style.setProperty('--i', i);
      el.appendChild(s);
      return s;
    });
  }

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w"><span>${w}</span></span>`).join(' ');
    return $$('.w > span', el);
  }

  // Hover "roll": every letter is duplicated below itself and slides up.
  function setupRoll() {
    $$('[data-roll]').forEach((el) => {
      const label = el.textContent.trim();
      const roll = document.createElement('span');
      roll.className = 'roll';
      roll.setAttribute('aria-hidden', 'true');
      [...label].forEach((c, i) => {
        const s = document.createElement('span');
        s.className = 'ch-r';
        s.textContent = c;
        s.dataset.c = c;
        s.style.setProperty('--i', i);
        roll.appendChild(s);
      });
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = label;
      el.textContent = '';
      el.append(roll, sr);
    });
  }

  // ---------------------------------------------------------
  // Cursor
  // ---------------------------------------------------------
  function setupCursor() {
    if (!finePointer) return;
    const cur = $('.cursor'), dot = $('.cursor-dot'), ring = $('.cursor-ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    cur.classList.add('is-hidden');
    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      cur.classList.remove('is-hidden');
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    gsap.ticker.add(() => {
      rx = lerp(rx, mx, 0.2); ry = lerp(ry, my, 0.2);
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    });
    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      cur.classList.toggle('is-drag', !!t.closest('[data-cursor="drag"]'));
      cur.classList.toggle('is-hover', !!t.closest('a, button, .kit-index li'));
    });
  }

  // ---------------------------------------------------------
  // Loader — a gear outline draws itself around the name
  // ---------------------------------------------------------
  function gearPath(cx, cy, R, A, teeth, sharp, start) {
    const pts = [];
    const n = 900, norm = Math.tanh(sharp);
    for (let i = 0; i <= n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const r = R + (A * Math.tanh(sharp * Math.sin(teeth * a))) / norm;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return 'M' + pts.join('L');
  }

  function runLoader() {
    const loader = $('.loader');
    const path = $('.gear-path'), head = $('.gear-head'), count = $('.loader-count');
    path.setAttribute('d', gearPath(250, 250, 200, 8, 20, 2.4, 2.3));
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    const img = $('.hero-portrait img');
    const assets = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((res) => { if (img.complete) res(); else { img.onload = res; img.onerror = res; } }),
    ]);

    const state = { p: 0 };
    gsap.to('.loader-gear', { rotation: 50, duration: 5, ease: 'none', transformOrigin: '50% 50%' });
    const draw = gsap.to(state, {
      p: 1, duration: reduceMotion ? 0.3 : 2.2, ease: 'power2.inOut',
      onUpdate() {
        path.style.strokeDashoffset = `${len * (1 - state.p)}`;
        const pt = path.getPointAtLength(len * state.p);
        head.setAttribute('cx', pt.x);
        head.setAttribute('cy', pt.y);
        count.textContent = String(Math.round(state.p * 100)).padStart(3, '0');
      },
    });

    Promise.all([assets, draw.then()]).then(() => {
      gsap.timeline({ onComplete: () => loader.remove() })
        .to(head, { opacity: 0, duration: 0.3 })
        .to('.loader-gear', { scale: 1.3, opacity: 0, duration: 1, ease: 'power3.in' }, 0)
        .to('.loader-word', { scale: 1.5, opacity: 0, filter: 'blur(12px)', duration: 0.9, ease: 'power3.in' }, 0.1)
        .to('.loader-foot', { opacity: 0, duration: 0.4 }, 0)
        .to(loader, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 0.55)
        .add(heroIntro, 0.6);
    });
  }

  // ---------------------------------------------------------
  // Hero
  // ---------------------------------------------------------
  function setupHero() {
    $$('.hero-title .ht-text').forEach(splitChars);
    gsap.to('.hero-inner', {
      yPercent: 26, scale: 0.94, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  function heroIntro() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    gsap.timeline()
      .from('.hero-title .ch', { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.035 })
      .from('.hero-portrait img', { yPercent: 14, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.15)
      .from('.hero-left > *, .hero-right > *', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.45)
      .from('.nav', { opacity: 0, duration: 1 }, 0.3);
    ScrollTrigger.refresh();
  }

  // ---------------------------------------------------------
  // Nav — theme + active section follow whatever sits under it
  // ---------------------------------------------------------
  function setupNav() {
    const nav = $('.nav'), links = $$('.nav-links a'), pill = $('.nav-pill');
    let lastY = scrollY(), current = '';

    const movePill = (a) => {
      if (!a) { pill.style.width = '0px'; return; }
      pill.style.width = `${a.offsetWidth}px`;
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
    };

    function update() {
      const y = scrollY();
      if (!nav.classList.contains('menu-open')) {
        if (y < 80 || y < lastY - 4) nav.classList.remove('is-hidden');
        else if (y > lastY + 4) nav.classList.add('is-hidden');
      }
      lastY = y;

      const under = document.elementsFromPoint(innerWidth / 2, 34)
        .find((el) => !el.closest('.nav') && el.closest('[data-theme]'));
      if (under) nav.dataset.theme = under.closest('[data-theme]').dataset.theme;

      const mid = document.elementsFromPoint(innerWidth / 2, innerHeight / 2)
        .find((el) => el.closest('section[id], footer[id]'));
      const id = mid ? mid.closest('section[id], footer[id]').id : '';
      if (id && id !== current) {
        current = id;
        const a = links.find((l) => l.getAttribute('href') === `#${id}`);
        links.forEach((l) => l.classList.toggle('is-active', l === a));
        movePill(a);
      }
    }

    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; update(); });
    }, { passive: true });
    addEventListener('resize', debounce(() => movePill(links.find((l) => l.classList.contains('is-active'))), 150));
    update();
  }

  function setupMenu() {
    const btn = $('.menu-btn'), menu = $('.mobile-menu'), nav = $('.nav');
    btn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

    function setMenu(open) {
      menu.classList.toggle('is-open', open);
      nav.classList.toggle('menu-open', open);
      nav.classList.remove('is-hidden');
      btn.setAttribute('aria-expanded', String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open) gsap.fromTo('.mm-link', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.15 });
    }
    return setMenu;
  }

  // In-page links: pinned sections are reached through their ScrollTrigger start.
  function sectionY(id) {
    if (id === 'home') return 0;
    const st = ScrollTrigger.getById(id);
    if (st) return st.start;
    const el = document.getElementById(id);
    if (!el) return null;
    const max = document.documentElement.scrollHeight - innerHeight;
    return Math.min(max, el.getBoundingClientRect().top + scrollY());
  }

  function setupAnchors(setMenu) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      e.preventDefault();
      setMenu(false);
      if (a.dataset.project) return goToProject(a.dataset.project);
      if (a.dataset.tool) return goToTool(TOOLS.findIndex((t) => t.name === a.dataset.tool));
      const y = sectionY(id);
      if (y !== null) scrollToY(y);
    });
  }

  // ---------------------------------------------------------
  // About — flow field, light beam, robot arm, expanding card
  // ---------------------------------------------------------
  function createFlow(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, parts = [], vort = [], frame = 0;

    const spawn = (p = {}) => Object.assign(p, { x: rand(-20, w + 20), y: rand(-20, h + 20), life: rand(70, 240), age: 0 });

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050506';
      ctx.fillRect(0, 0, w, h);
      const m = Math.min(w, h);
      // Point vortices on a slow stream — potential flow, drawn like brush strokes.
      vort = [
        { x: 0.2, y: 0.3, rc: 0.17, g: 1.0 },
        { x: 0.75, y: 0.22, rc: 0.13, g: -0.9 },
        { x: 0.52, y: 0.64, rc: 0.21, g: 0.8 },
        { x: 0.9, y: 0.76, rc: 0.12, g: -1.0 },
        { x: 0.08, y: 0.84, rc: 0.1, g: -0.8 },
        { x: 0.42, y: 0.1, rc: 0.08, g: 1.1 },
      ].map((v) => ({ x: v.x * w, y: v.y * h, rc2: (v.rc * m) ** 2, G: v.g * v.rc * m * 5 }));
      parts = Array.from({ length: Math.min(2600, Math.round((w * h) / 640)) }, () => spawn());
    }

    function step() {
      if (!w) return;
      frame++;
      ctx.fillStyle = 'rgba(5,5,6,0.05)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const wave = frame * 0.004;
      for (const p of parts) {
        let vx = 0.55, vy = 0.14 * Math.sin(p.x * 0.006 + wave);
        for (const v of vort) {
          const dx = p.x - v.x, dy = p.y - v.y;
          const s = v.G / (dx * dx + dy * dy + v.rc2);
          vx -= dy * s; vy += dx * s;
        }
        ctx.moveTo(p.x, p.y);
        p.x += vx; p.y += vy;
        ctx.lineTo(p.x, p.y);
        if (++p.age > p.life || p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) spawn(p);
      }
      ctx.stroke();
    }

    new ResizeObserver(debounce(resize, 120)).observe(canvas);
    return { step };
  }

  function setupAbout() {
    const sec = $('.about'), card = $('.about-card'), scene = $('.about-scene'), content = $('.about-content');

    const field = $('.dust-field');
    for (let i = 0; i < 30; i++) {
      const d = document.createElement('span');
      d.className = 'dust';
      d.style.left = `${rand(36, 68)}%`;
      d.style.top = `${rand(6, 74)}%`;
      d.style.setProperty('--d', `${rand(6, 13)}s`);
      d.style.setProperty('--dl', `${-rand(0, 13)}s`);
      d.style.setProperty('--dx', `${rand(-70, 20)}px`);
      d.style.setProperty('--dy', `${rand(30, 120)}px`);
      d.style.setProperty('--o', rand(0.25, 0.9).toFixed(2));
      field.appendChild(d);
    }

    // Card sizes: small portrait card → wide card → full screen.
    const w1 = () => clamp(innerWidth * 0.2, 170, 300), h1 = () => w1() * 1.3;
    const w2 = () => Math.min(innerWidth * 0.58, 880), h2 = () => Math.min(innerHeight * 0.62, 560);
    const ix = (w) => () => `${Math.max(0, (innerWidth - w()) / 2)}px`;
    const iy = (h) => () => `${Math.max(0, (innerHeight - h()) / 2)}px`;

    gsap.set('.aw-l', { yPercent: -46 });
    gsap.set('.aw-r', { yPercent: 54 });
    gsap.set('.ac-reveal', { y: 40, opacity: 0 });

    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'about', trigger: sec, start: 'top top', end: () => `+=${innerHeight * 2.4}`,
        pin: true, scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: (self) => content.classList.toggle('is-live', self.progress > 0.78),
      },
    })
      .fromTo(card, { '--cx': ix(w1), '--cy': iy(h1), '--cr': '16px' }, { '--cx': ix(w2), '--cy': iy(h2), duration: 1 }, 0)
      .to('.aw-l', { x: () => -innerWidth * 0.33, duration: 1 }, 0)
      .to('.aw-r', { x: () => innerWidth * 0.36, duration: 1 }, 0)
      .fromTo(scene, { '--ss': 1.4 }, { '--ss': 1.12, duration: 1 }, 0)
      .to(card, { '--cx': '0px', '--cy': '0px', '--cr': '0px', duration: 1 }, 1)
      .to('.aw-l', { x: () => -innerWidth * 0.8, opacity: 0, duration: 1 }, 1)
      .to('.aw-r', { x: () => innerWidth * 0.8, opacity: 0, duration: 1 }, 1)
      .to(scene, { '--ss': 1, duration: 1 }, 1)
      .to('.flow', { opacity: 0.3, duration: 1 }, 1)
      .to('.ac-reveal', { y: 0, opacity: 1, stagger: 0.08, duration: 0.5 }, 1.85)
      .to({}, { duration: 0.45 });

    const flow = createFlow($('.flow'));
    const arm = {
      l1: $('.arm-l1'), l2: $('.arm-l2'), l3: $('.arm-l3'),
      ca: $('.arm-claw-a'), cb: $('.arm-claw-b'), orbit: $('.arm-orbit'),
    };
    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

    gsap.ticker.add((t) => {
      if (!visible) return;
      if (!reduceMotion) flow.step();
      const a1 = -112 + 22 * Math.sin(t * 0.55);
      const a2 = 64 + 30 * Math.sin(t * 0.8 + 1.1);
      const a3 = 26 + 34 * Math.sin(t * 1.05 + 0.4);
      const g = 9 + 11 * Math.sin(t * 1.6);
      arm.l1.setAttribute('transform', `rotate(${a1.toFixed(2)})`);
      arm.l2.setAttribute('transform', `rotate(${a2.toFixed(2)})`);
      arm.l3.setAttribute('transform', `rotate(${a3.toFixed(2)})`);
      arm.ca.setAttribute('transform', `rotate(${(-g).toFixed(2)} 20 -5)`);
      arm.cb.setAttribute('transform', `rotate(${g.toFixed(2)} 20 5)`);
      arm.orbit.setAttribute('transform', `rotate(${(t * 18).toFixed(1)})`);
    });
  }

  // ---------------------------------------------------------
  // Process — horizontal track with velocity-driven motion trails
  // ---------------------------------------------------------
  function setupProcess() {
    const sec = $('.process'), track = $('.process-track'), bar = $('.process-bar i');
    const ghostA = $('.process-ghost--a'), ghostB = $('.process-ghost--b');
    const chapters = $$('.chapter', track), tabs = $$('.process-tabs button');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    let centers = [];
    const measure = () => {
      const d = dist() || 1;
      centers = chapters.map((c) => clamp((c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2) / d, 0, 1));
    };

    let vTarget = 0, v = 0;
    const move = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      onUpdate() {
        const p = this.progress(), d = dist();
        bar.style.transform = `scaleX(${p.toFixed(4)})`;
        ghostA.style.transform = `translate3d(${(-p * d * 0.42).toFixed(1)}px,0,0)`;
        ghostB.style.transform = `translate3d(${(-d * 0.22 + p * d * 0.22).toFixed(1)}px,0,0)`;
        let best = -1, bd = 0.5 / chapters.length;
        centers.forEach((c, i) => { const dd = Math.abs(c - p); if (dd < bd) { bd = dd; best = i; } });
        tabs.forEach((t, i) => t.classList.toggle('is-active', i === best));
      },
      scrollTrigger: {
        id: 'process', trigger: sec, start: 'top top', end: () => `+=${dist()}`,
        pin: true, scrub: 0.7, invalidateOnRefresh: true,
        onRefresh: measure,
        onUpdate: (self) => { vTarget = clamp(self.getVelocity() / 110, -40, 40); },
      },
    });
    measure();

    gsap.ticker.add(() => {
      vTarget *= 0.9;
      const nv = lerp(v, vTarget, 0.14);
      if (Math.abs(nv - v) > 0.01 || Math.abs(nv) > 0.02) sec.style.setProperty('--v', nv.toFixed(2));
      v = nv;
    });

    gsap.from('.pt-intro > *', {
      y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: sec, start: 'top 65%' },
    });
    chapters.forEach((ch) => {
      const st = { trigger: ch, containerAnimation: move, start: 'left 78%', toggleActions: 'play none none reverse' };
      gsap.from($$('.ch-title span', ch), { yPercent: 70, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: st });
      gsap.from($$('.ch-meta, .ch-desc, .ch-miles li', ch), { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.15, scrollTrigger: { ...st } });
    });

    tabs.forEach((t, i) => t.addEventListener('click', () => {
      const st = move.scrollTrigger;
      scrollToY(st.start + centers[i] * (st.end - st.start));
    }));
  }

  // ---------------------------------------------------------
  // Selected work — WebGL ribbon that curves around the viewer
  // ---------------------------------------------------------
  const work = { goTo: null, open: null };

  function setupWork() {
    const sec = $('.work'), canvas = $('.ribbon');
    const N = PROJECTS.length;
    const STEP = 4.7, CW = 4.2, CH = 2.8, R = 6.4, TOTAL = STEP * N;
    const capTitle = $('.wc-title span'), capSub = $('.wc-sub'), capIdx = $('.wc-count b');
    const state = { scroll: 0, drag: 0, cur: 0, active: -1 };
    let capTl = null;

    const st = ScrollTrigger.create({
      id: 'work', trigger: sec, start: 'top top', end: () => `+=${innerHeight * 2.6}`,
      pin: true, invalidateOnRefresh: true,
      onUpdate: (self) => { state.scroll = self.progress * (N - 1) * STEP; },
    });

    function setActive(i) {
      if (i === state.active) return;
      const dir = state.active < 0 || i > state.active ? 1 : -1;
      state.active = i;
      const p = PROJECTS[i];
      capTl && capTl.kill();
      capTl = gsap.timeline()
        .to(capTitle, { yPercent: -110 * dir, opacity: 0, duration: 0.2, ease: 'power2.in' })
        .add(() => {
          capTitle.textContent = p.title;
          capSub.textContent = `${p.type} — ${p.tags.slice(0, 3).join(' · ')}`;
          capIdx.textContent = pad(i + 1);
        })
        .fromTo(capTitle, { yPercent: 110 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'expo.out' });
    }

    work.open = () => openProject(Math.max(0, state.active));
    work.goTo = (i) => {
      state.drag = 0;
      scrollToY(st.start + (i / (N - 1)) * (st.end - st.start));
    };
    $('.wc-open').addEventListener('click', work.open);

    let renderer = null;
    if (window.THREE) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch (err) { renderer = null; }
    }
    if (!renderer) return buildFallback();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const geo = new THREE.PlaneGeometry(CW, CH, 64, 16);
    const shared = { uTime: { value: 0 }, uVel: { value: 0 }, uR: { value: R } };

    const vertexShader = /* glsl */`
      uniform float uX; uniform float uR; uniform float uVel; uniform float uTime;
      varying vec2 vUv; varying float vShade;
      void main() {
        vUv = uv;
        float s = position.x + uX;                       // distance along the ribbon
        float a = clamp(s / uR, -1.45, 1.45);
        vec3 p;
        p.x = uR * sin(a);
        p.z = uR * (1.0 - cos(a));                       // edges curl towards the camera
        p.y = position.y + sin(s * 0.33 + uTime * 0.7) * 0.09 + s * 0.03;
        p.z += sin(uv.y * 3.14159) * uVel;               // the strip bows while it moves
        vShade = clamp(1.05 - abs(a) * 0.32, 0.6, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`;
    const fragmentShader = /* glsl */`
      uniform sampler2D uTex; uniform float uHover; uniform float uAspect;
      varying vec2 vUv; varying float vShade;
      float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 uv = (vUv - 0.5) * (1.0 - uHover * 0.05) + 0.5;
        vec3 col = texture2D(uTex, uv).rgb * vShade;
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float d = rbox(p, vec2(uAspect * 0.5, 0.5), 0.035);
        gl_FragColor = vec4(col, 1.0 - smoothstep(-0.003, 0.003, d));
      }`;

    const meshes = [];
    let visible = false, hovering = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const share = camera.aspect < 1 ? 0.72 : 0.42;
      const fitW = (CW / share) / 2 / (tanHalf * camera.aspect); // centre card ≈ 42% of the width (72% on phones)…
      const fitH = (CH / 0.4) / 2 / tanHalf;                     // …and ≤ 40% of the height
      const z = Math.max(fitW, fitH);
      camera.position.set(0, -z * tanHalf * 0.14, z);            // lift the ribbon above the caption
      camera.updateProjectionMatrix();
    }
    // Size from the canvas box itself: it can still be 0×0 while the page is booting.
    new ResizeObserver(resize).observe(canvas);

    // Each card is drawn in code (js/project-art.js), never loaded from an image file:
    // browsers refuse image files as WebGL textures when the page is opened from disk.
    function makeTexture(p, i) {
      const tex = new THREE.CanvasTexture(ProjectArt.card(p, i, N));
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }

    const fontsReady = document.fonts
      ? Promise.all([document.fonts.load('800 82px Outfit'), document.fonts.load('500 22px "JetBrains Mono"')]).catch(() => null)
      : Promise.resolve();
    fontsReady.then(() => {
      PROJECTS.forEach((p, i) => {
        const material = new THREE.ShaderMaterial({
          uniforms: {
            ...shared,
            uX: { value: 0 }, uHover: { value: 0 }, uAspect: { value: CW / CH },
            uTex: { value: makeTexture(p, i) },
          },
          vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        meshes.push(mesh);
      });
    });

    gsap.ticker.add((time) => {
      if (!visible || !meshes.length) return;
      const prev = state.cur;
      state.cur = lerp(state.cur, state.scroll + state.drag, 0.085);
      shared.uVel.value = lerp(shared.uVel.value, clamp((state.cur - prev) * 2.4, -1.1, 1.1), 0.2);
      shared.uTime.value = time;
      meshes.forEach((m, i) => {
        let s = i * STEP - state.cur;
        s = (((s + TOTAL / 2) % TOTAL) + TOTAL) % TOTAL - TOTAL / 2;
        m.visible = Math.abs(s) < R * 1.25;
        m.material.uniforms.uX.value = s;
        const u = m.material.uniforms.uHover;
        u.value = lerp(u.value, hovering && Math.abs(s) < STEP / 2 ? 1 : 0, 0.08);
      });
      setActive(((Math.round(state.cur / STEP) % N) + N) % N);
      renderer.render(scene, camera);
    });

    // Drag, fling, click
    const worldPerPx = () => (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) / canvas.clientWidth;
    const snap = () => { const t = state.scroll + state.drag; state.drag += Math.round(t / STEP) * STEP - t; };
    let down = false, lastX = 0, moved = 0, flick = 0;
    canvas.addEventListener('pointerdown', (e) => {
      down = true; lastX = e.clientX; moved = 0; flick = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      hovering = true;
      if (!down) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX; moved += Math.abs(dx); flick = dx;
      state.drag -= dx * worldPerPx() * 1.15;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      down = false;
      if (moved < 6) {
        const r = canvas.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
        if (fx > 0.3 && fx < 0.7) work.open();
        else state.drag += fx < 0.5 ? -STEP : STEP;
      } else {
        state.drag -= flick * worldPerPx() * 7;
      }
      snap();
    });
    canvas.addEventListener('pointercancel', () => { down = false; snap(); });
    canvas.addEventListener('pointerleave', () => { hovering = false; });
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { state.drag += STEP; snap(); }
      else if (e.key === 'ArrowLeft') { state.drag -= STEP; snap(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); work.open(); }
    });

    function buildFallback() {
      document.documentElement.classList.add('no-webgl');
      const wrap = $('.work-fallback');
      PROJECTS.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<img src="${ProjectArt.image(p)}" alt="${p.title}">`;
        b.addEventListener('click', () => openProject(i));
        wrap.appendChild(b);
      });
      setActive(0);
    }
  }

  function goToProject(key) {
    const i = PROJECTS.findIndex((p) => p.key === key);
    if (i >= 0 && work.goTo) work.goTo(i);
  }

  // ---------------------------------------------------------
  // Toolkit — a ring of cards that folds into a rotating drum
  // ---------------------------------------------------------
  const kit = { goTo: null };

  function setupKit() {
    const sec = $('.kit'), ring = $('.kit-ring'), scaleEl = $('.kit-scale'), stage = $('.kit-stage');
    const center = $('.kit-center'), label = $('.kit-label'), lName = $('.kl-name'), lCat = $('.kl-cat'), index = $('.kit-index');
    const N = TOOLS.length, STEPD = 360 / N;
    const CARD_H = 190, R2 = CARD_H / 2 / Math.tan(Math.PI / N) + 18, R1 = 280, TILT = 36;

    const cards = TOOLS.map((t, i) => {
      const el = document.createElement('article');
      el.className = 'kit-card';
      el.innerHTML = `
        <div class="kc-top mono"><span>T—${pad(i + 1)}</span><span>${t.cat}</span></div>
        <span class="kc-num" aria-hidden="true">${pad(i + 1)}</span>
        <h4 class="kc-name">${t.name}</h4>
        <p class="kc-used mono"><b>Used in →</b> ${t.used}</p>`;
      ring.appendChild(el);
      const li = document.createElement('li');
      li.textContent = t.name;
      li.addEventListener('click', () => kit.goTo(i));
      index.appendChild(li);
      return el;
    });
    const items = $$('li', index);

    const state = { m: 0, spin: 0, drag: 0, ring: 0 };
    const cur = { m: 0, spin: 0 };
    // Continuous scroll → stepped spin: each card settles in front before the next one turns in.
    const stepped = (s) => {
      const k = s / STEPD, b = Math.floor(k), f = k - b;
      const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      return (b + e) * STEPD;
    };
    const MORPH = 0.2, SPIN0 = 0.26;

    const st = ScrollTrigger.create({
      id: 'toolkit', trigger: sec, start: 'top top', end: () => `+=${innerHeight * 3.2}`,
      pin: true, invalidateOnRefresh: true,
      onUpdate(self) {
        const p = self.progress;
        state.m = clamp(p / MORPH, 0, 1);
        state.spin = stepped(clamp((p - SPIN0) / (1 - SPIN0 - 0.04), 0, 1) * (N - 1) * STEPD);
      },
    });
    kit.goTo = (i) => {
      state.drag = 0;
      scrollToY(st.start + (SPIN0 + (i / (N - 1)) * (1 - SPIN0 - 0.04)) * (st.end - st.start));
    };

    let visible = false, active = -1;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);
    const smooth = (x) => x * x * (3 - 2 * x);

    gsap.ticker.add((time, dt) => {
      if (!visible) return;
      cur.m = lerp(cur.m, state.m, 0.09);
      cur.spin = lerp(cur.spin, state.spin + state.drag, 0.09);
      const m = smooth(cur.m), im = 1 - m;
      if (!reduceMotion) state.ring += 0.12 * im * (dt / 16.7);

      const ringScale = Math.min(1, innerWidth / 820, innerHeight / 860);
      const drumScale = Math.min(1.1, innerWidth / 400, innerHeight / 920);
      scaleEl.style.setProperty('--ks', lerp(ringScale, drumScale, m).toFixed(3));

      cards.forEach((el, i) => {
        const th = i * STEPD;
        const phi = ((((cur.spin - th) + 180) % 360) + 360) % 360 - 180;
        el.style.transform =
          `rotateX(${(phi * m).toFixed(2)}deg) translateZ(${(R2 * m).toFixed(1)}px) ` +
          `rotateZ(${((th + state.ring) * im).toFixed(2)}deg) translateY(${(-R1 * im).toFixed(1)}px) ` +
          `rotateX(${(TILT * im).toFixed(2)}deg) scale(${(0.6 + 0.4 * m).toFixed(3)})`;
        el.style.opacity = (im + m * clamp(1.3 - Math.abs(phi) / 100, 0, 1)).toFixed(3);
      });

      center.style.opacity = clamp(1 - m * 1.8, 0, 1).toFixed(3);
      label.style.opacity = clamp((m - 0.45) * 2, 0, 1).toFixed(3);

      const idx = ((Math.round(cur.spin / STEPD) % N) + N) % N;
      if (idx !== active) {
        active = idx;
        lName.textContent = TOOLS[idx].name;
        lCat.textContent = TOOLS[idx].cat;
        items.forEach((li, i) => li.classList.toggle('is-active', i === idx));
        gsap.fromTo(lName, { yPercent: 50, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out', overwrite: true });
      }
    });

    let down = false, lx = 0, ly = 0;
    stage.addEventListener('pointerdown', (e) => { down = true; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (cur.m < 0.5) state.ring += dx * 0.25;
      else state.drag -= dy * 0.35;
    });
    const release = () => {
      if (!down) return;
      down = false;
      const t = state.spin + state.drag;
      state.drag += Math.round(t / STEPD) * STEPD - t;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
  }

  function goToTool(i) { if (i >= 0 && kit.goTo) kit.goTo(i); }

  // ---------------------------------------------------------
  // Focus accordion
  // ---------------------------------------------------------
  function setupFocus() {
    const items = $$('.acc-item');
    const refresh = debounce(() => ScrollTrigger.refresh(), 100);

    function toggle(item, open) {
      const body = $('.acc-body', item);
      const from = body.offsetHeight;
      item.classList.toggle('is-open', open);
      $('.acc-head', item).setAttribute('aria-expanded', String(open));
      gsap.fromTo(body, { height: from }, { height: open ? 'auto' : 0, duration: 0.75, ease: 'expo.out', overwrite: true, onComplete: refresh });
    }

    items.forEach((item) => {
      $('.acc-head', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((o) => { if (o !== item && o.classList.contains('is-open')) toggle(o, false); });
        toggle(item, open);
      });
    });

    gsap.from(splitWords($('.focus-head h2')), {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.04,
      scrollTrigger: { trigger: '.focus-head', start: 'top 80%' },
    });
    gsap.from('.acc-item', {
      y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.acc', start: 'top 88%' },
    });
  }

  // ---------------------------------------------------------
  // Contact
  // ---------------------------------------------------------
  function setupContact() {
    const talk = $('.talk');
    gsap.fromTo('.contact-inner', { yPercent: -16 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top top', scrub: true },
    });
    gsap.from('.contact-inner > *', {
      y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.contact', start: 'top 60%' },
    });

    if (finePointer && !reduceMotion) {
      gsap.set(talk, { transformPerspective: 900 });
      const rx = gsap.quickTo(talk, 'rotationX', { duration: 0.9, ease: 'power3' });
      const ry = gsap.quickTo(talk, 'rotationY', { duration: 0.9, ease: 'power3' });
      $('.contact').addEventListener('pointermove', (e) => {
        ry(((e.clientX / innerWidth) - 0.5) * 22);
        rx(-((e.clientY / innerHeight) - 0.5) * 16);
      });
      $('.contact').addEventListener('pointerleave', () => { rx(0); ry(0); });
    }

    const toast = $('.toast');
    let toastTimer;
    $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast.textContent = 'Email copied to clipboard';
      } catch (err) {
        toast.textContent = b.dataset.copy;
      }
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2200);
    }));

    $$('.year').forEach((y) => { y.textContent = new Date().getFullYear(); });
  }

  // ---------------------------------------------------------
  // Project modal
  // ---------------------------------------------------------
  const modal = $('.modal');
  function openProject(i) {
    const p = PROJECTS[i];
    if (!p) return;
    const img = $('.modal-media img');
    img.src = ProjectArt.image(p);
    img.alt = `Line drawing for ${p.title}`;
    $('.modal-file').textContent = `Project file ${pad(i + 1)} / ${pad(PROJECTS.length)} — ${p.type}`;
    $('.modal-title').textContent = p.title;
    $('.modal-desc').textContent = p.description;
    $('.modal-tags').replaceChildren(...p.tags.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
    $('.modal-link').href = p.link;
    modal.showModal();
    lenis && lenis.stop();
    gsap.fromTo('.modal-panel', { y: 50, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' });
  }
  function setupModal() {
    $('.modal-panel').setAttribute('data-lenis-prevent', '');
    modal.addEventListener('close', () => lenis && lenis.start());
    $('.modal-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
  }

  // ---------------------------------------------------------
  // Boot
  // ---------------------------------------------------------
  setupRoll();
  setupCursor();
  setupHero();
  setupNav();
  const setMenu = setupMenu();
  setupAnchors(setMenu);
  setupAbout();
  setupProcess();
  setupWork();
  setupKit();
  setupFocus();
  setupContact();
  setupModal();
  runLoader();
  addEventListener('load', () => ScrollTrigger.refresh());
})();
