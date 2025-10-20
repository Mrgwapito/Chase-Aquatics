const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },            // numeric id
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    image: { type: String, default: '' },             // e.g. "/uploads/xxx.jpg" or full URL
    additionalImages: { type: [String], default: [] },
    alt: { type: String, default: '' },
    price_unit: { type: String, default: '' }
  },
  {
    _id: false,               // because we provide numeric _id ourselves
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Product', productSchema);
