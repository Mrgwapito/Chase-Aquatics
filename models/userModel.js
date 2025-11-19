// models/User.js
const mongoose = require('mongoose');

/* ============================
   Subdocument: Valid ID State
   ============================ */
const validIdSchema = new mongoose.Schema(
  {
    path: { type: String, default: '' },
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    note: { type: String, default: '' },
    submittedAt: { type: Date },
    reviewedAt: { type: Date }
  },
  { _id: false }
);

/* ============================
   Main User Schema
   ============================ */
const userSchema = new mongoose.Schema(
  {
    // Basic identity
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    fullName:  { type: String, required: true },

    // Login + contact
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone:    { type: String, default: '' },

    // Address (structured + legacy flat string)
    addressLine1: { type: String, default: '' },
    region:       { type: String, default: '' },
    province:     { type: String, default: '' },
    city:         { type: String, default: '' },
    barangay:     { type: String, default: '' },
    postalCode:   { type: String, default: '' },
    address:      { type: String, default: '' }, // kept for old data / emails / printing

    // Personal info
    gender:   { type: String, default: '' },
    birthday: { type: String, default: '' },

    // Role / auth / OTP
    role:        { type: String, enum: ['user', 'admin'], default: 'user' },
    resetOtp:    { type: Number, default: null },
    registerOtp: { type: Number, default: null },
    otpExpires:  { type: Date,   default: null },
    emailVerified: { type: Boolean, default: false },

    // User identifiers & profile
    userId:       { type: String, default: '' },
    username:     { type: String, default: '', sparse: true },
    profileImage: { type: String, default: 'images/default-user.png' },

    // Uploaded Valid ID state
    validId: {
      type: validIdSchema,
      default: () => ({ status: 'none' })
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
