/* Page bits: top bar, portrait switch, copy email, year. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Top bar: hairline once you leave the hero; mark the section you're in.
  const bar = $('.bar');
  const links = $$('.bar-nav a');
  addEventListener('scroll', () => bar.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.toggle('is-here', a.getAttribute('href') === `#${e.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => spy.observe(s));

  // Portrait: plotted lines or the photo
  const portrait = $('.portrait');
  $$('[data-portrait]').forEach((b) => b.addEventListener('click', () => {
    portrait.dataset.mode = b.dataset.portrait;
    $$('[data-portrait]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));

  // Copy email
  const toast = $('.toast');
  let tt;
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast.textContent = 'Email copied'; }
    catch (e) { toast.textContent = b.dataset.copy; }
    toast.classList.add('is-on'); clearTimeout(tt);
    tt = setTimeout(() => toast.classList.remove('is-on'), 2000);
  }));

  $$('.year').forEach((y) => { y.textContent = new Date().getFullYear(); });
})();
