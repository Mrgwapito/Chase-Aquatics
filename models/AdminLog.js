const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['orders', 'appointments', 'inventory', 'auth', 'system'],
    required: true
  },
  action: {
    type: String,
    enum: [
      // Orders
      'ORDER_CONFIRMED',
      'ORDER_MARKED_PAID',
      'ORDER_COMPLETED',
      'ORDER_CANCELLED',
      'ORDER_UPDATED',

      // Appointments
      'APPT_CONFIRMED',
      'APPT_CANCELLED',
      'APPT_RESCHEDULED',

      // Inventory
      'PRODUCT_CREATED',          // ← added
      'PRODUCT_UPDATED',
      'PRODUCT_DELETED'           // ← added (future use)
    ],
    required: true
  },
  message: { type: String, default: '' },
  target: {
    type: new mongoose.Schema({
      type: { type: String, default: '' },
      id:   { type: String, default: '' },
      name: { type: String, default: '' }
    }, { _id: false }),
    default: {}
  },
  admin: {
    type: new mongoose.Schema({
      id:    { type: String, default: '' },
      name:  { type: String, default: '' },
      email: { type: String, default: '' }
    }, { _id: false }),
    default: {}
  },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('AdminLog', AdminLogSchema);
