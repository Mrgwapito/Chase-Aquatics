// utils/logAdminAction.js
const AdminLog = require('../models/AdminLog');

// Build preset, human-friendly messages based on category/action/meta
function buildMessage({ category, action, target = {}, meta = {} }) {
  switch (category) {
    case 'appointments': {
      const who = target?.name ? `Appointment of ${target.name}` : 'Appointment';
      if (action === 'APPT_CONFIRMED') return `${who} was confirmed.`;
      if (action === 'APPT_CANCELLED') return `${who} was cancelled.`;
      if (action === 'APPT_RESCHEDULED') {
        const { fromDate, fromTime, toDate, toTime } = meta || {};
        return `${who} was rescheduled from ${fromDate} ${fromTime} to ${toDate} ${toTime}.`;
      }
      break;
    }

    case 'orders': {
      const order = target?.id ? `Order ${target.id}` : 'Order';
      if (action === 'ORDER_CONFIRMED') return `${order} was confirmed.`;
      if (action === 'ORDER_MARKED_PAID') return `${order} was marked as Paid.`;
      if (action === 'ORDER_COMPLETED') return `${order} was completed.`;
      if (action === 'ORDER_CANCELLED') return `${order} was cancelled.`;
      break;
    }

    case 'inventory': {
      const name = target?.name ? `“${target.name}”` : 'a product';
      if (action === 'PRODUCT_ADDED') return `Added product ${name}.`;
      if (action === 'PRODUCT_DELETED') return `Deleted product ${name}.`;
      if (action === 'PRODUCT_UPDATED') {
        const changes = [];
        if (meta?.priceChanged)
          changes.push(`price: ${meta.oldPrice} → ${meta.newPrice}`);
        if (meta?.stockChanged)
          changes.push(`stock: ${meta.oldStock} → ${meta.newStock}`);
        if (changes.length) return `Updated ${name} (${changes.join(', ')}).`;
        return `Updated product ${name}.`;
      }
      break;
    }
  }
  return `${category}/${action}`;
}

async function logAdminAction(req, { category, action, target = {}, meta = {} }) {
  const admin = {
    id: req.user?._id?.toString?.() || '',
    name: req.user?.name || 'Admin',
    email: req.user?.email || '',
  };

  const message = buildMessage({ category, action, target, meta });

  return AdminLog.create({
    category,
    action,
    admin,
    target,
    message,
    meta,
  });
}

module.exports = { logAdminAction };
