// lib/checkAvailability.js
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const Block   = require("../models/blockModel");
const Booking = require("../models/bookingModel");

// PH timezone + slot length
const TZ = "Asia/Manila";
const SLOT_MINUTES = 60;

// Build real Date objects in PH time
function buildRange(dateStr, timeStr, mins = SLOT_MINUTES) {
  const start = dayjs.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", TZ);
  if (!start.isValid()) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }
  const end = start.add(mins, "minute");
  return { startISO: start.toDate(), endISO: end.toDate(), time24: start.format("HH:mm") };
}

/**
 * Check if a slot is free.
 * @param {Object} opts
 * @param {string} opts.dateStr - "YYYY-MM-DD"
 * @param {string} opts.timeStr - "HH:mm" (24h) or "h:mm a" (we normalize)
 * @param {string} [opts.ignoreBookingId] - optional: ignore this booking (for reschedule)
 */
async function isSlotFree({ dateStr, timeStr, ignoreBookingId } = {}) {
  const { startISO, endISO, time24 } = buildRange(dateStr, timeStr);

  // 1) Admin blocks overlap check
  const overlappingBlock = await Block.findOne({
    start: { $lt: endISO },
    end:   { $gt: startISO },
  }).lean();

  if (overlappingBlock) {
    return { ok: false, reason: "blocked", block: overlappingBlock };
  }

  // 2) Booking collision (same start)
  const bookingFilter = {
    date: dateStr,
    time: time24,
    status: { $ne: "Cancelled" },
  };
  if (ignoreBookingId) bookingFilter._id = { $ne: ignoreBookingId };

  const sameStartBooking = await Booking.findOne(bookingFilter).lean();
  if (sameStartBooking) {
    return { ok: false, reason: "booked", booking: sameStartBooking };
  }

  return { ok: true };
}

module.exports = { isSlotFree, SLOT_MINUTES, TZ };
