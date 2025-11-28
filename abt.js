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
      .then(r => {
        if (r.ok) {
          // Show success toast instead of popup
          if (typeof showToast !== 'undefined') {
            showToast({
              title: 'Success',
              message: 'Message sent successfully!',
              type: 'success',
              duration: 3000,
              position: 'top'
            });
          } else if (typeof Toast !== 'undefined' && Toast.showToast) {
            // Fallback if using global Toast object
            Toast.showToast({
              title: 'Success',
              message: 'Message sent successfully!',
              type: 'success',
              duration: 3000,
              position: 'top'
            });
          }
          contactForm.reset();
        } else {
          alert('There was a problem sending the message.');
        }
      })
      .catch(() => alert('An error occurred.'));
  });
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


// --- office photo ↔ map auto toggle (pauses when user interacts) ---
document.addEventListener('DOMContentLoaded', () => {
  const officeMedia = document.querySelector('.office-media');
  const mapFrame   = officeMedia?.querySelector('.office-map iframe');
  if (!officeMedia || !mapFrame) return;

  // change this value if you want slower/faster swap
  const ROTATION_DELAY = 6000;   // ms between swaps (3 seconds)
  const IDLE_BEFORE_RESUME = 20000; // 20 seconds no interaction

  let showingMap = false;
  let rotationTimer = null;
  let idleTimer = null;
  let userInteracting = false;

  function applyState() {
    officeMedia.classList.toggle('show-map', showingMap);
  }

  function startRotation() {
    if (rotationTimer) return; // already running
    rotationTimer = setInterval(() => {
      if (userInteracting) return; // don't change while user is active
      showingMap = !showingMap;
      applyState();
    }, ROTATION_DELAY);
  }

  function stopRotation() {
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  function scheduleResume() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      userInteracting = false;
      startRotation();
    }, IDLE_BEFORE_RESUME);
  }

  function handleUserInteract() {
    // user touched / dragged / scrolled the map
    userInteracting = true;
    stopRotation();

    // make sure the map stays visible while they interact
    showingMap = true;
    applyState();

    // if they stop interacting for 20s, resume auto-rotation
    scheduleResume();
  }

  // listen for various interactions on the iframe (drag, scroll, touch)
  ['pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(evt => {
    mapFrame.addEventListener(evt, handleUserInteract, { passive: true });
  });

  // start the auto-rotation on load
  startRotation();
});

