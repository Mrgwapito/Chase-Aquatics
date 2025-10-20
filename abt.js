// --- slideshow (only if present) ---
const slides = document.querySelectorAll('.slidex');
if (slides.length) {
  let index = 0;
  function showSlide() {
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    index = (index + 1) % slides.length;
  }
  showSlide();
  setInterval(showSlide, 4000);
}

// --- bootstrap carousel (already guarded) ---
document.addEventListener('DOMContentLoaded', function () {
  const carouselElement = document.querySelector('#carouselExampleSlidesOnly');
  if (carouselElement) {
    new bootstrap.Carousel(carouselElement, { interval: 3000, ride: 'carousel' });
  }
});

// --- sticky nav (safe) ---
const navbar = document.querySelector('.navbar');
if (navbar) {
  const navbarHeight = navbar.offsetHeight;
  window.addEventListener('scroll', () => {
    if (window.scrollY >= navbarHeight) navbar.classList.add('fixed');
    else navbar.classList.remove('fixed');
  });
}

// --- contact form (only on pages that have it) ---
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const data = new FormData(contactForm);
    fetch(contactForm.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(r => r.ok ? (showPopup(), contactForm.reset()) : alert('There was a problem sending the message.'))
      .catch(() => alert('An error occurred.'));
  });
}

function showPopup() {
  const popup = document.getElementById('popup');
  if (!popup) return;
  popup.style.display = 'block';
  setTimeout(() => (popup.style.display = 'none'), 3000);
}

// --- hamburger toggle (works now) ---
const toggleBtn = document.querySelector('.nav-toggle');
const navlinks = document.getElementById('navlinks');
if (toggleBtn && navlinks) {
  toggleBtn.addEventListener('click', () => {
    const isOpen = navlinks.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}
