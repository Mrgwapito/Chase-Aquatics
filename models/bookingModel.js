const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true },
    email:  { type: String, required: true },
    guests: { type: [String], default: [] },

    // Store as strings as you do now (server normalizes to "HH:mm")
    date:   { type: String, required: true }, // "YYYY-MM-DD"
    time:   { type: String, required: true }, // "HH:mm"

    notes:  { type: String, default: "" },
    topics: { type: [String], default: [], required: true },

    // ✅ Add status so updates persist
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Cancelled", "Rescheduled"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true } // adds createdAt/updatedAt automatically
);

module.exports = mongoose.model("Booking", bookingSchema);
