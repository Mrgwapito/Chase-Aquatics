// ================================================================
// 🌊 CHASE AQUATICS — BOOKING SYSTEM FRONTEND (booking.js)
// ================================================================

const BACKEND_URL =
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "http://localhost:3000";

// --- Toast helper (same style as login.js). Falls back to alert if toast not ready.
function notify({ title='Notice', message='', type='info', duration=2200, position='br' } = {}) {
  if (window.Toast?.showToast) {
    window.Toast.showToast({ title, message, type, duration, position });
  } else {
    alert(`${title}${message ? '\n' + message : ''}`);
  }
}

// ========== ELEMENT REFERENCES ==========
const bookingModal = document.getElementById("bookingModal");
const modalBackdrop = document.querySelector(".modal__backdrop");
const modalClose = document.querySelectorAll("[data-close]");
const datePicker = document.getElementById("datePicker");
const timesBtns = document.querySelectorAll(".times__btn");
const stepDetailsForm = document.querySelector(".step--details");
const otherCheckbox = document.querySelector("[data-other-toggle]");
const otherTextInput = document.querySelector(".other__input");

// ========== MODAL CONTROL ==========
function openBookingModal() {
  bookingModal.hidden = false;
  document.body.style.overflow = "hidden";

  // Default to today
  if (!datePicker.value) {
    datePicker.value = toTodayISO();
  }

  // Always refresh times
  fetchAndRenderAvailability(datePicker.value);
}

function closeBookingModal() {
  bookingModal.hidden = true;
  document.body.style.overflow = "";

  // Reset all buttons for next open
  timesBtns.forEach((btn) => {
    btn.hidden = false;
    btn.disabled = false;
    btn.classList.remove("selected");
    btn.style.opacity = "1";
    btn.setAttribute("aria-disabled", "false");
  });
}

modalBackdrop?.addEventListener("click", closeBookingModal);
modalClose?.forEach((btn) => btn.addEventListener("click", closeBookingModal));

// Refresh when modal becomes visible again
const observer = new MutationObserver(() => {
  if (!bookingModal.hidden) {
    const currentDate = datePicker.value || toTodayISO();
    fetchAndRenderAvailability(currentDate);
  }
});
observer.observe(bookingModal, { attributes: true, attributeFilter: ["hidden"] });

// ========== HELPERS ==========
function toTodayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Convert time → HH:mm (24h)
function to24h(t) {
  if (!t) return "";
  const s = String(t).trim().toLowerCase();

  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{1}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const m = s.match(/^(\d{1,2}):(\d{2})\s*(a|p)m$/i);
  if (m) {
    let h = parseInt(m[1], 10),
      mm = m[2],
      ap = m[3];
    if (ap === "p" && h !== 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${mm}`;
  }

  if (/^\d{1,2}$/.test(s)) return `${String(parseInt(s, 10)).padStart(2, "0")}:00`;
  return s;
}

function isPastTimeOnDate(dateISO, hhmm) {
  const todayISO = toTodayISO();
  if (dateISO !== todayISO) return false;
  const [hh, mm] = hhmm.split(":").map(Number);
  const now = new Date();
  const slot = new Date();
  slot.setHours(hh, mm, 0, 0);
  return slot <= now;
}

// ========== FETCH & RENDER AVAILABILITY ==========
async function fetchAndRenderAvailability(dateISO) {
  const timesList = document.querySelector(".times__list");
  timesList.style.opacity = "0.5";

  try {
    document.querySelector("[data-times-date]").textContent = dateISO || "—";

    // reset buttons
    timesBtns.forEach((btn) => {
      btn.classList.remove("selected");
      btn.hidden = false;
      btn.disabled = false;
      btn.setAttribute("aria-disabled", "false");
    });

    if (!dateISO) return;

    const res = await fetch(
      `${BACKEND_URL}/api/bookings/availability?date=${encodeURIComponent(dateISO)}`
    );
    const data = await res.json();
    const taken = data?.success ? (data.taken || []).map(to24h) : [];

    // Hide booked/past slots
    timesBtns.forEach((btn) => {
      const t = to24h(btn.dataset.time);
      const shouldHide = taken.includes(t) || isPastTimeOnDate(dateISO, t);
      if (shouldHide) {
        btn.style.transition = "opacity 0.3s";
        btn.style.opacity = "0.3";
        btn.style.pointerEvents = "none";
        btn.disabled = true;
        btn.classList.add("booked-slot");
      } else {
        btn.style.transition = "opacity 0.3s";
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
        btn.disabled = false;
        btn.classList.remove("booked-slot");
      }
    });

    // message if nothing left
    const visibleSlots = Array.from(timesBtns).some((b) => !b.hidden && !b.disabled);
    const msgContainer =
      document.querySelector(".no-slots-msg") ||
      (() => {
        const m = document.createElement("p");
        m.className = "no-slots-msg";
        m.style.color = "#c00";
        m.style.fontSize = "0.9rem";
        m.style.marginTop = "10px";
        document.querySelector(".times__list").after(m);
        return m;
      })();

    msgContainer.textContent = visibleSlots ? "" : "⚠️ No available time slots for this date.";
  } catch (err) {
    console.error("❌ Availability fetch error:", err);
    notify({
      title: 'Availability',
      message: 'Could not load time slots. Please try again.',
      type: 'error',
      duration: 5000,
      position: 'top'
    });
  } finally {
    timesList.style.opacity = "1";
  }
}

// ========== DATE PICKER ==========
if (datePicker) {
  datePicker.type = "date";
  datePicker.min = toTodayISO();
  datePicker.addEventListener("change", (e) => fetchAndRenderAvailability(e.target.value));
}

// ========== TIME BUTTONS (single click proceeds) ==========
timesBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.hidden || btn.disabled) return;
    timesBtns.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    proceedToDetails();
  });
});

timesBtns.forEach((btn) => {
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      btn.click();
    }
  });
});

// ========== OTHER TOPIC TOGGLE ==========
if (otherCheckbox && otherTextInput) {
  otherCheckbox.addEventListener("change", (e) => {
    otherTextInput.hidden = !e.target.checked;
    if (!e.target.checked) otherTextInput.value = "";
  });
}

// ========== STEP HANDLING ==========
const stepCalendar = document.querySelector(".step--calendar");
const stepDetails = document.querySelector(".step--details");

function proceedToDetails() {
  const selectedDate = datePicker?.value.trim();
  const selectedTimeBtn = document.querySelector(".times__btn.selected");
  const selectedTime = selectedTimeBtn ? selectedTimeBtn.dataset.time : "";

  if (!selectedDate || !selectedTime) {
    notify({
      title: 'Missing selection',
      message: 'Please select both a date and a time before continuing.',
      type: 'warning',
      duration: 5000,
      position: 'top'
    });
    return;
  }

  stepCalendar.hidden = true;
  stepDetails.hidden = false;
}

// ========== FORM SUBMISSION ==========
if (stepDetailsForm) {
  stepDetailsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedTimeBtn = document.querySelector(".times__btn.selected");
    const selectedTime = selectedTimeBtn ? selectedTimeBtn.dataset.time : "";

    let topics = Array.from(document.querySelectorAll("input[name='topic']:checked")).map(
      (i) => i.value
    );

    if (otherCheckbox?.checked && otherTextInput?.value.trim()) {
      topics.push(otherTextInput.value.trim());
    }

    // service from hidden field (defaults if missing)
    const service =
      document.getElementById("serviceField")?.value || "General Consultation";

    // guests array (email list)
    const guestsRaw = document.querySelector("[name='guests']")?.value.trim() || "";
    const guests = guestsRaw
      ? guestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const bookingData = {
      name: document.getElementById("guestName").value.trim(),
      email: document.getElementById("guestEmail").value.trim(),
      guests,
      date: datePicker.value.trim(),
      time: selectedTime,
      notes: document.getElementById("notes").value.trim(),
      topics,
      service
    };

    if (
      !bookingData.name ||
      !bookingData.email ||
      !bookingData.date ||
      !bookingData.time ||
      bookingData.topics.length === 0
    ) {
      notify({
        title: 'Incomplete form',
        message: 'Please complete all required fields before submitting.',
        type: 'warning',
        duration: 5000,
        position: 'top'
      });
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const data = await res.json();
      console.log("📩 Booking response:", data);

      if (data.success) {
        notify({
          title: 'Success',
          message: 'Appointment booked successfully!',
          type: 'success',
          duration: 2200,
          position: 'br'
        });

        // refresh availability immediately
        await fetchAndRenderAvailability(bookingData.date);

        // reset fields & UI
        stepDetailsForm.reset();
        document.querySelector("[data-times-date]").textContent = bookingData.date;
        timesBtns.forEach((b) => b.classList.remove("selected"));
        topics = [];

        // go back to calendar
        stepCalendar.hidden = false;
        stepDetails.hidden = true;

        // reset service to default
        const selectedServiceEl = document.getElementById("selectedService");
        const serviceField = document.getElementById("serviceField");
        if (selectedServiceEl) selectedServiceEl.textContent = "General Consultation";
        if (serviceField) serviceField.value = "General Consultation";

        closeBookingModal();
      } else {
        notify({
          title: 'Booking failed',
          message: data.message || 'Something went wrong.',
          type: 'error',
          duration: 6000,
          position: 'top'
        });
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      notify({
        title: 'Network error',
        message: 'Failed to connect to backend. Please try again.',
        type: 'error',
        duration: 6000,
        position: 'top'
      });
    }
  });
}

// ========== ESC closes ==========
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !bookingModal.hidden) {
    closeBookingModal();
  }
});

console.log("🌊 Booking module loaded successfully!");

// ----- Service selector -> set labels/hidden field, then open
document.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-open="bookingModal"]');
  if (!btn) return;

  const selectedServiceEl = document.getElementById("selectedService"); // span in the modal header (if present)
  const serviceField = document.getElementById("serviceField");         // hidden input in the form

  const serviceName = btn.dataset.service || "General Consultation";
  if (selectedServiceEl) selectedServiceEl.textContent = serviceName;
  if (serviceField) serviceField.value = serviceName;

  openBookingModal();
});
