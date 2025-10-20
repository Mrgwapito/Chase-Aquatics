const boxes = document.querySelectorAll(".box");
const nextBtn = document.querySelector(".next");
const prevBtn = document.querySelector(".previous");

if (boxes.length && nextBtn && prevBtn) {
  let currentPage = 0;
  let boxesPerPage = getBoxesPerPage();

  function getBoxesPerPage() {
    const width = window.innerWidth;
    if (width <= 600) return 1;
    if (width <= 898) return 2;
    if (width <= 1200) return 3;
    return 4;
  }

  function updateView() {
    boxes.forEach((box) => {
      box.style.display = "none";
    });

    const start = currentPage * boxesPerPage;
    const end = start + boxesPerPage;

    boxes.forEach((box, index) => {
      if (index >= start && index < end) {
        box.style.display = "block";
      }
    });

    prevBtn.style.display = currentPage === 0 ? "none" : "block";


    if (end >= boxes.length) {
      nextBtn.style.display = "none";
    } else {
      nextBtn.style.display = "block";
    }
  }

  nextBtn.addEventListener("click", function () {
    if ((currentPage + 1) * boxesPerPage < boxes.length) {
      currentPage++;
      updateView();
    }
  });

  prevBtn.addEventListener("click", function () {
    if (currentPage > 0) {
      currentPage--;
      updateView();
    }
  });

  

  updateView(); 
}
  const slides = document.querySelectorAll('.slide');
  let index = 0;

  function showSlide() {
    slides.forEach((slide, i) => {
      slide.classList.remove('active');
      if (i === index) {
        slide.classList.add('active');
      }
    });

    index = (index + 1) % slides.length;
  }


  
  showSlide(); 
  setInterval(showSlide, 4000); 

    const toggleBtn = document.querySelector('.nav-toggle');
  const navlinks = document.getElementById('navlinks');

  if (toggleBtn && navlinks) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navlinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

(() => {
  // Open
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open="bookingModal"]');
    if (!opener) return;
    e.preventDefault();

    const m = document.getElementById('bookingModal');
    if (!m) return;

    m.hidden = false;
    document.body.style.overflow = 'hidden';

    // set the heading date to today initially
    const timesDateEl = m.querySelector('[data-times-date]');
    if (timesDateEl) {
      const d = new Date();
      timesDateEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
  });

  // Close (X, backdrop, Esc)
  function closeBooking(){
    const m = document.getElementById('bookingModal');
    if (!m) return;
    m.hidden = true;
    document.body.style.overflow = '';
  }
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]') || e.target.classList.contains('modal__backdrop')) closeBooking();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBooking(); });

  // Calendar
  let selectedDate = new Date();
  const summaryWhen = document.querySelector('[data-summary-when]');
  const calendarStep = document.querySelector('[data-step="calendar"]');
  const detailsStep  = document.querySelector('[data-step="details"]');
  const timesDateEl  = document.querySelector('[data-times-date]');

  const fp = flatpickr('#datePicker', {
    inline: true,
    dateFormat: 'Y-m-d',
    altInput: false,
    minDate: 'today',
    disableMobile: true,
    defaultDate: selectedDate,
    onChange(dates){
      if (!dates.length) return;
      selectedDate = dates[0];
      if (timesDateEl){
        timesDateEl.textContent = selectedDate.toLocaleDateString('en-US',
          { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      }
    }
  });

  // Times click
  const timesList = document.querySelector('.times__list');
  if (timesList){
    timesList.addEventListener('click', (e) => {
      const btn = e.target.closest('.times__btn');
      if (!btn) return;
      const start = btn.textContent.trim();
      const end   = addOneHour(start);
      const d     = selectedDate || fp.selectedDates[0] || new Date();

      if (summaryWhen){
        summaryWhen.textContent = `${start} – ${end}, ${d.toLocaleDateString('en-US',
          { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`;
      }
      calendarStep.hidden = true;
      detailsStep.hidden  = false;
    });
  }

  function addOneHour(label){
    const m = /(\d{1,2}):00\s*(am|pm)/i.exec(label);
    if (!m) return label;
    let h = parseInt(m[1], 10);
    let ap = m[2].toLowerCase();
    h += 1;
    if (h === 12) ap = (ap === 'am') ? 'pm' : 'am';
    if (h > 12) h = 1;
    return `${h}:00${ap}`;
  }
})();
  (function () {
    const otherToggle = document.querySelector('[data-other-toggle]');
    const otherInput  = document.querySelector('.other__input');
    if (!otherToggle || !otherInput) return;

    function syncOther() {
      otherInput.hidden = !otherToggle.checked;
      if (otherToggle.checked) otherInput.focus();
    }

    otherToggle.addEventListener('change', syncOther);
    // in case browser restores form state
    window.addEventListener('pageshow', syncOther);
  })();





