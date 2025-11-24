// models/orderModel.js
const mongoose = require("mongoose");

/* ===========================
   Cart / Order Item Subschema
   =========================== */
const OrderItemSchema = new mongoose.Schema(
  {
    // local cart row id (galing sa frontend)
    _id: { type: String, required: true },

    // real product id (numeric or ObjectId or string)
    productId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // variant identifier (ginagamit sa per-variant stock)
    variantSku: {
      type: String,
      default: "",
    },

    // buong variant object (sku, options, stock, etc.)
    variant: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    title:       { type: String, default: "" },
    price:       { type: Number, default: 0 },
    image:       { type: String, default: "" },
    description: { type: String, default: "" },
    quantity:    { type: Number, default: 1 },
  },
  { _id: false }
);

/* =====================
   Main Order Schema
   ===================== */
const orderSchema = new mongoose.Schema(
  {
    // owner of the order
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // human-friendly order code
    orderId: {
      type: String,
      unique: true,
      default: () =>
        `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    },

    // customer info
    name: String,
    email: String,
    phone: String,

    // legacy flat address (for display/emails)
    address: String,

    // structured shipping address (ginagamit ng server.js)
    shippingAddress: {
      addressLine1: { type: String, default: "" },
      barangay:     { type: String, default: "" },
      city:         { type: String, default: "" },
      province:     { type: String, default: "" },
      region:       { type: String, default: "" },
      postalCode:   { type: String, default: "" },
    },

    // cart from frontend
    cart: {
      type: [OrderItemSchema],
      default: [],
    },

    // totals
    subtotal:    { type: Number, default: 0 },
    shipping:    { type: Number, default: 100 },
    totalAmount: { type: Number, default: 0 },

    // payment + fulfillment (admin table reads paymentMethod)
    paymentMethod: {
      type: String,
      enum: ["COD", "GCash", "Bank"],
      default: "COD",
    },

    paymentMeta: {
      amountSent: Number,
      receiptUrl: String,
    },

    codLandmark: String,

    fulfillment: {
      type: String,
      enum: ["Delivery", "Pickup"],
      default: "Delivery",
    },

    // order status + stock restore flag
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Out for delivery",
        "Paid",
        "Completed",
        "Cancelled",
        "Canceled",
      ],
      default: "Pending",
    },

    // para hindi paulit-ulit mag-add ng stock pag cancel
    stockRestored: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
