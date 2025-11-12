// models/ordermodal.js
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },     // you already send string ids from the cart
  title: String,
  price: Number,
  image: String,
  description: String,
  quantity: Number,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  orderId: {
    type: String,
    unique: true,
    default: () => `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  },

  // customer info
  name: String,
  email: String,
  phone: String,
  address: String,

  // cart from frontend
  cart: { type: [OrderItemSchema], default: [] },

  // totals
  subtotal: { type: Number, default: 0 },
  shipping: { type: Number, default: 100 },
  totalAmount: { type: Number, default: 0 },

  // payment + fulfillment (admin table reads paymentMethod)
  paymentMethod: { type: String, enum: ["COD", "GCash", "Bank"], default: "COD" },
  paymentMeta: {
    amountSent: Number,
    receiptUrl: String
  },
  codLandmark: String,
  fulfillment: { type: String, enum: ["Delivery", "Pickup"], default: "Delivery" },

  status: { type: String, enum: ["Pending", "Paid", "Completed", "Cancelled"], default: "Pending" },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
