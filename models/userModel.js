// models/User.js
const mongoose = require('mongoose');

const validIdSchema = new mongoose.Schema({
  path: { type: String, default: '' },                                  // e.g. /uploads/valid-id/USR123...pdf
  status: { type: String, enum: ['none','pending','approved','rejected'], default: 'none' },
  note: { type: String, default: '' },
  submittedAt: { type: Date },
  reviewedAt: { type: Date }
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName:   { type: String, default: "" },
  lastName:    { type: String, default: "" },
  fullName:    { type: String, required: true },

  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },

  phone:       { type: String, default: "" },

  // 👇 Structured address (new) + legacy flat string (kept for backward compatibility)
  addressLine1:{ type: String, default: "" },
  region:      { type: String, default: "" },
  province:    { type: String, default: "" },
  city:        { type: String, default: "" },
  barangay:    { type: String, default: "" }, 
  postalCode:  { type: String, default: "" },
  address:     { type: String, default: "" }, // ← keep this for old data / emails / printing

  gender:      { type: String, default: "" },
  birthday:    { type: String, default: "" },


  role:        { type: String, enum: ["user", "admin"], default: "user" },

  resetOtp:    { type: Number, default: null },
  registerOtp: { type: Number, default: null },
  otpExpires:  { type: Date,   default: null },

  emailVerified: { type: Boolean, default: false },  // 🔹 add this

userId:       { type: String, default: "" },
  username:     { type: String, default: "", sparse: true }, // ✅ NEW: username field
  profileImage: { type: String, default: "images/default-user.png" },

  // NEW: where we keep the uploaded Valid ID state
  validId: { type: validIdSchema, default: () => ({ status: 'none' }) },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
