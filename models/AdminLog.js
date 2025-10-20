// models/AdminLog.js
const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['appointments', 'orders', 'inventory'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        // appointments
        'APPT_CONFIRMED',
        'APPT_RESCHEDULED',
        'APPT_CANCELLED',

        // orders
        'ORDER_CONFIRMED',
        'ORDER_MARKED_PAID',
        'ORDER_COMPLETED',
        'ORDER_CANCELLED',

        // inventory
        'PRODUCT_ADDED',
        'PRODUCT_UPDATED',
        'PRODUCT_DELETED',
      ],
      required: true,
      index: true,
    },

    // who did it
    admin: {
      id: String,
      name: String,
      email: String,
    },

    // what object was touched
    target: {
      type: {
        type: String, // 'appointment' | 'order' | 'product'
      },
      id: String,
      name: String, // e.g., customer name, product title
    },

    // human-readable summary (shown in table)
    message: { type: String, required: true },

    // full details for modal (diffs, old/new values, etc.)
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

AdminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', AdminLogSchema);
