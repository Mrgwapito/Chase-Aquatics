const buttons = document.querySelectorAll('.fil-btn');
const photos = document.querySelectorAll('.photo');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      photos.forEach(photo => {
        const category = photo.dataset.category;
        if (filter === 'all' || category === filter) {
          photo.classList.remove('hide');
        } else {
          photo.classList.add('hide');
        }
      });
    });
  });

const navbar = document.querySelector('.navbar');
const placeholder = document.querySelector('.navbar-placeholder');
const navbarHeight = navbar.offsetHeight;

window.addEventListener('scroll', () => {
    if (window.scrollY >= navbarHeight) {
        navbar.classList.add('fixed');
    } else {
        navbar.classList.remove('fixed');
    }
});

const toggleBtn = document.querySelector('.nav-toggle');
const navlinks = document.getElementById('navlinks');
if (toggleBtn && navlinks) {
  toggleBtn.addEventListener('click', () => {
    const isOpen = navlinks.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const mq = window.matchMedia('(max-width: 767px)');

  const allBtn   = document.querySelector('.fil-btn[data-filter="all"]');
  const aquaBtn  = document.querySelector('.fil-btn[data-filter="aquascaping"]');
  const buttons  = Array.from(document.querySelectorAll('.fil-btn'));
  const photos   = Array.from(document.querySelectorAll('.gallery .photo'));

  function limitVisible(n) {
    // rely on your existing filter: items hidden by it usually get a class like "hide"
    const visible = photos.filter(p => !p.classList.contains('hide'));
    // show only first n of the currently visible items
    visible.forEach((p, i) => p.style.display = i < n ? '' : 'none');
    // make sure filtered-out items don't keep inline display:none
    photos.filter(p => p.classList.contains('hide')).forEach(p => p.style.display = '');
  }

  function clearInline() {
    photos.forEach(p => p.style.display = '');
  }

  function afterFilterClick() {
    // Let the main filter code run first, then limit
    setTimeout(() => limitVisible(4), 0);
  }

  function enhanceMobile(on) {
    if (on) {
      if (allBtn) allBtn.style.display = 'none';

      // If "All" is currently active, switch to Aquascaping as default
      const active = document.querySelector('.fil-btn.active');
      if (active && active.dataset.filter === 'all' && aquaBtn) {
        aquaBtn.click(); // triggers your existing filter behavior
      }

      limitVisible(4);
      // Re-apply the “limit 4” after any category click
      buttons.forEach(btn => btn.addEventListener('click', afterFilterClick));
    } else {
      // Restore desktop behavior
      if (allBtn) allBtn.style.display = '';
      clearInline();
      buttons.forEach(btn => btn.removeEventListener('click', afterFilterClick));
    }
  }

  // react to window resize between mobile/desktop
  if (mq.addEventListener) {
    mq.addEventListener('change', e => enhanceMobile(e.matches));
  } else {
    // Safari/old
    mq.addListener(e => enhanceMobile(e.matches));
  }

  // initialize for current viewport
  enhanceMobile(mq.matches);
});
