// models/blockModel.js
const mongoose = require('mongoose');

/**
 * A "Block" closes booking either for a whole day or for a specific
 * time range within that day.
 *
 * - date: YYYY-MM-DD
 * - allDay: true = whole day closed
 * - start/end: "HH:mm" 24h (required only when allDay === false)
 * - note: optional admin note
 */
const BlockSchema = new mongoose.Schema({
  date:   { type: String, required: true },       // YYYY-MM-DD
  allDay: { type: Boolean, default: true },

  start:  { type: String, default: null },        // HH:mm (when allDay=false)
  end:    { type: String, default: null },        // HH:mm (when allDay=false)

  note:   { type: String, default: '' }
}, { timestamps: true });

BlockSchema.index({ date: 1 });                   // fast day lookups

module.exports = mongoose.model('Block', BlockSchema);
