const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https'); // for EmailJS requests
const fs = require('fs');

const Order = require('./models/orderModel');
const Product = require('./models/productModel');
const Cart = require('./models/cartModel');
const User = require('./models/userModel');
const Booking = require("./models/bookingModel");

// === Admin Logs (model + helper) === mark
const AdminLog = require('./models/AdminLog');               // <- create models/AdminLog.js if you haven't yet
const { logAdminAction } = require('./utils/logAdminAction'); // <- you said you already created this


const app = express();
const port = 3000;
const JWT_SECRET = "lifeinabox_secret_key";

/* ---------------------------- FILE UPLOADS SETUP ---------------------------- */
// Make sure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Only accept common image types (optional but recommended)
const fileFilter = (req, file, cb) => {
  const ok = /image\/(png|jpe?g|gif|webp|bmp|svg\+xml)/i.test(file.mimetype);
  cb(null, ok);
};

// Disk storage for images (we keep the extension)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit (tweak if you like)
});

// Serve uploaded files under http://localhost:3000/uploads/...
app.use('/uploads', express.static(uploadsDir));
/* --------------------------------------------------------------------------- */



// =============================== MIDDLEWARE =================================
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json()); // fine; multer will handle multipart routes
app.use(express.static(path.join(__dirname)));

// ================================================================
// 🧩 MONGODB CONNECTION
// ================================================================
mongoose.connect('mongodb://localhost:27017/Lifeinabox', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// ================================================================
// 📧 EMAILJS EMAIL SENDER FUNCTION
// ================================================================
async function sendEmailThroughEmailJS(toEmail, subject, htmlBody, otp = null) {
  const EMAILJS_SERVICE_ID = "service_2bfbogr";
  const EMAILJS_PUBLIC_KEY = "hhTpOoi07kd04LwsH";

  const EMAILJS_TEMPLATE_ID = subject.includes("Password Reset")
    ? "template_bcfsv7i"
    : "template_bcfsv7i";

  console.log("📨 Sending email via EmailJS...");
  console.log("🧾 To:", toEmail, "| Template:", EMAILJS_TEMPLATE_ID);

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      email: toEmail,
      name: "Life in a Box",
      title: subject,
      time: new Date().toLocaleString(),
      message: htmlBody,
      message_html: htmlBody,
      otp_code: otp ? String(otp) : ""
    },
  };

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Origin": "https://emailjs.com",
    "Referer": "https://emailjs.com/",
  };

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      agent: new https.Agent({ keepAlive: true }),
    });

    const text = await response.text();
    console.log("📬 EmailJS Raw Response:", text || "(empty)");

    if (!response.ok) {
      console.error("❌ EmailJS send failed:", response.status, text);
      throw new Error(`Failed to send email via EmailJS (${response.status})`);
    }

    console.log(`📧 Email sent successfully to ${toEmail}`);
    return true;
  } catch (err) {
    console.error("🚨 EmailJS email send error:", err.message);
    return false;
  }
}

// ================================================================
// 🟢 PRODUCT ROUTES (fixed version)
// ================================================================

// ✅ Add a new product (multipart/form-data; supports single file field named "image")
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    // Fields coming from FormData in admin.js
    let {
      _id,
      title,
      category,
      price,
      description,
      alt,
      price_unit,
      stock
    } = req.body;

    // Coerce numbers
    price = Number(price) || 0;
    stock = Number(stock) || 0;

    // Auto-increment numeric _id if not provided
    if (!_id) {
      const last = await Product.findOne({}, { _id: 1 }).sort({ _id: -1 }).lean();
      _id = last ? Number(last._id) + 1 : 1;
    } else {
      _id = Number(_id);
      if (!Number.isFinite(_id)) {
        return res.status(400).json({ success: false, message: 'Invalid _id' });
      }
    }

    // Build public image path if a file was uploaded
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      // optional fallback if you send a direct URL via a text field named "image"
      imagePath = req.body.image;
    }

    const doc = new Product({
      _id,
      title,
      category,
      price,
      stock,                       // 👈 now persisted
      description: description || '',
      image: imagePath,            // 👈 public URL (e.g., /uploads/123.jpg) or provided URL
      additionalImages: [],
      alt: alt || '',
      price_unit: price_unit || ''
    });

    await doc.save();

    res.status(201).json({
      success: true,
      message: 'Product saved successfully',
      product: doc
    });
  } catch (err) {
    console.error('❌ Error saving product:', err);
    res.status(500).json({ success: false, message: 'Error saving product: ' + err.message });
  }
});



// ✅ Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    console.error("❌ Error fetching products:", err.message);
    res.status(500).send('Error fetching products: ' + err.message);
  }
});

// ✅ Get single product by ID (works for numeric or ObjectId)
app.get('/api/product/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    console.log("🔍 Fetching product with ID:", idParam);

    if (!idParam || idParam === "undefined") {
      return res.status(400).json({ message: "Invalid or missing product ID" });
    }

    let product;
    const numericId = Number(idParam);

    // Try numeric _id first
    if (!isNaN(numericId)) {
      product = await Product.findOne({ _id: numericId });
    }

    // Fallback to ObjectId if valid
    if (!product && mongoose.Types.ObjectId.isValid(idParam)) {
      product = await Product.findById(idParam);
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("❌ Error fetching product:", error.message);
    res.status(500).json({ message: "Error fetching product", error: error.message });
  }
});

// ✅ Get related products (same category, excluding current)
app.get('/api/products/:id/related', async (req, res) => {
  try {
    const productId = req.params.id;
    const numericId = Number(productId);

    const selectedProduct = !isNaN(numericId)
      ? await Product.findOne({ _id: numericId })
      : await Product.findById(productId);

    if (!selectedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const relatedProducts = await Product.find({
      category: selectedProduct.category,
      _id: { $ne: selectedProduct._id }
    }).limit(4);

    res.json(relatedProducts);
  } catch (err) {
    console.error("❌ Error fetching related products:", err.message);
    res.status(500).json({ message: 'Error fetching related products', error: err.message });
  }
});



// ================================================================
// 🛒 CART ROUTE
// ================================================================
app.post('/api/cart/add', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  if (!userId || !productId || !quantity)
    return res.status(400).json({ success: false, message: "Invalid input data" });

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [{ productId, quantity }] });
    } else {
      const existingProduct = cart.items.find(item => item.productId.toString() === productId);
      if (existingProduct) existingProduct.quantity += quantity;
      else cart.items.push({ productId, quantity });
    }

    await cart.save();
    res.json({ success: true, message: "Product added to cart" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding to cart", error: err.message });
  }
});

// ================================================================
// 🔐 AUTHENTICATION SYSTEM (UPDATED for firstName + lastName)
// ================================================================
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const fullName = `${firstName || ""} ${lastName || ""}`.trim();

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      firstName,
      lastName,
      fullName,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('❌ Error in register route:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ================================================================
// 🧹 AUTO CLEANUP + REGISTER FIX FOR "PENDING VERIFICATION" GHOST USERS
// ================================================================
setInterval(async () => {
  try {
    const now = Date.now();
    const result = await User.deleteMany({
      fullName: "Pending Verification",
      otpExpires: { $lt: now },
    });
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired pending verification users`);
    }
  } catch (err) {
    console.error("⚠️ Auto-clean failed:", err.message);
  }
}, 10 * 60 * 1000);

// ================================================================
// ✅ REGISTER-FIX (Final Debug Version — includes first/last name)
// ================================================================
app.post('/register-fix', async (req, res) => {
  try {
    console.log("📥 Incoming registration body:", req.body);

    const { firstName = "", lastName = "", email, password } = req.body;

    if (!email || !password) {
      console.warn("⚠️ Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // ✅ Validate name fields
    if (!firstName.trim() || !lastName.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required.",
      });
    }

    // ✅ Clean + format full name
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // ✅ Check for existing user
    let user = await User.findOne({ email });
    if (user) {
      // Remove "Pending Verification" ghost accounts
      if (user.fullName === "Pending Verification" || user.password === "TEMP") {
        console.log(`🧹 Removing ghost user for ${email}`);
        await User.deleteOne({ email });
      } else {
        console.warn(`⚠️ User already exists: ${email}`);
        return res.status(400).json({
          success: false,
          message: "This email is already registered. Please log in.",
        });
      }
    }

    // ✅ Hash password safely
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create new user document
    const newUser = new User({
      firstName,
      lastName,
      fullName,
      email,
      password: hashedPassword,
      phone: "",
      address: "",
      gender: "",
      birthday: "",
      role: "user",
      registerOtp: null,
      otpExpires: null,
    });

    await newUser.save();

    console.log(`✅ User created successfully: ${email} (${firstName} ${lastName})`);

    res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        fullName: newUser.fullName,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("❌ Registration Server Error:", err);

    // ✅ Add detailed error response
    res.status(500).json({
      success: false,
      message: `Registration failed — ${err.message}`,
      stack: err.stack, // comment this out for production
    });
  }
});



// ================================================================
// 🔑 LOGIN (NOW RETURNS firstName & lastName TOO)
// ================================================================
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Incorrect password' });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role || "user",
      },
    });

    console.log(`✅ ${user.role === "admin" ? "Admin" : "User"} logged in: ${user.email}`);
  } catch (err) {
    console.error('❌ Server error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ================================================================
// 👤 FETCH PROFILE USING TOKEN (auto-fills first & last name)
// ================================================================
app.get('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ success: false, message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = await User.findById(decoded.id).select('-password');

    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    // ✅ Ensure firstName / lastName always exist
    if ((!user.firstName || !user.lastName) && user.fullName) {
      const parts = user.fullName.trim().split(" ");
      user.firstName = user.firstName || parts[0] || "";
      user.lastName = user.lastName || parts.slice(1).join(" ") || "";
      await user.save(); // 🔄 auto-update old records
      console.log(`🧩 Auto-filled name fields for user: ${user.email}`);
    }

    // ✅ Return updated user safely
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        phone: user.phone || "",
        address: user.address || "",
        gender: user.gender || "",
        birthday: user.birthday || "",
        role: user.role || "user",
        userId: user.userId || "",
        profileImage: user.profileImage || "images/default-user.png"
      }
    });
  } catch (err) {
    console.error('❌ Profile fetch error:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});


// ================================================================
// 🧩 UPDATE PROFILE (Supports firstName + lastName)
// ================================================================
app.put('/api/update-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ success: false, message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const { firstName, lastName, phone, address, gender, birthday } = req.body;

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    user.fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (birthday !== undefined) user.birthday = birthday;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        birthday: user.birthday,
      },
    });
  } catch (err) {
    console.error('❌ Error updating profile:', err.message);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});


// ================================================================
// 🔑 CHANGE PASSWORD (same token verification flow)
// ================================================================
app.put('/api/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ success: false, message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token)
      return res.status(401).json({ success: false, message: 'Invalid token format' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (verifyErr) {
      console.error('❌ Invalid or expired token:', verifyErr.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // ✅ Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    console.log(`🔐 Password updated for user: ${user.email}`);
    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error('❌ Error updating password:', err.message);
    res.status(500).json({ success: false, message: 'Server error updating password' });
  }
});


// ================================================================
// 🧾 CREATE ORDER (and Save to MongoDB with Debug Logging)
// ================================================================
app.post("/api/orders", async (req, res) => {
  try {
    console.log("📥 Incoming Order Data:", req.body);

    const { userId, name, email, phone, address, cart } = req.body;

    if (!userId) {
      console.error("❌ Missing userId");
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      console.error("❌ Empty or invalid cart");
      return res.status(400).json({ success: false, message: "Invalid cart data" });
    }

    const totalAmount = cart.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 1;
      return sum + price * qty;
    }, 0) + 100;

    const newOrder = new Order({
      userId,
      name,
      email,
      phone,
      address,
      cart,
      totalAmount,
    });

    await newOrder.save();
    console.log("✅ Order Saved Successfully:", newOrder);

    res.json({
      success: true,
      message: "Order placed successfully!",
      order: newOrder,
    });
  } catch (err) {
    console.error("❌ Detailed Order Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error creating order",
      error: err.message,
    });
  }
});

// ================================================================
// 🧾 GET ALL ORDERS (Admin only)
// ================================================================
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 }) // newest first
      .populate("userId", "fullName email"); // optional for linked user info

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err.message);
    res.status(500).json({ success: false, message: "Server error fetching orders" });
  }
});



// ================================================================
// ✉️ EMAIL OTP ROUTE (Registration)
// ================================================================
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`📩 OTP generated for ${email}: ${otp}`);

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        fullName: "Pending Verification",
        email,
        password: "TEMP"
      });
    }

    user.registerOtp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    const ok = await sendEmailThroughEmailJS(
      email,
      "Your Life in a Box Verification Code",
      `Your verification code is <b>${otp}</b>. This code will expire in 5 minutes.`,
      otp
    );

    if (!ok)
      return res.status(502).json({ success: false, message: "OTP generated but email failed to send" });

    res.json({ success: true, otp, message: "OTP generated and email sent" });
  } catch (err) {
    console.error("❌ Error generating OTP:", err);
    res.status(500).json({ success: false, message: "Server error generating OTP" });
  }
});

// ================================================================
// 🔁 FORGOT PASSWORD OTP ROUTE
// ================================================================
app.post("/api/forgot-password", async (req, res) => {
  try {
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "No account found with this email" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`🔐 Password reset OTP for ${email}: ${otp}`);

    user.resetOtp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const ok = await sendEmailThroughEmailJS(
      email,
      "Your Life in a Box Password Reset Code",
      `
        Hi ${user.fullName || "User"},<br><br>
        You requested to reset your password.<br>
        Your OTP code is <b>${otp}</b>.<br><br>
        It will expire in 10 minutes.<br><br>
        If this wasn't you, please ignore this email.<br><br>
        — Life in a Box Team
      `,
      otp
    );

    if (!ok)
      return res.status(502).json({ success: false, message: "Failed to send OTP email" });

    res.json({ success: true, message: "OTP sent successfully to your email" });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ success: false, message: "Server error sending OTP" });
  }
});

// ================================================================
// ✅ VERIFY FORGOT PASSWORD OTP + RESET PASSWORD
// ================================================================
app.post("/api/verify-reset-otp", async (req, res) => {
  try {
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();
    const otpStr = String((req.body.otp || "")).trim();
    const newPassword = (req.body.newPassword || "").trim();

    console.log("📥 Incoming reset request:", { email, otpStr, hasNewPwd: !!newPassword });

    if (!email || !otpStr || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    if (!/^\d{6}$/.test(otpStr)) {
      return res.status(400).json({ success: false, message: "Invalid OTP format" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ No user found for:", email);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("📦 Stored in DB:", {
      resetOtp: user.resetOtp,
      otpExpires: user.otpExpires,
      now: Date.now(),
    });

    if (String(user.resetOtp) !== otpStr) {
      console.log("❌ Invalid OTP: input vs stored", otpStr, user.resetOtp);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > user.otpExpires) {
      console.log("❌ OTP expired:", new Date(user.otpExpires));
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = null;
    user.otpExpires = null;
    await user.save();

    console.log(`✅ Password reset successfully for ${email}`);
    res.json({ success: true, message: "Password reset successfully!" });
  } catch (err) {
    console.error("❌ Error verifying reset OTP:", err);
    res.status(500).json({ success: false, message: "Server error verifying OTP" });
  }
});


// ================================================================
// 📅 BOOKING SYSTEM ROUTES (CHASE AQUATICS)
// ================================================================

// Helper: normalize many formats ("9:00", "9:00am", "09:00", "1:00pm", "13:00") -> "HH:mm"
function to24h(hhmmMaybeAmPm) {
  if (!hhmmMaybeAmPm) return "";
  const s = String(hhmmMaybeAmPm).trim().toLowerCase();

  // already "HH:mm" 24h?
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  // "h:mm" (no am/pm)
  if (/^\d{1}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  // "h:mmam"/"hh:mmpm" (with am/pm)
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(a|p)m$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mm = m[2];
    const ap = m[3];
    if (ap === "p" && h !== 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    return `${String(h).padStart(2,"0")}:${mm}`;
  }

  // last fallback: try to coerce "9" -> "09:00"
  if (/^\d{1,2}$/.test(s)) return `${String(parseInt(s,10)).padStart(2,"0")}:00`;

  return s; // as-is (won't break, but better to be strict above)
}

// ✅ Get taken times for a specific date (used by frontend) — KEEP FIRST
app.get("/api/bookings/availability", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date query is required (YYYY-MM-DD)",
      });
    }

    const bookings = await Booking.find({ date }).select("time -_id");
    // normalize everything we return
    const taken = bookings.map(b => to24h(b.time));
    res.json({ success: true, taken });
  } catch (err) {
    console.error("❌ Availability error:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching availability",
    });
  }
});

// ✅ Create a new booking
app.post("/api/bookings", async (req, res) => {
  try {
    const { name, email, guests, date, time, notes, topics } = req.body;

    if (!name || !email || !date || !time || !topics?.length) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, email, date, time, and topics are required.",
      });
    }

    // normalize incoming time to HH:mm (e.g., "09:00")
    const time24 = to24h(time);

    // 🛑 Prevent duplicate booking for that normalized slot
    const existingBooking = await Booking.findOne({ date, time: time24 });
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: `The slot ${date} at ${time24} is already booked. Please select another time.`,
      });
    }

    // ✅ Create and Save Booking (always store HH:mm)
    const newBooking = new Booking({
      name,
      email,
      guests: Array.isArray(guests)
        ? guests
        : typeof guests === "string"
        ? guests.split(",").map((g) => g.trim()).filter(Boolean)
        : [],
      date,
      time: time24,
      notes,
      topics,
    });

    await newBooking.save();
    console.log(`✅ Booking saved: ${name} @ ${date} ${time24}`);

    // ✉️ SEND EMAIL CONFIRMATION (Customer)
    try {
      await sendEmailThroughEmailJS(
        email,
        "Chase Aquatics — Appointment Confirmation",
        `
          <h2>Hi ${name},</h2>
          <p>Thank you for scheduling an appointment with <strong>Chase Aquatics</strong>! 🌊</p>
          <p>
            <b>Date:</b> ${date}<br>
            <b>Time:</b> ${time24}<br>
            <b>Topics:</b> ${topics.join(", ")}
          </p>
          ${notes ? `<p><b>Notes:</b> ${notes}</p>` : ""}
          <p>We'll be expecting you at our shop:</p>
          <p><i>Paseo de Carmona, Unit 8 Lot E/F Paseo Square, Governor’s Dr, Carmona, Cavite</i></p>
          <p>See you soon! 🐠<br><br>— The Chase Aquatics Team</p>
        `
      );
      console.log(`📨 Confirmation email sent to ${email}`);
    } catch (err) {
      console.error("⚠️ Failed to send booking confirmation:", err.message);
    }

    // ✉️ ADMIN ALERT
    try {
      await sendEmailThroughEmailJS(
        "chaseaquatics@gmail.com",
        "New Booking Received — Chase Aquatics",
        `
          <h2>📅 New Appointment Booked!</h2>
          <p><b>Name:</b> ${name}<br>
          <b>Email:</b> ${email}<br>
          <b>Date:</b> ${date}<br>
          <b>Time:</b> ${time24}<br>
          <b>Topics:</b> ${topics.join(", ")}<br>
          ${notes ? `<b>Notes:</b> ${notes}<br>` : ""}
          ${
            newBooking.guests?.length
              ? `<b>Guests:</b> ${newBooking.guests.join(", ")}<br>`
              : ""
          }
          <br><i>Check MongoDB for details.</i>
        `
      );
      console.log("📧 Admin notified of new booking.");
    } catch (err) {
      console.error("⚠️ Failed to send admin alert:", err.message);
    }

    res.json({
      success: true,
      message:
        "Booking scheduled successfully! Confirmation email sent to customer.",
      booking: newBooking,
    });
  } catch (err) {
    console.error("❌ Error creating booking:", err);
    res.status(500).json({
      success: false,
      message: "Server error creating booking",
      error: err.message,
    });
  }
});

// ✅ Fetch all bookings (Admin View)
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching bookings",
    });
  }
});

// ✅ Get single booking (keep AFTER /availability)
app.get("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    res.json({ success: true, booking });
  } catch (err) {
    console.error("❌ Error fetching booking:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching booking",
    });
  }
});

// ✅ Delete booking (Admin only)
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const result = await Booking.findByIdAndDelete(req.params.id);
    if (!result)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting booking:", err);
    res.status(500).json({
      success: false,
      message: "Server error deleting booking",
    });
  }
});

// /////////////////////////////////////////////////////////////////
// 🔎 Admin Logs (list + single)
app.get('/api/admin-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/admin-logs/:id', async (req, res) => {
  try {
    const log = await AdminLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, log });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
// /////////////////////////////////////////////////////////////////


// ✅ Update a product (price/stock/title/category/desc/image) + log changes
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const idParam = req.params.id;
    const numericId = Number(idParam);
    const where = !isNaN(numericId) ? { _id: numericId } : { _id: idParam };

    const product = await Product.findOne(where);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const before = { price: product.price, stock: product.stock };

    // update allowed fields
    const { title, category, price, description, alt, price_unit, stock } = req.body;
    if (title !== undefined) product.title = title;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = Number(price) || 0;
    if (stock !== undefined) product.stock = Number(stock) || 0;
    if (description !== undefined) product.description = description;
    if (alt !== undefined) product.alt = alt;
    if (price_unit !== undefined) product.price_unit = price_unit;

    if (req.file) product.image = `/uploads/${req.file.filename}`;

    await product.save();

    // 🔏 log
    try {
      await logAdminAction(req, {
        category: 'inventory',
        action: 'PRODUCT_UPDATED',
        target: { type: 'product', id: String(product._id), name: product.title },
        meta: {
          priceChanged: before.price !== product.price,
          oldPrice: before.price, newPrice: product.price,
          stockChanged: before.stock !== product.stock,
          oldStock: before.stock, newStock: product.stock
        }
      });
    } catch (e) { console.warn('log fail (PRODUCT_UPDATED):', e.message); }

    res.json({ success: true, message: 'Product updated', product });
  } catch (err) {
    console.error('❌ Product update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating product' });
  }
});


// ✅ Update order status (Admin) + log
//    Call from frontend with: PUT /api/orders/:id/status  { status: "Paid" | "Completed" | "Confirmed" | "Cancelled" }
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Missing status' });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const prevStatus = order.status || 'Pending';
    order.status = status;
    await order.save();

    const actionMap = {
      Confirmed: 'ORDER_CONFIRMED',
      Paid:      'ORDER_MARKED_PAID',
      Completed: 'ORDER_COMPLETED',
      Cancelled: 'ORDER_CANCELLED'
    };
    const action = actionMap[status] || 'ORDER_UPDATED';

    try {
      await logAdminAction(req, {
        category: 'orders',
        action,
        target: { type: 'order', id: order.orderId || order._id.toString(), name: order.name },
        meta: { previousStatus: prevStatus, newStatus: status, total: order.totalAmount }
      });
    } catch (e) { console.warn('log fail (order status):', e.message); }

    res.json({ success: true, message: 'Order status updated', order });
  } catch (err) {
    console.error('❌ Order status update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
});


// ✅ Update appointment status or reschedule + log
//    Call with either:
//      PUT /api/bookings/:id/status   { status: "Confirmed" | "Cancelled" }
//      PUT /api/bookings/:id/status   { newDate: "YYYY-MM-DD", newTime: "HH:mm" }  // reschedule
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, newDate, newTime } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const before = { date: booking.date, time: booking.time, status: booking.status || 'Pending' };

    // reschedule flow
    if (newDate || newTime) {
      if (newDate) booking.date = newDate;
      if (newTime) booking.time = newTime;
      booking.status = 'Pending'; // or keep existing status if you prefer
      await booking.save();

      try {
        await logAdminAction(req, {
          category: 'appointments',
          action: 'APPT_RESCHEDULED',
          target: { type: 'appointment', id: booking._id.toString(), name: booking.name },
          meta: { fromDate: before.date, fromTime: before.time, toDate: booking.date, toTime: booking.time }
        });
      } catch (e) { console.warn('log fail (reschedule):', e.message); }

      return res.json({ success: true, message: 'Appointment rescheduled', booking });
    }

    // plain status update
    let action = null;
    if (status) {
      booking.status = status;
      if (status === 'Confirmed') action = 'APPT_CONFIRMED';
      if (status === 'Cancelled') action = 'APPT_CANCELLED';
    }
    await booking.save();

    if (action) {
      try {
        await logAdminAction(req, {
          category: 'appointments',
          action,
          target: { type: 'appointment', id: booking._id.toString(), name: booking.name },
          meta: { previousStatus: before.status, newStatus: booking.status }
        });
      } catch (e) { console.warn('log fail (appt status):', e.message); }
    }

    res.json({ success: true, message: 'Appointment updated', booking });
  } catch (err) {
    console.error('❌ Appointment update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating appointment' });
  }
});





// ================================================================
// 🌐 LANDING PAGE
// ================================================================
// 🔎 Admin Logs (list + single)
app.get('/api/admin-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/admin-logs/:id', async (req, res) => {
  try {
    const log = await AdminLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, log });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 🌐 LANDING PAGE (keep only this one)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landingpage.html'));
});

// 🚀 Start server (keep at the very bottom)
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});


