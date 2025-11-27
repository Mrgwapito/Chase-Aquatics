// ================================================================
// 🌊 CHASE AQUATICS — BOOKING SYSTEM FRONTEND (booking.js)
// ================================================================

const BACKEND_URL =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:3000"                 // local dev
    : "https://chase-aquatics.onrender.com";  // deployed backend


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

    // ✅ single fetch only
    const res  = await fetch(`${BACKEND_URL}/api/bookings/availability?date=${encodeURIComponent(dateISO)}`);
    const data = await res.json();

    const taken        = data?.success ? (data.taken || []).map(to24h) : [];
    const closedAllDay = !!data.closedAllDay;
    const closedRanges = Array.isArray(data.closedRanges)
      ? data.closedRanges.map(r => ({ start: to24h(r.start), end: to24h(r.end) }))
      : [];

    const inClosedRange = (hhmm) => closedRanges.some(r => (hhmm >= r.start && hhmm < r.end));

    const warn = document.querySelector(".no-slots-msg") || (() => {
      const m = document.createElement("p");
      m.className = "no-slots-msg";
      m.style.color = "#c00";
      m.style.fontSize = "0.9rem";
      m.style.marginTop = "10px";
      document.querySelector(".times__list").after(m);
      return m;
    })();

    if (closedAllDay) {
      // Whole day closed
      timesBtns.forEach((btn) => {
        btn.style.opacity = "0.3";
        btn.style.pointerEvents = "none";
        btn.disabled = true;
        btn.classList.add("booked-slot");
      });
      warn.textContent = "⚠️ Shop is closed for the whole day.";
    } else {
      // Partial closures + taken + past
      let anyEnabled = false;
      timesBtns.forEach((btn) => {
        const t = to24h(btn.dataset.time);
        const disabled = taken.includes(t) || inClosedRange(t) || isPastTimeOnDate(dateISO, t);
        btn.style.transition = "opacity 0.3s";
        btn.style.opacity = disabled ? "0.3" : "1";
        btn.style.pointerEvents = disabled ? "none" : "auto";
        btn.disabled = disabled;
        btn.classList.toggle("booked-slot", disabled);
        if (!disabled) anyEnabled = true;
      });
      warn.textContent = anyEnabled ? "" : "⚠️ No available time slots for this date.";
    }
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
// ========== FORM SUBMISSION (WITH RECAPTCHA) ==========
if (stepDetailsForm) {
  stepDetailsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 🔐 reCAPTCHA validation
    if (typeof grecaptcha === "undefined") {
      notify({
        title: "Error",
        message: "reCAPTCHA failed to load. Please refresh the page.",
        type: "error",
        duration: 5000,
        position: "top",
      });
      return;
    }

    const recaptchaResponse = grecaptcha.getResponse();
    if (!recaptchaResponse) {
      notify({
        title: "Verification Required",
        message: "Please complete the reCAPTCHA verification.",
        type: "warning",
        duration: 5000,
        position: "top",
      });
      return;
    }

    const selectedTimeBtn = document.querySelector(".times__btn.selected");
    const selectedTime = selectedTimeBtn ? selectedTimeBtn.dataset.time : "";

    let topics = Array.from(
      document.querySelectorAll("input[name='topic']:checked")
    ).map((i) => i.value);

    if (otherCheckbox?.checked && otherTextInput?.value.trim()) {
      topics.push(otherTextInput.value.trim());
    }

    // service from hidden field (defaults if missing)
    const service =
      document.getElementById("serviceField")?.value || "General Consultation";

    // guests array (email list)
    const guestsRaw =
      document.querySelector("[name='guests']")?.value.trim() || "";
    const guests = guestsRaw
      ? guestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // ✅ INCLUDE reCAPTCHA TOKEN SA DATA PAPUNTANG BACKEND
    const bookingData = {
      name: document.getElementById("guestName").value.trim(),
      email: document.getElementById("guestEmail").value.trim(),
      guests,
      date: datePicker.value.trim(),
      time: selectedTime,
      notes: document.getElementById("notes").value.trim(),
      topics,
      service,
      recaptchaToken: recaptchaResponse, // <-- IMPORTANT
    };

    if (
      !bookingData.name ||
      !bookingData.email ||
      !bookingData.date ||
      !bookingData.time ||
      bookingData.topics.length === 0
    ) {
      notify({
        title: "Incomplete form",
        message: "Please complete all required fields before submitting.",
        type: "warning",
        duration: 5000,
        position: "top",
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
        // ✅ reset reCAPTCHA after successful booking
        try {
          grecaptcha.reset();
        } catch (err) {
          console.warn("Could not reset reCAPTCHA:", err);
        }

        // === send confirmation email to customer via EmailJS (frontend) ===
        try {
          if (typeof emailjs !== "undefined") {
            await emailjs.send("service_2bfbogr", "template_aa2rtu7", {
              to_name: bookingData.name,
              to_email: bookingData.email,

              brand: "Life in a Box",
              submitted_at: new Date().toLocaleString(),

              service: bookingData.service || "General Consultation",
              date: bookingData.date,
              time: to24h(bookingData.time),

              location:
                "Paseo de Carmona, Unit 8 Lot E/F Paseo Square, Governor's Dr, Carmona, 4116 Cavite",

              topics: bookingData.topics.join(", "),
              notes: bookingData.notes || "",
              guests: bookingData.guests.join(", "),
              appointment_url: "",
            });
            console.log("✅ Appointment confirmation email sent to customer");
          } else {
            console.warn("⚠️ emailjs is not available on window");
          }
        } catch (err) {
          console.error("❌ Error sending customer appointment email:", err);
        }

        // === send notification email to admin via EmailJS (frontend) ===
        try {
          if (typeof emailjs !== "undefined") {
            await emailjs.send("service_2bfbogr", "template_aa2rtu7", {
              to_name: "Chase Aquatics Admin",
              to_email: "chaseaquatics@gmail.com",

              brand: "Life in a Box",
              submitted_at: new Date().toLocaleString(),

              service: bookingData.service || "General Consultation",
              date: bookingData.date,
              time: to24h(bookingData.time),

              location:
                "Paseo de Carmona, Unit 8 Lot E/F Paseo Square, Governor's Dr, Carmona, 4116 Cavite",

              topics: bookingData.topics.join(", "),
              notes: bookingData.notes || "",
              guests: bookingData.guests.join(", "),
              appointment_url: "",
            });
            console.log("✅ Appointment notification email sent to admin");
          }
        } catch (err) {
          console.error("❌ Error sending admin appointment email:", err);
        }

        notify({
          title: "Success",
          message: "Appointment booked successfully!",
          type: "success",
          duration: 2200,
          position: "br",
        });

        // refresh availability immediately
        await fetchAndRenderAvailability(bookingData.date);

        // reset fields & UI
        stepDetailsForm.reset();
        document.querySelector("[data-times-date]").textContent =
          bookingData.date;
        timesBtns.forEach((b) => b.classList.remove("selected"));

        // go back to calendar
        stepCalendar.hidden = false;
        stepDetails.hidden = true;

        // reset service to default
        const selectedServiceEl =
          document.getElementById("selectedService");
        const serviceField = document.getElementById("serviceField");
        if (selectedServiceEl)
          selectedServiceEl.textContent = "General Consultation";
        if (serviceField) serviceField.value = "General Consultation";

        closeBookingModal();
      } else {
        notify({
          title: "Booking failed",
          message: data.message || "Something went wrong.",
          type: "error",
          duration: 6000,
          position: "top",
        });
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      notify({
        title: "Network error",
        message: "Failed to connect to backend. Please try again.",
        type: "error",
        duration: 6000,
        position: "top",
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


// ================================================================
// 📧 EMAILJS — APPOINTMENT CONFIRMATION TEMPLATE
//    Uses template_aa2rtu7 (your appointment HTML code editor)
// ================================================================
async function sendAppointmentEmail({
  toEmail,
  toName,
  date,
  time,
  service,
  topics,
  notes,
  guests,
  appointmentUrl
}) {
  const EMAILJS_SERVICE_ID = "service_2bfbogr";      // ✅ same as OTP
  const EMAILJS_PUBLIC_KEY = "hhTpOoi07kd04LwsH";   // ✅ same as OTP
  const EMAILJS_TEMPLATE_ID = "template_aa2rtu7";   // ✅ your appointment template

  const safeName = toName || (toEmail ? toEmail.split("@")[0] : "Guest");

  const templateParams = {
    // must match variables you used in the EmailJS template
    to_name: safeName,
    to_email: toEmail,

    brand: "Life in a Box", // or "Chase Aquatics" if you prefer
    submitted_at: new Date().toLocaleString(),

    service: service || "General Consultation",
    date,
    time,

    // hard-coded shop address (matches your site footer)
    location:
      "Paseo de Carmona, Unit 8 Lot E/F Paseo Square, Governor's Dr, Carmona, 4116 Cavite",

    topics: Array.isArray(topics) ? topics.join(", ") : (topics || ""),
    notes: notes || "",
    guests: Array.isArray(guests) ? guests.join(", ") : (guests || ""),

    appointment_url: appointmentUrl || ""
  };

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: templateParams
  };

  try {
    console.log("📨 Sending appointment email via EmailJS:", {
      toEmail,
      template: EMAILJS_TEMPLATE_ID
    });

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log("📨 Appointment EmailJS status:", response.status, text);

    return response.ok;
  } catch (err) {
    console.error("❌ Appointment EmailJS error:", err.message);
    return false;
  }
}
