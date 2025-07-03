const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  }, // Allows both string and number for price
  description: { type: String, required: true },
  image: { type: String, required: true },  // URL to the main product image
  additionalImages: [String],  // Array of URLs to additional images
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;


