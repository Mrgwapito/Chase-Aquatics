const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  sku:    { type: String, required: true, trim: true, unique: false },
  options:{ type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { Size:"60cm", Color:"Black" }
  price:  { type: Number, required: true, min: 0 },
  stock:  { type: Number, default: 0, min: 0 },
  image:  { type: String, default: '' } // optional per-variant image
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },     // base price (used when no variants)
    stock: { type: Number, default: 0, min: 0 },         // base stock (used when no variants)
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    additionalImages: { type: [String], default: [] },
    alt: { type: String, default: '' },
    price_unit: { type: String, default: '' },

    // ✅ NEW (optional): variants list
    variants: { type: [variantSchema], default: [] }
  },
  {
    _id: false,
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Product', productSchema);
