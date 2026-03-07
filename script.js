/* ════════════════════════════════ GALLERY LIGHTBOX */
document.addEventListener('click', function(e) {
  var item = e.target.closest('.gallery-item[data-src]');
  if (!item) return;
  var lb  = document.getElementById('lightbox');
  var img = document.getElementById('lightbox-img');
  img.src = item.dataset.src;
  lb.style.display = 'flex';
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') document.getElementById('lightbox').style.display = 'none';
});

/* ════════════════════════════════ NAV SCROLL */
const navbar  = document.getElementById('navbar');
const backTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
  backTop?.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

/* ════════════════════════════════ HAMBURGER */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
  });
});

/* ════════════════════════════════ BACK TO TOP */
backTop?.addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: 'smooth' })
);

/* ════════════════════════════════ SCROLL REVEAL */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal').forEach(el =>
  revealObserver.observe(el)
);

/* ════════════════════════════════ CAROUSEL (mobile testimonials) */
const track   = document.getElementById('carousel-track');
const dotsCtr = document.getElementById('carousel-dots');

if (track) {
  const slides = track.querySelectorAll('.testi-slide');
  let current  = 0;
  let autoTimer;

  // Build dots
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goTo(i));
    dotsCtr?.appendChild(dot);
  });

  function goTo(idx) {
    current = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    document.querySelectorAll('#carousel-dots .dot').forEach((d, i) =>
      d.classList.toggle('active', i === idx)
    );
  }

  const next = () => goTo((current + 1) % slides.length);
  const prev = () => goTo((current - 1 + slides.length) % slides.length);

  const startAuto = () => { autoTimer = setInterval(next, 4500); };
  const stopAuto  = () => { clearInterval(autoTimer); };

  startAuto();

  // Touch / swipe
  let startX = 0;
  const wrapper = document.getElementById('carousel-wrapper');

  wrapper?.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    stopAuto();
  }, { passive: true });

  wrapper?.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 48) dx < 0 ? next() : prev();
    startAuto();
  }, { passive: true });
}
