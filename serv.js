// ===================== FILTER BUTTONS (Gallery) =====================
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

// ===================== NAVBAR (Sticky + Mobile Toggle) =====================
const navbar = document.querySelector('.navbar');
const placeholder = document.querySelector('.navbar-placeholder');
const navbarHeight = navbar ? navbar.offsetHeight : 0;

window.addEventListener('scroll', () => {
  if (!navbar) return;
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

// ===================== MOBILE: LIMIT VISIBLE GALLERY ITEMS =====================
document.addEventListener('DOMContentLoaded', () => {
  const mq = window.matchMedia('(max-width: 767px)');

  const allBtn   = document.querySelector('.fil-btn[data-filter="all"]');
  const aquaBtn  = document.querySelector('.fil-btn[data-filter="aquascaping"]');
  const buttons  = Array.from(document.querySelectorAll('.fil-btn'));
  const photos   = Array.from(document.querySelectorAll('.gallery .photo'));

  function limitVisible(n) {
    const visible = photos.filter(p => !p.classList.contains('hide'));
    visible.forEach((p, i) => p.style.display = i < n ? '' : 'none');
    photos.filter(p => p.classList.contains('hide')).forEach(p => p.style.display = '');
  }

  function clearInline() {
    photos.forEach(p => p.style.display = '');
  }

  function afterFilterClick() {
    setTimeout(() => limitVisible(4), 0);
  }

  function enhanceMobile(on) {
    if (on) {
      if (allBtn) allBtn.style.display = 'none';

      const active = document.querySelector('.fil-btn.active');
      if (active && active.dataset.filter === 'all' && aquaBtn) {
        aquaBtn.click();
      }

      limitVisible(4);
      buttons.forEach(btn => btn.addEventListener('click', afterFilterClick));
    } else {
      if (allBtn) allBtn.style.display = '';
      clearInline();
      buttons.forEach(btn => btn.removeEventListener('click', afterFilterClick));
    }
  }

  if (mq.addEventListener) {
    mq.addEventListener('change', e => enhanceMobile(e.matches));
  } else {
    mq.addListener(e => enhanceMobile(e.matches));
  }

  enhanceMobile(mq.matches);
});

// ===================== SERVICE → BOOKING MODAL PASSTHROUGH =====================
// Ensures that clicking a "Book Now" button sets the selected service in the modal.
// Prefers the real openBookingModal() from booking.js; falls back if needed.
(function serviceToBookingPassthrough() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open="bookingModal"]');
    if (!btn) return;

    const serviceName = btn.dataset.service || 'General Consultation';
    const selectedServiceEl = document.getElementById('selectedService'); // span in modal header
    const serviceField = document.getElementById('serviceField');         // hidden input in form

    if (selectedServiceEl) selectedServiceEl.textContent = serviceName;
    if (serviceField) serviceField.value = serviceName;

    if (typeof window.openBookingModal === 'function') {
      // booking.js owns the open/refresh logic
      window.openBookingModal();
    } else {
      // minimal fallback if booking.js hasn't loaded yet
      const m = document.getElementById('bookingModal');
      if (m) {
        m.hidden = false;
        document.body.style.overflow = 'hidden';
        const timesDateEl = m.querySelector('[data-times-date]');
        if (timesDateEl) {
          const d = new Date();
          timesDateEl.textContent = d.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
      }
    }
  });
})();

// ===================== (FALLBACK) SHARED BOOKING HANDLERS =====================
// Your original "booking.js — shared booking modal logic ..." block.
// Guarded so it won't collide when the real booking.js is present.
if (!window.__hasSharedBookingHandlers) {
  window.__hasSharedBookingHandlers = true;
  (() => {
    // Open modal from any trigger with data-open="bookingModal"
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open="bookingModal"]');
      if (!opener) return;
      e.preventDefault();

      // If booking.js provided a proper opener, use it instead
      if (typeof window.openBookingModal === 'function') {
        window.openBookingModal();
        return;
      }

      const m = document.getElementById('bookingModal');
      if (!m) return;

      m.hidden = false;
      document.body.style.overflow = 'hidden';

      // Set heading date to today initially
      const timesDateEl = m.querySelector('[data-times-date]');
      if (timesDateEl) {
        const d = new Date();
        timesDateEl.textContent = d.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }
    });

    // Close (X, backdrop, Esc)
    function closeBooking() {
      const m = document.getElementById('bookingModal');
      if (!m) return;
      m.hidden = true;
      document.body.style.overflow = '';
    }
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]') || e.target.classList.contains('modal__backdrop')) {
        closeBooking();
      }
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBooking(); });

    // Calendar + Steps (fallback only; booking.js should own the real flow)
    let selectedDate = new Date();
    const calendarStep = document.querySelector('[data-step="calendar"]');
    const detailsStep  = document.querySelector('[data-step="details"]');
    const timesDateEl  = document.querySelector('[data-times-date]');

    // Flatpickr (fallback)
    const fp = window.flatpickr && flatpickr('#datePicker', {
      inline: true,
      dateFormat: 'Y-m-d',
      altInput: false,
      minDate: 'today',
      disableMobile: true,
      defaultDate: selectedDate,
      onChange(dates) {
        if (!dates.length) return;
        selectedDate = dates[0];
        if (timesDateEl) {
          timesDateEl.textContent = selectedDate.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
      }
    });

    // Times click -> go to details step (fallback)
    const timesList = document.querySelector('.times__list');
    if (timesList) {
      timesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.times__btn');
        if (!btn) return;

        // If booking.js is active, let it handle transitions
        if (typeof window.openBookingModal === 'function') return;

        const start = btn.textContent.trim();
        const end   = addOneHour(start);
        const d     = selectedDate || (fp && fp.selectedDates[0]) || new Date();

        const summaryWhen = document.querySelector('[data-summary-when]');
        if (summaryWhen) {
          summaryWhen.textContent = `${start} – ${end}, ${d.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}`;
        }

        if (calendarStep) calendarStep.hidden = true;
        if (detailsStep)  detailsStep.hidden  = false;
      });
    }

    function addOneHour(label) {
      const m = /(\d{1,2}):00\s*(am|pm)/i.exec(label);
      if (!m) return label;
      let h = parseInt(m[1], 10);
      let ap = m[2].toLowerCase();
      h += 1;
      if (h === 12) ap = (ap === 'am') ? 'pm' : 'am';
      if (h > 12) h = 1;
      return `${h}:00${ap}`;
    }

    // “Other” topic toggle (fallback)
    (function () {
      const otherToggle = document.querySelector('[data-other-toggle]');
      const otherInput  = document.querySelector('.other__input');
      if (!otherToggle || !otherInput) return;

      function syncOther() {
        otherInput.hidden = !otherToggle.checked;
        if (otherToggle.checked) otherInput.focus();
      }

      otherToggle.addEventListener('change', syncOther);
      window.addEventListener('pageshow', syncOther);
    })();
  })();
}
