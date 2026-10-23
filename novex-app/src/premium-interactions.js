const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function initHeaderMotion() {
  const header = document.querySelector('.topbar');
  if (!header) return;
  let previousY = window.scrollY;
  let scheduled = false;
  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    header.classList.toggle('is-scroll-up', y < previousY && y > 80);
    header.classList.toggle('is-scroll-down', y > previousY && y > 120);
    previousY = y;
    scheduled = false;
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

function initReveal() {
  const targets = document.querySelectorAll(
    '.hero, .page-heading, .panel, .preview-panel, .projects-grid, .library-grid, .step-progress, .analysis-panel'
  );
  if (!targets.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('motion-visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('motion-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
  targets.forEach((el, index) => {
    el.classList.add('motion-reveal');
    el.style.setProperty('--reveal-delay', Math.min(index % 4, 3) * 55 + 'ms');
    observer.observe(el);
  });
}

function initButtons() {
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('button, .nav-item, a.btn');
    if (!button || button.matches(':disabled,[aria-disabled="true"]')) return;
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--ripple-x', (event.clientX - rect.left) + 'px');
    button.style.setProperty('--ripple-y', (event.clientY - rect.top) + 'px');
    button.classList.remove('motion-ripple');
    void button.offsetWidth;
    button.classList.add('motion-ripple');
    window.setTimeout(() => button.classList.remove('motion-ripple'), 650);
  }, { passive: true });

  if (!finePointer || reduceMotion) return;
  document.querySelectorAll('.btn-primary, .helper-fab').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (event.buttons) return;
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;
      button.style.setProperty('--magnetic-x', (x * 3.5).toFixed(2) + 'px');
      button.style.setProperty('--magnetic-y', (y * 3.5).toFixed(2) + 'px');
      button.style.setProperty('--pointer-x', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
      button.style.setProperty('--pointer-y', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
    });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--magnetic-x', '0px');
      button.style.setProperty('--magnetic-y', '0px');
    });
  });
}

function initHeadingMotion() {
  if (reduceMotion) return;
  document.querySelectorAll('.hero h1, .page-heading h1').forEach(heading => {
    if (heading.dataset.motionReady) return;
    heading.dataset.motionReady = 'true';
    heading.classList.add('motion-heading');
  });
}

function initMotionExperience() {
  initHeaderMotion();
  initReveal();
  initButtons();
  initHeadingMotion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMotionExperience, { once: true });
} else {
  initMotionExperience();
}
