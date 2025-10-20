// ================================================================
// 🌊 CHASE AQUATICS — BOOKING SYSTEM FRONTEND (booking.js)
// ================================================================

const BACKEND_URL =
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "http://localhost:3000";

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

  // Default to today when opened
  if (!datePicker.value) {
    datePicker.value = toTodayISO();
  }

  // ✅ Always refresh times when opening modal
  fetchAndRenderAvailability(datePicker.value);
}

function closeBookingModal() {
  bookingModal.hidden = true;
  document.body.style.overflow = "";

  // 🧹 Reset all buttons for next open
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

// Automatically refresh when modal is shown again
const observer = new MutationObserver(() => {
  if (!bookingModal.hidden) {
    const currentDate = datePicker.value || toTodayISO();
    fetchAndRenderAvailability(currentDate);
  }
});
observer.observe(bookingModal, { attributes: true, attributeFilter: ["hidden"] });

// ========== HELPER FUNCTIONS ==========
function toTodayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Convert various time formats → HH:mm (24h)
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
  timesList.style.opacity = "0.5"; // subtle loading indicator

  try {
    document.querySelector("[data-times-date]").textContent = dateISO || "—";

    // Reset all time buttons
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

    // Hide booked or past slots
    timesBtns.forEach((btn) => {
      const t = to24h(btn.dataset.time);
      const shouldHide = taken.includes(t) || isPastTimeOnDate(dateISO, t);
      if (shouldHide) {
  btn.style.transition = "opacity 0.3s";
  btn.style.opacity = "0.3"; // faintly visible (or "0" if you prefer)
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

    // Optional: Message if all slots are gone
    const visibleSlots = Array.from(timesBtns).some((b) => !b.hidden);
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

    msgContainer.textContent = visibleSlots
      ? ""
      : "⚠️ No available time slots for this date.";
  } catch (err) {
    console.error("❌ Availability fetch error:", err);
  } finally {
    timesList.style.opacity = "1"; // restore visibility
  }
}

// ========== DATE PICKER SETUP ==========
if (datePicker) {
  datePicker.type = "date";
  datePicker.min = toTodayISO(); // prevent past days
  datePicker.addEventListener("change", (e) => fetchAndRenderAvailability(e.target.value));
}

// ========== TIME BUTTON SELECTION ==========
timesBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.hidden || btn.disabled) return;
    timesBtns.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

// ========== "OTHER" TOPIC TOGGLE ==========
if (otherCheckbox && otherTextInput) {
  otherCheckbox.addEventListener("change", (e) => {
    otherTextInput.hidden = !e.target.checked;
    if (!e.target.checked) otherTextInput.value = "";
  });
}

// ========== STEP HANDLING (Calendar → Details) ==========
const stepCalendar = document.querySelector(".step--calendar");
const stepDetails = document.querySelector(".step--details");

function proceedToDetails() {
  const selectedDate = datePicker?.value.trim();
  const selectedTimeBtn = document.querySelector(".times__btn.selected");
  const selectedTime = selectedTimeBtn ? selectedTimeBtn.dataset.time : "";

  if (!selectedDate || !selectedTime) {
    alert("⚠️ Please select both a date and a time before continuing.");
    return;
  }

  stepCalendar.hidden = true;
  stepDetails.hidden = false;
}

timesBtns.forEach((btn) => btn.addEventListener("dblclick", proceedToDetails));

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

    const bookingData = {
      name: document.getElementById("guestName").value.trim(),
      email: document.getElementById("guestEmail").value.trim(),
      guests: document.querySelector("[name='guests']").value.trim(),
      date: datePicker.value.trim(),
      time: selectedTime,
      notes: document.getElementById("notes").value.trim(),
      topics,
    };

    if (
      !bookingData.name ||
      !bookingData.email ||
      !bookingData.date ||
      !bookingData.time ||
      bookingData.topics.length === 0
    ) {
      alert("⚠️ Please complete all required fields before submitting.");
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
        alert("✅ Appointment booked successfully!");

        // ✅ Immediately refresh availability for this date
        await fetchAndRenderAvailability(bookingData.date);

        // Reset form fields & UI
        stepDetailsForm.reset();
        document.querySelector("[data-times-date]").textContent = bookingData.date;
        timesBtns.forEach((b) => b.classList.remove("selected"));
        topics = [];

        // Return to calendar view
        stepCalendar.hidden = false;
        stepDetails.hidden = true;

        closeBookingModal(); // you can comment this line to keep the modal open
      } else {
        alert("❌ Failed: " + data.message);
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      alert("⚠️ Failed to connect to backend. Please try again.");
    }
  });
}

// ========== ACCESSIBILITY ENHANCEMENTS ==========
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !bookingModal.hidden) {
    closeBookingModal();
  }
});

console.log("🌊 Booking module loaded successfully!");
