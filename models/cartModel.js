// models/cartModel.js
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    quantity: { type: Number, default: 1, min: 1 },

    // Optional denormalized fields for quicker render (not required)
    title: String,
    price: Number,
    image: String,
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', CartSchema);
