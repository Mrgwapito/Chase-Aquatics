const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  email:  { type: String, required: true },
  guests: { type: [String], default: [] },

  // NEW: what service was chosen (e.g., "Aquascaping")
  service: { type: String, default: "General Consultation", index: true },

  date:   { type: String, required: true }, // "YYYY-MM-DD"
  time:   { type: String, required: true }, // "HH:mm"

  notes:  { type: String, default: "" },
  topics: { type: [String], default: [], required: true },

  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Cancelled", "Rescheduled"],
    default: "Pending",
    index: true,
  },
}, { timestamps: true });


module.exports = mongoose.model("Booking", bookingSchema);
