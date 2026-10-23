(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  function setTheme(theme, save=false) {
    const light = theme === 'light';
    root.dataset.theme = light ? 'light' : 'dark';
    toggle.querySelector('.theme-label').textContent = light ? 'Dark' : 'Light';
    toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    toggle.setAttribute('aria-pressed', String(light));
    meta.setAttribute('content', light ? '#f2f3ef' : '#151616');
    if (save) { try { localStorage.setItem('portfolio-theme', root.dataset.theme); } catch {} }
  }
  setTheme(root.dataset.theme);
  toggle.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true));
  window.addEventListener('storage', e => { if(e.key === 'portfolio-theme') setTheme(e.newValue); });

  const bar = document.getElementById('reading-progress-bar');
  const links = [...document.querySelectorAll('.site-nav a')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  let pending = false;
  function updateReading() {
    pending = false;
    const range = Math.max(0, root.scrollHeight-window.innerHeight);
    const progress = range ? Math.min(1,Math.max(0,window.scrollY/range)) : 0;
    bar.style.transform = `scaleX(${progress})`;
    let current = -1;
    sections.forEach((section,i) => { if(section.getBoundingClientRect().top <= 150) current=i; });
    if(range && window.scrollY >= range-3) current = sections.length-1;
    links.forEach((link,i) => {
      if(i===current) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  function requestReadingUpdate() { if(!pending){pending=true;requestAnimationFrame(updateReading);} }
  window.addEventListener('scroll',requestReadingUpdate,{passive:true});
  window.addEventListener('resize',requestReadingUpdate,{passive:true});
  window.addEventListener('load',requestReadingUpdate);
  if('ResizeObserver' in window)new ResizeObserver(requestReadingUpdate).observe(document.body);
  updateReading();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let observer=null;
  const targets=[...document.querySelectorAll('.section-label, .section h2, .about-copy, .section-heading > p, .focus-grid article, .tool-row, .project-card, .contact-copy > p, .contact-links')];
  function showAll() { observer?.disconnect();targets.forEach(el=>{el.classList.remove('reveal-pending');el.classList.add('revealed');}); }
  if(!reduced.matches && 'IntersectionObserver' in window) {
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');entry.target.classList.remove('reveal-pending');observer.unobserve(entry.target);}});
    },{threshold:0,rootMargin:'0px 0px -28px 0px'});
    targets.forEach(el=>{
      // Visible and already passed content never waits for an observer callback.
      if(el.getBoundingClientRect().top<window.innerHeight-24)el.classList.add('revealed');
      else {el.classList.add('reveal-pending');observer.observe(el);}
    });
  }
  reduced.addEventListener('change',e=>{if(e.matches)showAll();});
  document.addEventListener('focusin',e=>{
    const hidden=e.target.closest('.reveal-pending');
    if(hidden){hidden.classList.remove('reveal-pending');hidden.classList.add('revealed');observer?.unobserve(hidden);}
  });
  window.addEventListener('beforeprint',showAll);
})();
