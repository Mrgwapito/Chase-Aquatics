const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // 🧩 Name Fields (New)
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },

  // 🧩 Keep existing fullName for backward compatibility
  fullName: { type: String, required: true },

  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  gender: { type: String, default: "" },
  birthday: { type: String, default: "" },

  // ✅ Role for admin/user
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // ✅ OTP fields
  resetOtp: { type: Number, default: null },
  registerOtp: { type: Number, default: null },
  otpExpires: { type: Date, default: null },

  // ✅ Profile-related (safe optional)
  userId: { type: String, default: "" },
  profileImage: { type: String, default: "images/default-user.png" },
}, { timestamps: true }); // adds createdAt + updatedAt automatically

module.exports = mongoose.model('User', userSchema);
