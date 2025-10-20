const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: String,
    unique: true,
    default: () => `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  },
  name: String,
  email: String,
  phone: String,
  address: String,
  cart: [
    {
      _id: { type: String, required: true }, // ✅ changed from ObjectId → String
      title: String,
      price: Number,
      image: String,
      description: String,
      quantity: Number,
    },
  ],
  totalAmount: Number,
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
