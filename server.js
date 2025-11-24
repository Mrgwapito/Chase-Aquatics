require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https'); // for EmailJS requests
const fs = require('fs');



// Ensure fetch is available in Node (for EmailJS REST calls)
if (typeof fetch === "undefined") {
  global.fetch = (...args) =>
    import("node-fetch").then(({ default: f }) => f(...args));
}

const Order = require('./models/orderModel');
const Product = require('./models/productModel');
const Cart = require('./models/cartModel');
const User = require('./models/userModel');
const Booking = require('./models/bookingModel');
const Block   = require('./models/blockModel');   // <- correct file/casing


// === Admin Logs (model + helper) === mark
const AdminLog = require('./models/AdminLog');               // <- create models/AdminLog.js if you haven't yet
const { logAdminAction } = require('./utils/logAdminAction'); // <- you said you already created this


const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "lifeinabox_secret_key";

// ---------- ROBUST ASSETS DISCOVERY (handles mono-repo layouts) ----------
const candidateAssets = [
  path.join(__dirname, 'assets'),           // ./assets  (same folder as server.js)
  path.join(__dirname, '..', 'assets'),     // ../assets (one level up)
  path.join(__dirname, 'public', 'assets'), // ./public/assets
];

function firstExistingDir(paths) {
  for (const p of paths) {
    try { if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p; } catch {}
  }
  return null;
}

const ASSETS_DIR = firstExistingDir(candidateAssets);
if (ASSETS_DIR) {
  console.log('✅ Using assets dir:', ASSETS_DIR);
} else {
  console.warn('⚠️ No assets directory found among:', candidateAssets);
}

// Small utility to read JSON safely
function tryReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------- API: /api/ph-geo returns JSON if file exists ----------
app.get('/api/ph-geo', (req, res) => {
  if (!ASSETS_DIR) {
    return res.status(404).json({ success: false, message: 'No assets directory found' });
  }
  const file = path.join(ASSETS_DIR, 'ph-geo.json');
  const data = tryReadJSON(file);
  if (!data) {
    return res.status(404).json({ success: false, message: `ph-geo.json not found in ${ASSETS_DIR}` });
  }
  res.set('Cache-Control', 'no-store');
  res.type('application/json').send(data);
});

// Optional: explicit built-in minimal fallback (same Cavite snippet as your client)
app.get('/api/ph-geo/fallback', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/json').send({
    regions:[{
      code:"IV-A",
      name:"Region IV-A (CALABARZON)",
      provinces:[{
        name:"Cavite",
        cities:[
          {name:"Carmona",zip:"4116",barangays:[
            "Mabuhay","Maduya","Barangay 1 Poblacion","Barangay 2 Poblacion",
            "Barangay 3 Poblacion","Barangay 4 Poblacion","Barangay 5 Poblacion",
            "Barangay 6 Poblacion","Barangay 7 Poblacion","Barangay 8 Poblacion"
          ]},
          {name:"Silang",zip:"4118",barangays:[
            "Puting Kahoy","Balite","Banaba","Biga","Bulihan","Hoyo","Iba",
            "Kalubkob","Litlit","Malabag","Mataas na Burol","Pooc","Sabutan",
            "San Miguel I","San Miguel II","San Vicente I","San Vicente II","Tartaria"
          ]}
        ]
      }]}
    ]
  });
});

// ---------- DEBUG endpoints (use ASSETS_DIR if found) ----------
app.get('/debug/assets', (req, res) => {
  if (!ASSETS_DIR) return res.status(404).send('No assets directory discovered.');
  const list = fs.readdirSync(ASSETS_DIR);
  res.type('text/plain').send(['Listing assets:', ASSETS_DIR, ...list].join('\n'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// ---------- Static mount for /assets if directory exists ----------
if (ASSETS_DIR) {
  app.use(
    '/assets',
    express.static(ASSETS_DIR, {
      etag: false,
      cacheControl: false,
      setHeaders: (res, filePath) => {
        res.set('Cache-Control', 'no-store');
        if (filePath && filePath.endsWith('.json')) {
          res.type('application/json');
        }
      }
    })
  );
} else {
  console.warn('⚠️ Skipping /assets static mount (no directory found).');
}



/* ---------------------------- FILE UPLOADS SETUP ---------------------------- */
// Make sure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Only accept common image types (now includes HEIC/HEIF)
const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();

  const ok =
    /image\/(png|jpe?g|gif|webp|bmp|svg\+xml)/i.test(mime) ||
    mime === 'image/heic' ||
    mime === 'image/heif';

  if (!ok) {
    console.warn('🚫 Rejected upload (unsupported type):', mime, file.originalname);
  }

  cb(null, ok); // false = silently no file; route code will see !req.file
};


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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});


// Serve uploaded files under http://localhost:3000/uploads/...
app.use('/uploads', express.static(uploadsDir));


/* --------------------------------------------------------------------------- */

// ---- Valid ID uploads (images + PDF) ----
const validIdDir = path.join(uploadsDir, 'valid-id');
if (!fs.existsSync(validIdDir)) fs.mkdirSync(validIdDir, { recursive: true });

const validIdFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();

  const ok =
    /image\/(png|jpe?g|gif|webp|bmp|svg\+xml)/i.test(mime) ||
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'application/pdf';

  if (!ok) {
    console.warn('🚫 Rejected Valid ID upload (unsupported type):', mime, file.originalname);
  }

  cb(null, ok);
};


const validIdStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, validIdDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

const uploadValidId = multer({
  storage: validIdStorage,
  fileFilter: validIdFilter,
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});



// =============================== MIDDLEWARE (Express 5 safe) ===============================
const corsOptions = {
  origin(origin, cb) {
    // Allow curl/Postman (no Origin)
    if (!origin) return cb(null, true);
    try {
      const { hostname } = new URL(origin);
      // Allow any localhost or 127.* (covers 5500, 5501, 5502, etc.)
      const ok = hostname === 'localhost' || hostname.startsWith('127.');
      return cb(null, ok);
    } catch {
      return cb(null, false);
    }
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,           // you’re using Bearer tokens, not cookies
  optionsSuccessStatus: 204
};

// Apply CORS to all requests
app.use(cors(corsOptions));

// IMPORTANT: Preflight for any path (choose ONE of these; this one uses RegExp)
app.options(/.*/, cors(corsOptions));      // ✅ works on Express 5

// If you prefer the string form, use the correct pattern with (.*)
// app.options('/:path(.*)', cors(corsOptions)); // ✅ also OK

app.use(express.json());
app.use(express.static(path.join(__dirname)));
// =============================== END MIDDLEWARE ============================================




// ================================================================
// 🧩 MONGODB CONNECTION
// ================================================================
// 🧩 MONGODB CONNECTION
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:');
    console.error(err); // full error for debugging
  });



  // --- helper: stable public userId derived from Mongo _id ---
function makeUserId(mongoId) {
  // last 6 of ObjectId + uppercased, prefixed with USR (e.g., USR3FAE9C)
  const hex = String(mongoId).slice(-6).toUpperCase();
  return `USR${hex}`;
}

function getTokenPayload(req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.split(' ')[1];
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const payload = getTokenPayload(req);
  if (!payload) return res.status(401).json({ success:false, message:'Unauthorized' });
  req.user = payload;
  next();
}

function requireAdmin(req, res, next) {
  const payload = getTokenPayload(req);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ success:false, message:'Admin only' });
  }
  req.user = payload;
  next();
}



// ================================================================
// 📧 EMAILJS EMAIL SENDER FUNCTION (CORRECTED FOR YOUR TEMPLATE)
// ================================================================
async function sendEmailThroughEmailJS(toEmail, subject, htmlBody, otp = null) {
  const EMAILJS_SERVICE_ID = "service_2bfbogr";
  const EMAILJS_PUBLIC_KEY = "hhTpOoi07kd04LwsH";
  const EMAILJS_TEMPLATE_ID = "template_bcfsv7i"; // ✅ Your correct template ID

  // Create template parameters that EXACTLY match your EmailJS template
  const templateParams = {
    // ✅ These match your template parameters:
    to_name: toEmail.split('@')[0],
    brand: "Life in a Box",
    submitted_at: new Date().toLocaleString(),
    otp: otp ? String(otp) : "",
    otp_window_minutes: "10",
    
    // ✅ Your template also expects these:
    logo_url: "", // Leave empty or add your logo URL
    verify_url: "", // Leave empty or add your verification URL
    
    // ✅ Optional fallbacks (safe to include):
    email: toEmail,
    subject: subject,
    message: htmlBody
  };

  console.log("🚀 Sending EmailJS request to:", toEmail);
  console.log("📧 Template ID:", EMAILJS_TEMPLATE_ID);
  console.log("📋 Template Parameters:", templateParams);

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: templateParams
  };

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("📡 EmailJS Response Status:", response.status);

    const responseText = await response.text();
    console.log("📡 EmailJS Response Body:", responseText);

    if (response.ok) {
      console.log("✅ Email sent successfully!");
      return true;
    } else {
      console.error("❌ EmailJS failed with status:", response.status);
      console.error("❌ Error details:", responseText);
      return false;
    }
  } catch (err) {
    console.error("💥 Network/Fetch Error:", err.message);
    return false;
  }
}

// Simple test endpoint
app.post('/api/test-emailjs', async (req, res) => {
  const { email } = req.body;
  
  console.log('🧪 Testing EmailJS with email:', email);
  
  // Test with minimal parameters
  const success = await sendEmailThroughEmailJS(
    email,
    "Test Email from Server",
    "<p>This is a test email to verify EmailJS is working.</p>",
    "123456"
  );

  if (success) {
    res.json({ 
      success: true, 
      message: '✅ Test email sent successfully! Check your inbox.' 
    });
  } else {
    res.json({ 
      success: false, 
      message: '❌ Failed to send test email. Check server logs for details.' 
    });
  }
});

// ================================================================
// 📧 VALID ID STATUS EMAIL (EmailJS - uses your HTML template)
// ================================================================
const VALID_ID_EMAILJS_SERVICE_ID = "service_74h8ww7";  // 🔁 REPLACE if you use another service
const VALID_ID_EMAILJS_TEMPLATE_ID = "template_rkk9n4l"; // 🔁 PUT YOUR ID VERIFICATION TEMPLATE ID HERE
const VALID_ID_EMAILJS_PUBLIC_KEY  = "ZJzoYrQoliQZhQLJH"; // usually same public key

async function sendValidIdStatusEmail(userDoc) {
  try {
    if (!userDoc || !userDoc.email) {
      console.warn("sendValidIdStatusEmail: missing user/email");
      return false;
    }

    const vid = userDoc.validId || {};
    const rawStatus = (vid.status || "pending").toLowerCase();

    // Map status -> label + message
    let statusLabel = "Pending review";
    let statusMessage =
      "We’ve received your ID and it’s still pending review. We’ll email you again once our team has finished checking it.";

    if (rawStatus === "approved") {
      statusLabel = "Approved";
      statusMessage =
        "Your submitted ID has been reviewed and approved. Your account is now verified and you can continue using the service without additional ID checks.";
    } else if (rawStatus === "rejected" || rawStatus === "declined") {
      statusLabel = "Declined";
      statusMessage =
        vid.note && vid.note.trim()
          ? `Your ID was declined with this note from our team: "${vid.note.trim()}". Please review and submit a clearer or updated copy of your ID.`
          : "Your ID was declined. Please review your submission (image clarity, completeness, and matching details) and upload a clearer or updated copy.";
    }

    const toEmail = userDoc.email;
    const toName =
      userDoc.fullName ||
      `${userDoc.firstName || ""} ${userDoc.lastName || ""}`.trim() ||
      (toEmail.includes("@") ? toEmail.split("@")[0] : "Customer");

    const submittedAt = vid.submittedAt || vid.uploadedAt || userDoc.createdAt || new Date();
    const reviewedAt  = vid.reviewedAt || new Date();

    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      brand: "Life in a Box",

      submitted_at: new Date(submittedAt).toLocaleString("en-PH"),
      reviewed_at: new Date(reviewedAt).toLocaleString("en-PH"),

      status_label: statusLabel,
      status_message: statusMessage,

      id_type: vid.idType || "Government ID",
    };

    console.log("📧 Sending Valid ID status email via EmailJS →", {
      toEmail,
      status: vid.status,
      templateParams,
    });

    const payload = {
      service_id: VALID_ID_EMAILJS_SERVICE_ID,
      template_id: VALID_ID_EMAILJS_TEMPLATE_ID,
      user_id: VALID_ID_EMAILJS_PUBLIC_KEY,
      template_params: templateParams,
    };

    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    console.log("📡 Valid ID EmailJS response:", resp.status, text);

    if (!resp.ok) {
      console.error("❌ EmailJS Valid ID failed:", resp.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("💥 sendValidIdStatusEmail error:", err);
    return false;
  }
}

// ================================================================
// 📝 STORE OTP ENDPOINT (For client-side EmailJS)
// ================================================================
app.post("/api/store-otp", async (req, res) => {
  try {
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();
    const otp = req.body.otp;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and OTP are required" 
      });
    }

    let user = await User.findOne({ email });

    // If no user yet, create a lightweight pending record
    if (!user) {
      user = new User({
        firstName: "",
        lastName: "",
        fullName: "Pending Verification",
        email,
        password: "TEMP",
      });
    }

    user.registerOtp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    await user.save();

    console.log(`✅ OTP ${otp} stored for ${email}, user ID: ${user._id}`);
    console.log(`📝 OTP stored for ${email}: ${otp}`);

    res.json({
      success: true,
      message: "OTP stored successfully",
    });
  } catch (err) {
    console.error("❌ Error storing OTP:", err);
    res.status(500).json({
      success: false,
      message: "Server error storing OTP",
    });
  }
});

// ================================================================
// 🟢 PRODUCT ROUTES (fixed version)
// ================================================================

// ✅ Add a new product (multipart/form-data; supports single file field named "image")
app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
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
      stock,
      variants: variantsRaw // 👈 comes as JSON string from FormData
    } = req.body;

    // Coerce numbers
    price = Number(price) || 0;
    stock = Number(stock) || 0;

    // 🔽 Parse variants (if any) — from JSON string → array
    let variants = [];
    if (variantsRaw) {
      try {
        const parsed = JSON.parse(variantsRaw);
        if (Array.isArray(parsed)) {
          variants = parsed;
        } else {
          console.warn("⚠️ /api/products: variants is not an array:", parsed);
        }
      } catch (e) {
        console.warn("⚠️ /api/products: failed to parse variants JSON:", e, variantsRaw);
      }
    }

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
      stock,
      description: description || '',
      image: imagePath,
      additionalImages: [],
      alt: alt || '',
      price_unit: price_unit || '',
      variants               // 👈 SAVE VARIANTS HERE
    });

    await doc.save();

    // 📝 LOG: product created (so it appears in Admin Logs)
    try {
      await logAdminAction(req, {
        category: 'inventory',
        action: 'PRODUCT_CREATED',
        target: { type: 'product', id: String(doc._id), name: doc.title },
        meta: { price: doc.price, stock: doc.stock, category: doc.category }
      });
    } catch (e) {
      console.warn('log fail (PRODUCT_CREATED):', e.message);
    }

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





// ✅ Get products (paginated + optional category + q search)
//    If no `limit`/`page` is provided, return ALL matching products
//    so product.html can render the full catalogue.
app.get('/api/products', async (req, res) => {
  try {
    const { category, q } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (q) {
      filter.$or = [
        { title:       { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category:    { $regex: q, $options: 'i' } }
      ];
    }

    // Detect if the client explicitly requested pagination
    const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
    const hasPage  = Object.prototype.hasOwnProperty.call(req.query, 'page');
    const shouldPaginate = hasLimit || hasPage;

    const total = await Product.countDocuments(filter);

    let page       = 1;
    let limit      = total || 1;         // default: return everything
    let totalPages = 1;

    let query = Product.find(filter).sort({ createdAt: -1 });

    if (shouldPaginate) {
      // Keep pagination behaviour for admin / list views that send limit/page
      limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
      page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
      totalPages = Math.max(1, Math.ceil(total / limit));

      query = query
        .skip((page - 1) * limit)
        .limit(limit);
    }

    const products = await query.lean();

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages,
      products
    });
  } catch (err) {
    console.error("❌ Error fetching products:", err.message);
    res.status(500).json({ success: false, message: 'Error fetching products: ' + err.message });
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
// 🛒 CART ROUTES (server-backed) — non-breaking additions
// ================================================================

// Get current user's cart
app.get('/api/cart', async (req, res) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ success:false, message:'Unauthorized' });
  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();                 // ✅ persist empty cart so you see it in Compass
    }
    res.json({ success:true, items: cart.items });
  } catch (e) {
    console.error('GET /api/cart error:', e); // helpful logs
    res.status(500).json({ success:false, message:e.message });
  }
});


// Replace cart with provided items (idempotent save)
app.put('/api/cart', async (req, res) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ success:false, message:'Unauthorized' });

  let items = Array.isArray(req.body.items) ? req.body.items : [];
  // normalize + clamp
  items = items
    .filter(it => it && it.productId)
    .map(it => ({
      productId: it.productId,
      quantity: Math.max(1, Math.min(parseInt(it.quantity || 1, 10), 99)),
      // optional denormalized fields to speed up UI
      title: it.title, price: it.price, image: it.image
    }));

  try {
    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items } },
      { new: true, upsert: true }
    );
    res.json({ success:true, items: cart.items });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
});

// Merge a local cart into server cart (used on first login per device)
app.post('/api/cart/merge', async (req, res) => {
  const userId = getUserIdFromAuth(req);
  if (!userId) return res.status(401).json({ success:false, message:'Unauthorized' });

  const incoming = Array.isArray(req.body.items) ? req.body.items : [];
  try {
    const cart = await Cart.findOne({ userId }) || new Cart({ userId, items: [] });

    const map = new Map();
    // current server items first
    cart.items.forEach(it => {
      map.set(String(it.productId), { ...it.toObject(), quantity: it.quantity });
    });
    // merge client items by summing quantities
    incoming.forEach(it => {
      if (!it || !it.productId) return;
      const key = String(it.productId);
      const qty = Math.max(1, Math.min(parseInt(it.quantity || 1, 10), 99));
      if (map.has(key)) {
        map.get(key).quantity = Math.max(1, Math.min(map.get(key).quantity + qty, 99));
      } else {
        map.set(key, {
          productId: it.productId,
          quantity: qty,
          title: it.title, price: it.price, image: it.image
        });
      }
    });

    cart.items = Array.from(map.values());
    await cart.save();
    res.json({ success:true, items: cart.items });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
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

// ensure stable public userId
if (!newUser.userId) {
  newUser.userId = makeUserId(newUser._id);
  await newUser.save();
}

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

// ensure stable public userId
if (!newUser.userId) {
  newUser.userId = makeUserId(newUser._id);
  await newUser.save();
}

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
    userId: newUser.userId, // optional: return this too
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
// 👤 PROFILE – unified route (with validId + structured address)
// ================================================================
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let user = await User.findById(userId).select('-password -registerOtp -otpExpires -resetOtp');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Auto-fill firstName / lastName from fullName kung kulang
    if ((!user.firstName || !user.lastName) && user.fullName) {
      const parts = user.fullName.trim().split(' ');
      user.firstName = user.firstName || parts[0] || '';
      user.lastName  = user.lastName  || parts.slice(1).join(' ') || '';
      await user.save();
      console.log(`🧩 Auto-filled name fields for user: ${user.email}`);
    }

    // ✅ Ensure stable public userId (USRxxxxxx)
    if (!user.userId) {
      user.userId = makeUserId(user._id);
      await user.save();
    }

    // ✅ Normalize validId so frontend always gets something
    const validId = user.validId || { status: 'none', path: '', note: '' };

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        fullName:  user.fullName  || `${user.firstName || ''} ${user.lastName || ''}`.trim(),

        username:  user.username || '',

        phone: user.phone || '',

        addressLine1: user.addressLine1 || '',
        region:       user.region || '',
        province:     user.province || '',
        city:         user.city || '',
        barangay:     user.barangay || '',
        postalCode:   user.postalCode || '',
        address:      user.address || '',

        gender:   user.gender || '',
        birthday: user.birthday || '',
        role:     user.role || 'user',
        userId:   user.userId,

        profileImage: user.profileImage || 'images/default-user.png',

        // 🔹 IMPORTANT: always send validId
        validId,
      },
    });
  } catch (err) {
    console.error('❌ /api/profile error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});


// ================================================================
// 🖼️ PROFILE IMAGE UPLOAD
// ================================================================
app.put('/api/profile-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const relPath = `/uploads/${req.file.filename}`;
    userDoc.profileImage = relPath;
    await userDoc.save();

    const safeUser = userDoc.toObject();
    delete safeUser.password;
    delete safeUser.registerOtp;
    delete safeUser.otpExpires;

    res.json({
      success: true,
      imageUrl: relPath,
      user: safeUser
    });
  } catch (err) {
    console.error('PUT /api/profile-image error:', err);
    res.status(500).json({ success: false, message: 'Error saving profile image' });
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

const {
      firstName, lastName, username, phone, // ✅ added username
      addressLine1, region, province, city, barangay, postalCode,
      address, // legacy flat string (only used if structured not provided)
      gender, birthday
    } = req.body;

    // names
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName  !== undefined) user.lastName  = lastName;
    user.fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    // username (✅ NEW)
    if (username !== undefined) {
      const trimmed = String(username || "").trim();
      // Optional: check if username is already taken by another user
      if (trimmed && trimmed !== user.username) {
        const existing = await User.findOne({ username: trimmed, _id: { $ne: user._id } });
        if (existing) {
          return res.status(400).json({ 
            success: false, 
            message: 'Username already taken. Please choose another.' 
          });
        }
      }
      user.username = trimmed;
    }

    // phone
    if (phone !== undefined) user.phone = phone;

    // structured address (prefer these if provided)
    const hasStructured =
      [addressLine1, region, province, city, barangay, postalCode].some(v => v !== undefined);

    if (hasStructured) {
      if (addressLine1 !== undefined) user.addressLine1 = String(addressLine1 || "");
      if (region       !== undefined) user.region       = String(region || "");
      if (province     !== undefined) user.province     = String(province || "");
      if (city         !== undefined) user.city         = String(city || "");
      if (barangay     !== undefined) user.barangay     = String(barangay || "");
      if (postalCode   !== undefined) user.postalCode   = String(postalCode || "");

      // keep legacy address in sync for emails/printing
      const parts = [
        user.addressLine1,
        user.barangay,
        user.city,
        user.province,
        user.region,
        user.postalCode ? `PH ${user.postalCode}` : ""
      ].filter(Boolean);
      user.address = parts.join(", ");
    } else if (address !== undefined) {
      // legacy only
      user.address = String(address || "");
    }

    // other fields
    if (gender   !== undefined) user.gender   = gender;
    if (birthday !== undefined) user.birthday = birthday;

    await user.save();

res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        fullName:  user.fullName,
        username:  user.username || "", // ✅ NEW
        email:     user.email,
        phone:     user.phone,

        addressLine1: user.addressLine1 || "",
        region:       user.region || "",
        province:     user.province || "",
        city:         user.city || "",
        barangay:     user.barangay || "",
        postalCode:   user.postalCode || "",
        address:      user.address || "",

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
// 🪪 VALID ID UPLOAD (user side, with idType + admin log)
// ================================================================
app.post('/api/profile/valid-id', requireAuth, uploadValidId.single('validId'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No ID file uploaded' });
    }

    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const relPath = `/uploads/valid-id/${req.file.filename}`;
    const idType  = (req.body.idType || '').trim(); // e.g. "PhilHealth ID", "School ID"

    userDoc.validId = {
      status: 'pending',
      path: relPath,
      note: '',
      uploadedAt: new Date(),
      submittedAt: new Date(),
      reviewedAt: null,
      idType: idType || undefined,
    };

    await userDoc.save();

    // 📝 Optional admin log
    try {
      await logAdminAction(req, {
        category: 'users',
        action: 'VALID_ID_SUBMITTED',
        target: { type: 'user', id: String(userDoc._id), name: userDoc.fullName || userDoc.email },
        meta: { path: relPath, idType: idType || null },
      });
    } catch (e) {
      console.warn('logAdminAction (VALID_ID_SUBMITTED) failed:', e.message);
    }

    res.json({
      success: true,
      file: relPath,
      status: 'pending',
    });
  } catch (err) {
    console.error('POST /api/profile/valid-id error:', err);
    res.status(500).json({ success: false, message: 'Error saving Valid ID' });
  }
});



// GET /id-verifications?status=pending|approved|declined|all&q=&page=1&limit=10
app.get('/id-verifications', requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const status = (req.query.status || 'pending').toLowerCase();
    const q = (req.query.q || '').trim().toLowerCase();

    const matchStatus = (u) => {
      const s = (u.validId?.status || 'none').toLowerCase();
      if (status === 'all') return s !== 'none';
      if (status === 'declined') return s === 'rejected' || s === 'declined';
      if (status === 'approved') return s === 'approved';
      return s === 'pending';
    };

    const users = await User.find({}, 'firstName lastName fullName email userId profileImage validId createdAt').lean();

    const filtered = users.filter(u => {
      if (!matchStatus(u)) return false;
      if (!q) return true;
      const key = [u.fullName, u.firstName, u.lastName, u.email, u.userId]
        .filter(Boolean).join(' ').toLowerCase();
      return key.includes(q);
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map(u => ({
      id: String(u._id),
      userId: u.userId,
      userName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      userEmail: u.email,
      avatarUrl: u.profileImage || '/images/default-user.png',
      submittedAt: u.validId?.submittedAt || null,
      status: (u.validId?.status || 'none'),
      fileUrl: u.validId?.path || '',
      fileMime: (u.validId?.path || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*'
    }));

    res.json({ success:true, items, total, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:e.message });
  }
});

app.post('/id-verifications/:id/approve', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.validId?.path) {
      return res.status(404).json({ success:false, message:'Submission not found' });
    }

    user.validId.status = 'approved';
    user.validId.reviewedAt = new Date();
    await user.save();

    try {
      await logAdminAction(req, {
        category: 'users',
        action: 'VALID_ID_APPROVED',
        target: { type: 'user', id: String(user._id), name: user.fullName },
        meta: { path: user.validId.path }
      });
    } catch (logErr) {
      console.warn('logAdminAction (VALID_ID_APPROVED) failed:', logErr.message);
    }

    // ❌ WALA NANG EmailJS DITO – frontend na ang bahala mag-send

    res.json({ success:true, message:'Approved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:e.message });
  }
});


app.post('/id-verifications/:id/decline', requireAdmin, async (req, res) => {
  try {
    const note = (req.body?.note || '').slice(0, 300);
    const user = await User.findById(req.params.id);
    if (!user || !user.validId?.path) {
      return res.status(404).json({ success:false, message:'Submission not found' });
    }

    user.validId.status = 'rejected';
    user.validId.note = note;
    user.validId.reviewedAt = new Date();
    await user.save();

    try {
      await logAdminAction(req, {
        category: 'users',
        action: 'VALID_ID_DECLINED',
        target: { type: 'user', id: String(user._id), name: user.fullName },
        meta: { path: user.validId.path, note }
      });
    } catch (logErr) {
      console.warn('logAdminAction (VALID_ID_DECLINED) failed:', logErr.message);
    }

    // ❌ WALA NANG EmailJS DITO – frontend na ang bahala mag-send

    res.json({ success:true, message:'Declined' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:e.message });
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
// 🧾 CREATE ORDER — accepts JSON or multipart (with payReceipt)
//    NOW with stock reservation on place order
//    Search tag: /api/orders (create order)
// ================================================================
app.post("/api/orders", upload.single("payReceipt"), async (req, res) => {
  try {
    const isMultipart = req.is("multipart/form-data");
    const raw = req.body || {};

    // cart may arrive as a JSON string when multipart
    let cart = [];
    if (isMultipart) {
      try { cart = JSON.parse(raw.cart || "[]"); } catch { cart = []; }
    } else {
      cart = Array.isArray(raw.cart) ? raw.cart : (raw.cart || []);
    }

    // 🔧 NORMALIZE CART: make sure every item has productId / quantity / price
    cart = (Array.isArray(cart) ? cart : [])
      .filter(Boolean)
      .map((item) => {
        const copy = { ...item };

        // Fill productId from other fields if missing
        if (!copy.productId) {
          copy.productId =
            copy.productId ||
            copy._id ||                       // common from frontend
            copy.id ||                        // some carts use `id`
            (copy.product && (copy.product._id || copy.product.id));
        }

        // Keep useful denormalized fields (for email + UI)
        copy.title = copy.title || copy.name || (copy.product && copy.product.title);
        copy.price = Number(
          copy.price ??
          copy.unitPrice ??
          (copy.product && copy.product.price) ??
          0
        );
        copy.quantity = Number(copy.quantity ?? copy.qty ?? 1) || 1;

        return copy;
      });

    // --- basic identity fields from the request body ---
    const userId = raw.userId;

    let name  = (raw.name  || "").trim();
    let email = (raw.email || "").trim();
    let phone = (raw.phone || "").trim();


    // Structured address fields the checkout MAY send
    const bodyAddressLine1 = (raw.addressLine1 || "").trim();
    const bodyRegion       = (raw.region       || "").trim();
    const bodyProvince     = (raw.province     || "").trim();
    const bodyCity         = (raw.city         || "").trim();
    const bodyBarangay     = (raw.barangay     || "").trim();
    const bodyPostalCode   = (raw.postalCode   || "").trim();

    // Legacy flat address string (sometimes just "Philippines")
    let address = (raw.address || "").trim();   // text address from checkout (custAddress)

    const paymentMethod = (raw.paymentMethod || "COD").trim();         // "COD" | "GCash" | "Bank"
    const codLandmark   = (raw.codLandmark || "").trim();
    const fulfillment   = (raw.fulfillment || "Delivery").trim();      // "Delivery" | "Pickup"
    const amountSent    = Number(raw.payAmount || 0) || 0;

    const receiptUrl    = req.file ? `/uploads/${req.file.filename}` : null;


    if (!userId) {
      return res.status(400).json({ success:false, message:"Missing userId" });
    }
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ success:false, message:"Invalid cart data" });
    }

    // ------------------------------------------------------------
    // 📦 STEP 0: Build the BEST shippingAddress we can
    //      1) Use structured fields from checkout if present
    //      2) If still blank or just "Philippines", enrich from user profile
    // ------------------------------------------------------------

    // 1) Try to build a nice address from structured fields in the request
    const partsFromBody = [
      bodyAddressLine1,
      bodyBarangay,
      bodyCity,
      bodyProvince,
      bodyRegion,
      bodyPostalCode ? `PH ${bodyPostalCode}` : ""
    ].filter(Boolean);

    if (partsFromBody.length > 0) {
      address = partsFromBody.join(", ");
    }

    // Prepare shipping pieces (may be filled from profile)
    let shippingLine1    = bodyAddressLine1;
    let shippingRegion   = bodyRegion;
    let shippingProvince = bodyProvince;
    let shippingCity     = bodyCity;
    let shippingBarangay = bodyBarangay;
    let shippingPostal   = bodyPostalCode;

    // 2) If address is empty or just "Philippines", try user profile
    if (!address || address.toLowerCase() === "philippines") {
      try {
        const userDoc = await User.findById(userId).lean();

        if (userDoc) {
          // Fill missing name / contact from profile
          if (!name) {
            const full = userDoc.fullName ||
              `${userDoc.firstName || ""} ${userDoc.lastName || ""}`.trim();
            if (full) name = full;
          }
          if (!email) email = userDoc.email || email;
          if (!phone) phone = userDoc.phone || phone;

          // Fill missing structured address parts from profile
          shippingLine1    = shippingLine1    || (userDoc.addressLine1 || "");
          shippingRegion   = shippingRegion   || (userDoc.region || "");
          shippingProvince = shippingProvince || (userDoc.province || "");
          shippingCity     = shippingCity     || (userDoc.city || "");
          shippingBarangay = shippingBarangay || (userDoc.barangay || "");
          shippingPostal   = shippingPostal   || (userDoc.postalCode || "");

          const profParts = [
            userDoc.addressLine1,
            userDoc.barangay,
            userDoc.city,
            userDoc.province,
            userDoc.region,
            userDoc.postalCode ? `PH ${userDoc.postalCode}` : ""
          ].filter(Boolean);

          const composedFromProfile = profParts.join(", ");

          if (composedFromProfile) {
            address = composedFromProfile;
          } else if (userDoc.address) {
            // legacy flat address string
            address = userDoc.address;
          }
        }
      } catch (addrErr) {
        console.warn("⚠️ Failed to enrich address from user profile:", addrErr.message);
      }
    }

    // Final fallbacks
    if (!shippingLine1) shippingLine1 = address || "";
    if (!shippingRegion) shippingRegion = "Philippines";

    const shippingAddress = {
      addressLine1: shippingLine1,
      barangay: shippingBarangay || "",
      city: shippingCity || "",
      province: shippingProvince || "",
      region: shippingRegion,
      postalCode: shippingPostal || ""
    };


     // 🔒 STEP 1: Reserve stock per cart item (deduct on place order)
    //      – uses stable item.productId
    const successfulReservations = [];

    try {
      for (const item of cart) {
        const qty = Math.max(1, Number(item.quantity) || 1);

        const rawProdId = item.productId;
        if (!rawProdId) {
          console.error("❌ Cart item missing productId:", item);
          throw new Error(
            `Missing productId for item "${item.title || "Item"}"`
          );
        }

        const idStr     = String(rawProdId);
        const numericId = Number(idStr);
        const idFilter  = !isNaN(numericId) ? { _id: numericId } : { _id: idStr };

        const productDoc = await Product.findOne(idFilter);
        if (!productDoc) {
          throw new Error(`Product not found for id ${idStr}`);
        }

        const variantSku =
          item.variant?.sku ||
          item.sku ||
          item.variantSku || // just in case ibang field name gamit sa cart
          null;
        if (variantSku) {
          // 🧩 per-variant stock
          const v = (productDoc.variants || []).find(v => v.sku === variantSku);
          if (!v) {
            throw new Error(
              `Variant ${variantSku} not found for product ${idStr}`
            );
          }
          const currentStock = Number(v.stock ?? 0);
          if (currentStock < qty) {
            throw new Error(
              `Not enough stock for variant "${variantSku}". Requested ${qty}, available ${currentStock}.`
            );
          }
          v.stock = currentStock - qty;
        } else {
          // 🧩 base product stock
          const currentStock = Number(productDoc.stock ?? 0);
          if (currentStock < qty) {
            throw new Error(
              `Not enough stock for "${item.title || productDoc.title}". Requested ${qty}, available ${currentStock}.`
            );
          }
          productDoc.stock = currentStock - qty;
        }

        await productDoc.save();

        successfulReservations.push({
          productId: productDoc._id,
          variantSku,
          qty
        });
      }
    } catch (stockErr) {
      console.error("❌ Stock reservation failed:", stockErr);

      // best-effort rollback
      for (const r of successfulReservations) {
        try {
          const idStr     = String(r.productId);
          const numericId = Number(idStr);
          const filter    = !isNaN(numericId) ? { _id: numericId } : { _id: idStr };

          const productDoc = await Product.findOne(filter);
          if (!productDoc) continue;

          if (r.variantSku) {
            const v = (productDoc.variants || []).find(v => v.sku === r.variantSku);
            if (!v) continue;
            v.stock = Number(v.stock ?? 0) + r.qty;
          } else {
            productDoc.stock = Number(productDoc.stock ?? 0) + r.qty;
          }

          await productDoc.save();
        } catch (rollbackErr) {
          console.error("⚠️ Failed rollback for", r.productId, rollbackErr);
        }
      }

      return res.status(400).json({
        success: false,
        message: stockErr.message || "Failed to reserve stock for this order. Please try again.",
      });
    }


    // ------------------------------------------------------------
    // 💰 STEP 2: Compute totals (same as before)
    // ------------------------------------------------------------
    const shipping   = 100;
    const subtotal   = cart.reduce(
      (sum, it) =>
        sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    const totalAmount = subtotal + shipping;

    // ------------------------------------------------------------
    // 🧾 STEP 3: Create the order (now that stock is locked)
    //      ⬅️ shippingAddress is now saved on the order
    // ------------------------------------------------------------
    const order = await Order.create({
      userId,
      name,
      email,
      phone,
      address,           // keep legacy flat address string
      shippingAddress,   // 👈 NEW: structured shipping subdocument
      cart,
      subtotal,
      shipping,
      totalAmount,
      paymentMethod,
      codLandmark,
      fulfillment,
      status: "Pending",
      paymentMeta: {
        amountSent,
        receiptUrl,
      },
    });

    // ------------------------------------------------------------
    // ✉️ STEP 4: Build EmailJS template + optional server email
    // ------------------------------------------------------------
    const emailTemplate = buildOrderEmailTemplate(order);

    // Optional: server-side EmailJS (controlled by EMAILJS_ENABLE_SERVER)
// ------------------------------------------------------------
// ✉️ STEP 4: Try to send order confirmation email via EmailJS
// ------------------------------------------------------------
try {
  const emailOk = await sendOrderConfirmationEmail(order);

  if (!emailOk) {
    console.warn(
      "⚠️ Order created, but EmailJS did not send (orderId: %s, email: %s)",
      order.orderId || String(order._id),
      order.email
    );
  } else {
    console.log(
      "✅ Order confirmation email sent (orderId: %s, email: %s)",
      order.orderId || String(order._id),
      order.email
    );
  }
} catch (err) {
  console.error(
    "❌ Failed to send order confirmation email (server-side):",
    err
  );
}


    return res.json({
      success: true,
      message: "Order placed successfully!",
      order,
      emailTemplate, // 👈 used by checkout.js
    });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({
      success: false,
      message: "Server error creating order",
      error: err.message,
    });
  }
});





// --- auth helper: extracts userId from JWT if present ---
function getUserIdFromAuth(req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
}


// 🧾 GET /api/orders?limit=10&page=1&status=Pending&payment=COD|GCash|Bank|wallet
app.get("/api/orders", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 100);
    const page  = Math.max(parseInt(req.query.page  || "1", 10), 1);
    const { status, payment } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (payment) {
      if (payment.toLowerCase() === "wallet") {
        filter.paymentMethod = { $in: ["GCash", "Bank"] };
      } else {
        filter.paymentMethod = payment;
      }
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .select(
        "orderId name email phone address shippingAddress " +
        "paymentMethod totalAmount status fulfillment codLandmark paymentMeta cart createdAt"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      orders,
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Server error fetching orders" });
  }
});

// 🧾 CLIENT: Fetch orders for the logged-in user only
// GET /api/my-orders?limit=50&page=1
app.get("/api/my-orders", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const page  = Math.max(parseInt(req.query.page  || "1", 10), 1);

    const meId = String(req.user.id || "");

    // Detect how Order.userId is defined in the schema at runtime
    const userIdPath = Order.schema.path('userId');
    const userIdInstance = userIdPath ? (userIdPath.instance || '') : '';
    const isObjIdUserId  = userIdInstance === 'ObjectId' || userIdInstance === 'ObjectID';
    const isStringyUserId = userIdInstance === 'String' || userIdInstance === 'Mixed';

    const or = [];

    // If your schema has a separate 'user' ObjectId field, include it
    or.push({ user: meId });

    if (isObjIdUserId) {
      // userId expects ObjectId — DO NOT pass USR… strings here
      or.push({ userId: meId });
    } else if (isStringyUserId) {
      // userId is string/mixed — allow either the raw mongo id string or the public USR code
      const mePublic = makeUserId(meId); // e.g., USR0A1189
      or.push({ userId: { $in: [meId, mePublic] } });
    } else {
      // Unknown config — safest minimal filter (still works for most setups)
      or.push({ userId: meId });
    }

    const filter = { $or: or };

    const total = await Order.countDocuments(filter);
    const docs  = await Order.find(filter)
      .select("orderId name paymentMethod totalAmount status fulfillment codLandmark paymentMeta cart createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Build a compact, UI-friendly payload
    const toItemsText = (cart = []) => {
      const items = cart.slice(0, 3).map(it => `${it.title || 'Item'} ×${it.quantity || 1}`).join(", ");
      return items + (cart.length > 3 ? ` (+${cart.length - 3} more)` : "");
    };

    const mapUIStatus = (s) => {
      s = String(s || "").toLowerCase();
      if (["cancelled", "canceled"].includes(s)) return "cancelled";
      if (["completed", "delivered"].includes(s)) return "completed";
      if (["on delivery", "on-delivery", "shipping", "out for delivery", "out-for-delivery"].includes(s)) return "on-delivery";
      if (["paid", "confirmed", "processing", "packed", "preparing"].includes(s)) return "processing";
      return "to-pay"; // default for brand new "Pending" orders
    };

    const orders = docs.map(o => ({
      id: String(o._id),
      code: o.orderId || String(o._id),
      items: toItemsText(o.cart || []),
      total: Number(o.totalAmount || 0),
      dateISO: o.createdAt ? new Date(o.createdAt).toISOString() : null,
      rawStatus: o.status || "Pending",
      status: mapUIStatus(o.status),
      paymentMethod: o.paymentMethod || "COD",
      fulfillment: o.fulfillment || "Delivery"
    }));

    res.json({
      success: true,
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      orders
    });
  } catch (err) {
    console.error("❌ /api/my-orders error:", err);
    res.status(500).json({ success: false, message: "Server error fetching my orders" });
  }
});

// 🧾 CLIENT: Fetch a single order the user owns
// GET /api/my-orders/:id
app.get("/api/my-orders/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success:false, message:"Missing id" });

    // find by _id first, fallback to orderId
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id).lean();
    }
    if (!order) {
      order = await Order.findOne({ orderId: id }).lean();
    }
    if (!order) {
      return res.status(404).json({ success:false, message:"Order not found" });
    }

    // ensure it belongs to the current user
    const meId = String(req.user.id);
    const allowedUserIds = [meId, makeUserId(meId)];
    const belongs = (allowedUserIds.includes(String(order.userId))) || (String(order.user) === meId);
    if (!belongs) {
      return res.status(403).json({ success:false, message:"Not authorized for this order" });
    }

    // sanitize
    const safe = {
      id: String(order._id),
      code: order.orderId || String(order._id),
      name: order.name,
      email: order.email,
      phone: order.phone,
      address: order.address,
      paymentMethod: order.paymentMethod,
      fulfillment: order.fulfillment || "Delivery",
      subtotal: Number(order.subtotal || 0),
      shipping: Number(order.shipping || 0),
      totalAmount: Number(order.totalAmount || 0),
      status: order.status || "Pending",
      codLandmark: order.codLandmark || "",
      paymentMeta: {
        amountSent: order?.paymentMeta?.amountSent || null,
        receiptUrl: order?.paymentMeta?.receiptUrl || null
      },
      cart: order.cart || [],
      createdAt: order.createdAt
    };

    res.json({ success:true, order: safe });
  } catch (e) {
    console.error("❌ /api/my-orders/:id error:", e);
    res.status(500).json({ success:false, message:"Server error" });
  }
});


// ================================================================
// ✉️ EMAIL OTP ROUTE (Registration) - UPDATED
// ================================================================
app.post("/api/send-otp", async (req, res) => {
  try {
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`📩 OTP generated for ${email}: ${otp}`);
    console.log(`🔓 DEVELOPMENT: You can use OTP ${otp} to test`);

    let user = await User.findOne({ email });

    // If no user yet, create a lightweight pending record
    if (!user) {
      user = new User({
        firstName: "",
        lastName: "",
        fullName: "Pending Verification",
        email,
        password: "TEMP",
      });
    }

    user.registerOtp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    await user.save();

    console.log(`📧 Attempting to send OTP email to ${email}...`);
    
    const ok = await sendEmailThroughEmailJS(
      email,
      "Your Life in a Box Verification Code",
      `
        <h2>Email Verification</h2>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      otp
    );

    if (!ok) {
      console.log(`🛠️ DEVELOPMENT: Email failed but OTP is ${otp}`);
      
      // In development, return the OTP so you can test
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          success: true,
          message: `OTP generated but email failed. Use code: ${otp} for testing.`,
          development_otp: otp
        });
      } else {
        return res.status(502).json({
          success: false,
          message: "OTP generated but email service is currently unavailable. Please try again later.",
        });
      }
    }

    res.json({
      success: true,
      message: "Verification code sent to your email.",
    });

  } catch (err) {
    console.error("❌ Error in /api/send-otp:", err);
    res.status(500).json({
      success: false,
      message: "Server error generating OTP",
      error: err.message
    });
  }
});

// ================================================================
// ✅ VERIFY OTP + AUTO-LOGIN (DEBUG VERSION)
// ================================================================
app.post("/api/verify-otp", async (req, res) => {
  try {
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();
    const otpInput = String(req.body.otp || "").trim();
    const registrationData = req.body.registrationData || {};

    console.log('📥 Received OTP verification request:', {
      email: email,
      otp: otpInput,
      hasRegistrationData: !!registrationData,
      registrationData: registrationData
    });

    if (!email || !otpInput) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email });
    console.log(`📋 User found in database:`, user ? {
      email: user.email,
      passwordIsTemp: user.password === "TEMP",
      hasOtp: !!user.registerOtp,
      otp: user.registerOtp,
      firstName: user.firstName,
      lastName: user.lastName
    } : 'No user found');

    if (!user || user.registerOtp == null || !user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this email. Please request a new code.",
      });
    }

    const now = Date.now();
    const expiresAt = new Date(user.otpExpires).getTime();

    if (now > expiresAt) {
      user.registerOtp = null;
      user.otpExpires = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new code.",
      });
    }

    if (String(user.registerOtp) !== otpInput) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please double-check and try again.",
      });
    }

    console.log(`✅ OTP verified for: ${email}`);

    // ✅ Complete the user registration (convert from temporary to real user)
    if (user.password === "TEMP") {
      const { firstName, lastName, password } = registrationData;
      
      console.log(`🔄 Attempting to convert temp user with data:`, {
        firstName, lastName, hasPassword: !!password
      });
      
      if (firstName && lastName && password) {
        console.log(`🔄 Converting temp user to real user: ${email}`);
        
        user.firstName = firstName;
        user.lastName = lastName;
        user.fullName = `${firstName} ${lastName}`.trim();
        user.password = await bcrypt.hash(password, 10);
        user.role = "user";
        
        // Ensure stable public userId
        if (!user.userId) {
          user.userId = makeUserId(user._id);
        }
        
        console.log(`✅ User registration completed: ${email} (${user.fullName})`);
      } else {
        console.log(`❌ Missing registration data for conversion:`, {
          firstName: !!firstName,
          lastName: !!lastName, 
          password: !!password
        });
        return res.status(400).json({
          success: false,
          message: "Missing registration data. Please try registering again.",
        });
      }
    } else {
      console.log(`ℹ️ User is not a temporary user, skipping conversion`);
    }

    // Clear OTP and mark verified
    user.registerOtp = null;
    user.otpExpires = null;
    user.emailVerified = true;
    await user.save();

    console.log(`💾 User saved to database:`, {
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      passwordIsTemp: user.password === "TEMP"
    });

    // Generate JWT token for immediate login
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

    console.log(`🔑 Token generated for: ${email}`);

    res.json({
      success: true,
      message: "Registration completed successfully!",
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

  } catch (err) {
    console.error("❌ Error verifying OTP:", err);
    res.status(500).json({
      success: false,
      message: "Server error verifying OTP",
    });
  }
});

// ================================================================
// ✅ COMPLETE REGISTRATION AFTER OTP VERIFICATION
// ================================================================
app.post("/api/complete-registration", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if temporary user exists
    let user = await User.findOne({ email });
    if (!user || user.password !== "TEMP") {
      return res.status(400).json({
        success: false,
        message: "No pending registration found or already completed.",
      });
    }

    // Verify that email was verified
    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email not verified. Please complete OTP verification first.",
      });
    }

    // Update user with real data
    user.firstName = firstName;
    user.lastName = lastName;
    user.fullName = `${firstName} ${lastName}`.trim();
    user.password = await bcrypt.hash(password, 10);
    user.role = "user";
    
    // Ensure stable public userId
    if (!user.userId) {
      user.userId = makeUserId(user._id);
    }

    await user.save();

    console.log(`✅ Registration completed for: ${email} (${user.fullName})`);

    // Generate JWT token for immediate login
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

    res.json({
      success: true,
      message: "Registration completed successfully!",
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

  } catch (err) {
    console.error("❌ Error completing registration:", err);
    res.status(500).json({
      success: false,
      message: "Server error completing registration",
    });
  }
});


// ================================================================
// 🔁 FORGOT PASSWORD OTP ROUTE  (EmailJS handled on frontend)
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

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`🔐 Password reset OTP for ${email}: ${otp}`);

    // Store OTP on user
    user.resetOtp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // 👉 DO NOT call sendEmailThroughEmailJS here anymore.
    // Let the frontend send via EmailJS using the SAME template as registration.

    return res.json({
      success: true,
      message: "OTP generated successfully.",
      // For this project it's okay to always return it so the frontend can send email:
      otp
    });
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

    const expiresAt = user.otpExpires ? new Date(user.otpExpires).getTime() : 0;

    if (String(user.resetOtp) !== otpStr) {
      console.log("❌ Invalid OTP: input vs stored", otpStr, user.resetOtp);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > expiresAt) {
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



// ===============================
// 🧱 AVAILABILITY BLOCKS (Admin)
// ===============================
// List blocks within a (start, end) date range (YYYY-MM-DD)
app.get('/api/blocks', requireAdmin, async (req, res) => {
  try {
    const { start, end } = req.query; // end is exclusive
    const q = {};
    if (start || end) {
      q.date = {};
      if (start) q.date.$gte = String(start);
      if (end)   q.date.$lt  = String(end);
    }
    const blocks = await Block.find(q).sort({ date: 1, start: 1 }).lean();
    res.json({ success: true, blocks });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Create a block (whole day or time window)
app.post('/api/blocks', requireAdmin, async (req, res) => {
  try {
    const { date, allDay, start, end, note } = req.body;
    if (!date) return res.status(400).json({ success:false, message:'date is required' });

    if (allDay === false) {
      if (!start || !end) {
        return res.status(400).json({ success:false, message:'start and end are required when allDay=false' });
      }
    }

    const doc = await Block.create({
      date: String(date),
      allDay: !!allDay,
      start: allDay ? null : String(start),
      end:   allDay ? null : String(end),
      note:  (note || '').slice(0, 300)
    });

    res.status(201).json({ success:true, block: doc });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
});

// Update a block
app.put('/api/blocks/:id', requireAdmin, async (req, res) => {
  try {
    const { date, allDay, start, end, note } = req.body;
    const b = await Block.findById(req.params.id);
    if (!b) return res.status(404).json({ success:false, message:'Not found' });

    if (date !== undefined)  b.date  = String(date);
    if (allDay !== undefined) b.allDay = !!allDay;

    if (b.allDay) {
      b.start = null; b.end = null;
    } else {
      if (start !== undefined) b.start = String(start || '');
      if (end   !== undefined) b.end   = String(end   || '');
      if (!b.start || !b.end) {
        return res.status(400).json({ success:false, message:'start and end required when allDay=false' });
      }
    }

    if (note !== undefined) b.note = String(note || '').slice(0, 300);

    await b.save();
    res.json({ success:true, block:b });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
});

// Delete a block
app.delete('/api/blocks/:id', requireAdmin, async (req, res) => {
  try {
    const out = await Block.findByIdAndDelete(req.params.id);
    if (!out) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
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

// ✅ Get taken times for a specific date (ignore cancelled)
app.get("/api/bookings/availability", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date query is required (YYYY-MM-DD)",
      });
    }

    // 1) booked times
    const bookings = await Booking
      .find({ date, status: { $ne: "Cancelled" } })
      .select("time -_id");
    const taken = bookings.map(b => to24h(b.time));

    // 2) closure blocks
    const blocks = await Block.find({ date }).lean();

    const closedAllDay = blocks.some(b => b.allDay);
    const closedRanges = blocks
      .filter(b => !b.allDay)
      .map(b => ({ start: to24h(b.start), end: to24h(b.end) }));

    res.json({ success: true, taken, closedAllDay, closedRanges });
  } catch (err) {
    console.error("❌ Availability error:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching availability",
    });
  }
});


// ✅ Create a new booking (stores service, ignores cancelled in conflict check)
app.post("/api/bookings", async (req, res) => {
  try {
    const { name, email, guests, date, time, notes, topics, service } = req.body; // +service

    if (!name || !email || !date || !time || !topics?.length) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: name, email, date, time, and topics are required.",
      });
    }

    const time24 = to24h(time);

    // prevent duplicate booking on normalized slot (ignore cancelled)
    const existingBooking = await Booking.findOne({
      date,
      time: time24,
      status: { $ne: "Cancelled" },
    });
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: `The slot ${date} at ${time24} is already booked. Please select another time.`,
      });
    }

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
      service: (service || "General Consultation").trim(),
      status: "Pending",
    });

    await newBooking.save();
    console.log(`✅ Booking saved: ${name} @ ${date} ${time24} (${newBooking.service})`);

    // ✅ No EmailJS here anymore — emails are sent from booking.js in the browser

    res.json({
      success: true,
      message: "Booking scheduled successfully!",
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

// ================================================================
// 📧 EMAILJS — APPOINTMENT CONFIRMATION TEMPLATE (SERVER-SIDE)
//    Uses template_aa2rtu7 (your appointment HTML code editor)
// ================================================================
async function sendAppointmentEmail({
  toEmail,
  toName,
  date,
  time,
  service,
  topics,
  notes,
  guests,
  appointmentUrl
}) {
  const EMAILJS_SERVICE_ID = "service_2bfbogr";      // ✅ same as OTP
  const EMAILJS_PUBLIC_KEY = "hhTpOoi07kd04LwsH";   // ✅ same as OTP
  const EMAILJS_TEMPLATE_ID = "template_aa2rtu7";   // ✅ your appointment template

  const safeName = toName || (toEmail ? toEmail.split("@")[0] : "Guest");

  const templateParams = {
    // must match variables you used in the EmailJS template
    to_name: safeName,
    to_email: toEmail,

    brand: "Life in a Box", // or "Chase Aquatics"
    submitted_at: new Date().toLocaleString(),

    service: service || "General Consultation",
    date,
    time,

    // matches your site footer address
    location:
      "Paseo de Carmona, Unit 8 Lot E/F Paseo Square, Governor's Dr, Carmona, 4116 Cavite",

    topics: Array.isArray(topics) ? topics.join(", ") : (topics || ""),
    notes: notes || "",
    guests: Array.isArray(guests) ? guests.join(", ") : (guests || ""),

    appointment_url: appointmentUrl || ""
  };

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: templateParams
  };

  try {
    console.log("📨 Sending appointment email via EmailJS:", {
      toEmail,
      template: EMAILJS_TEMPLATE_ID
    });

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log("📨 Appointment EmailJS status:", response.status, text);

    return response.ok;
  } catch (err) {
    console.error("❌ Appointment EmailJS error:", err.message);
    return false;
  }
}

// ================================================================
// 📧 EMAILJS — ORDER CONFIRMATION TEMPLATE (PRODUCT RECEIPT)
//    Uses service_1c8lq6n + template_3v3z8n7 (HTML code editor)
//    Search tag: sendOrderConfirmationEmail
// ================================================================

// 🔹 Helper: build EmailJS template params for this order
function buildOrderEmailTemplate(order) {
  if (!order) return null;

  const toEmail = order.email || "";
  const toName =
    order.name ||
    (typeof toEmail === "string" && toEmail.includes("@")
      ? toEmail.split("@")[0]
      : "Customer");

  const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const cart = Array.isArray(order.cart) ? order.cart : [];
  const itemsHtml = cart
    .map((item) => {
      const title = item.title || "Item";
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const lineTotal = price * qty;

      // Make sure this is an absolute URL if you want images to show in emails
      const imgUrl =
        item.image && item.image.startsWith("http") ? item.image : "";

      const safeImg =
        imgUrl || "https://via.placeholder.com/40x40?text=%20";

      return `
        <tr>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td width="44" valign="top" style="padding-right:8px;">
                  <img
                    src="${safeImg}"
                    width="40"
                    height="40"
                    alt="${title}"
                    style="display:block;border-radius:6px;object-fit:cover;"
                  />
                </td>
                <td valign="middle"
                    style="font:400 13px/18px Montserrat,Arial,Helvetica,sans-serif;color:#111827;">
                  ${title}
                </td>
              </tr>
            </table>
          </td>
          <td align="right" style="padding:8px 12px;border-top:1px solid #e5e7eb;">
            ${qty}
          </td>
          <td align="right" style="padding:8px 12px;border-top:1px solid #e5e7eb;">
            ${peso(price)}
          </td>
          <td align="right" style="padding:8px 12px;border-top:1px solid #e5e7eb;">
            ${peso(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const subtotal    = Number(order.subtotal || 0);
  const shipping    = Number(order.shipping || 0);
  const totalAmount = Number(order.totalAmount || subtotal + shipping);

  // For now, VAT is 0 so totals match your DB
  const vatAmount = 0;

  return {
    // 👇 needed by your EmailJS template header
    to_email: toEmail,              // used by: To Email: {{to_email}}
    name:    "Life in a Box",       // used by: From Name: {{name}}

    // header + greeting
    to_name: toName,
    brand: "Life in a Box",
    submitted_at: new Date(order.createdAt || Date.now()).toLocaleString(),

    // order meta
    order_id: order.orderId || String(order._id),
    order_date: new Date(order.createdAt || Date.now()).toLocaleString(),
    order_status: order.status || "Pending",
    payment_method: order.paymentMethod || "COD",
    fulfillment_method: order.fulfillment || "Delivery",

    // shipping/contact info
    shipping_name: order.name || "",
    shipping_address_line1: order.address || "",
    shipping_barangay: "",
    shipping_city: "",
    shipping_province: "",
    shipping_postal: "",
    shipping_region: "",
    email: order.email || "",       // still here for Reply-To: {{email}}
    phone: order.phone || "",

    // number of items shown in the header box
    items_count: cart.length,

    // line items HTML (injected directly in template)
    items_html: itemsHtml,

    // totals
    subtotal_amount: subtotal.toFixed(2),
    vat_amount:      vatAmount.toFixed(2),
    shipping_amount: shipping.toFixed(2),
    total_amount:    totalAmount.toFixed(2),

    // optional link to order tracking page
    order_url: "",
  };
}


// 🔹 Main helper: sends order confirmation via EmailJS (server-side)
async function sendOrderConfirmationEmail(order) {
  if (!order || !order.email) {
    console.warn("⚠️ sendOrderConfirmationEmail called without order/email");
    return false;
  }

  const EMAILJS_SERVICE_ID = "service_1c8lq6n";
  const EMAILJS_TEMPLATE_ID = "template_3v3z8n7";
  const EMAILJS_PUBLIC_KEY = "HCwUJE1S2hr3TtLfB";

  const templateParams = buildOrderEmailTemplate(order);
  if (!templateParams) return false;

  // ✅ Default: ENABLE server-side send.
  // Only skip if you EXPLICITLY set EMAILJS_ENABLE_SERVER=false
  const enableServerSend = (process.env.EMAILJS_ENABLE_SERVER || "true").toLowerCase() !== "false";
  if (!enableServerSend) {
    console.log(
      "ℹ️ EMAILJS_ENABLE_SERVER=false, skipping server-side EmailJS send."
    );
    return false;
  }

  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: templateParams,
  };

  try {
    console.log("📨 Sending order confirmation via EmailJS:", {
      toEmail: order.email,
      template: EMAILJS_TEMPLATE_ID,
    });

    const response = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const text = await response.text();
    console.log("📨 Order EmailJS status:", response.status, text);

    return response.ok;
  } catch (err) {
    console.error("❌ Order EmailJS error:", err.message);
    return false;
  }
}


// ✅ Fetch bookings (Admin View) — supports date range + status + pagination
// GET /api/bookings?limit=10&page=1&status=Pending|Confirmed|Cancelled|Rescheduled&start=YYYY-MM-DD&end=YYYY-MM-DD
app.get("/api/bookings", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const page  = Math.max(parseInt(req.query.page  || "1", 10), 1);
    const { status, start, end } = req.query;

    const filter = {};
    if (status) filter.status = status;

    // Optional date range (inclusive start, exclusive end)
    if (start || end) {
      // Booking.date is stored as "YYYY-MM-DD"
      // We’ll use a string range filter since the format is lexical.
      filter.date = {};
      if (start) filter.date.$gte = String(start);
      if (end)   filter.date.$lt  = String(end);
    }

    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ date: 1, time: 1 }) // chronological when filtering a range
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      bookings
    });
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ success: false, message: "Server error fetching bookings" });
  }
});

// /////////////////////////////////////////////////////////////////
// 🔎 Admin Logs (paginated list + single)
// GET /api/admin-logs?limit=10&page=1&category=orders|inventory|appointments|...
app.get('/api/admin-logs', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 200);
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const { category } = req.query;

    const filter = {};
    if (category) filter.category = category;

    const total = await AdminLog.countDocuments(filter);
    const logs = await AdminLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      logs
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/admin-logs/:id', requireAdmin, async (req, res) => {
  try {
    const log = await AdminLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, log });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
// /////////////////////////////////////////////////////////////////



// ✅ Update a product (supports variants) + log changes
app.put('/api/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const idParam = req.params.id;
    const numericId = Number(idParam);
    const where = !isNaN(numericId) ? { _id: numericId } : { _id: idParam };

    const product = await Product.findOne(where);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const before = {
      price: product.price,
      stock: product.stock,
      variantsJson: JSON.stringify(product.variants || [])
    };

    // fields from FormData (admin.js)
    const {
      title,
      category,
      price,
      description,
      alt,
      price_unit,
      stock,
      variants: variantsRaw // 👈 JSON string from FormData
    } = req.body;

    // === basic fields ===
    if (title      !== undefined) product.title       = title;
    if (category   !== undefined) product.category    = category;
    if (price      !== undefined) product.price       = Number(price) || 0;
    if (stock      !== undefined) product.stock       = Number(stock) || 0;
    if (description!== undefined) product.description = description;
    if (alt        !== undefined) product.alt         = alt;
    if (price_unit !== undefined) product.price_unit  = price_unit;

    // === variants (JSON string → array) ===
    if (variantsRaw !== undefined) {
      try {
        const parsed = JSON.parse(variantsRaw);
        if (Array.isArray(parsed)) {
          product.variants = parsed;
        } else {
          console.warn("⚠️ PUT /api/products/:id - variants is not array:", parsed);
        }
      } catch (e) {
        console.warn("⚠️ PUT /api/products/:id - failed to parse variants JSON:", e, variantsRaw);
      }
    }

    // image upload
    if (req.file) {
      product.image = `/uploads/${req.file.filename}`;
    }

    await product.save();

    // 🔏 log
    try {
      const afterVariantsJson = JSON.stringify(product.variants || []);
      await logAdminAction(req, {
        category: 'inventory',
        action: 'PRODUCT_UPDATED',
        target: { type: 'product', id: String(product._id), name: product.title },
        meta: {
          priceChanged: before.price !== product.price,
          oldPrice: before.price, newPrice: product.price,
          stockChanged: before.stock !== product.stock,
          oldStock: before.stock, newStock: product.stock,
          variantsChanged: before.variantsJson !== afterVariantsJson
        }
      });
    } catch (e) {
      console.warn('log fail (PRODUCT_UPDATED):', e.message);
    }

    res.json({ success: true, message: 'Product updated', product });
  } catch (err) {
    console.error('❌ Product update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating product' });
  }
});

// ✅ Delete a product (and clean up carts) + admin log
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const idParam   = req.params.id;
    const numericId = Number(idParam);
    const filter    = !isNaN(numericId) ? { _id: numericId } : { _id: idParam };

    // Hanapin muna para makuha title / _id
    const product = await Product.findOne(filter);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Totoong delete sa DB
    await Product.deleteOne({ _id: product._id });

    // Optional: alisin din sa cart items
    try {
      await Cart.updateMany(
        { 'items.productId': product._id },
        { $pull: { items: { productId: product._id } } }
      );
    } catch (e) {
      console.warn('⚠️ Failed to clean up carts for deleted product:', e.message);
    }

    // 📝 Admin log
    try {
      await logAdminAction(req, {
        category: 'inventory',
        action: 'PRODUCT_DELETED',
        target: { type: 'product', id: String(product._id), name: product.title },
        meta: {}
      });
    } catch (e) {
      console.warn('log fail (PRODUCT_DELETED):', e.message);
    }

    return res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    console.error('❌ Product delete error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting product'
    });
  }
});


// helper: restore stock for all items in an order (used when cancelling)
async function restoreStockForOrder(orderDoc) {
  if (!orderDoc || !Array.isArray(orderDoc.cart)) {
    console.warn("restoreStockForOrder: no cart on order", orderDoc && orderDoc._id);
    return;
  }

  for (const item of orderDoc.cart) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    if (!qty) continue;

    // ⚠️ HUWAG item._id / item.id (subdoc lang yun, hindi product id)
    let rawProdId =
      item.productId ||
      (item.product && (item.product._id || item.product.id));

    let productDoc = null;

    if (rawProdId) {
      const idStr     = String(rawProdId);
      const numericId = Number(idStr);
      const filter    = !isNaN(numericId) ? { _id: numericId } : { _id: idStr };
      productDoc = await Product.findOne(filter);
      if (!productDoc) {
        console.warn("restoreStockForOrder: product not found for", filter);
      }
    }

    // 🔁 Fallback: try by title kung walang productId sa cart
    if (!productDoc && item.title) {
      productDoc = await Product.findOne({ title: item.title });
      if (productDoc) {
        console.log(
          "🔁 restoreStockForOrder: matched by title →",
          item.title,
          "→",
          productDoc._id
        );
      }
    }

    if (!productDoc) {
      console.warn("restoreStockForOrder: could not resolve product for item", {
        order: orderDoc._id,
        cartItem: item,
      });
      continue;
    }

    const variantSku =
      item.variant?.sku ||
      item.sku ||
      item.variantSku ||
      null;

    if (variantSku) {
      const v = (productDoc.variants || []).find((v) => v.sku === variantSku);
      if (!v) {
        console.warn(
          "restoreStockForOrder: variant not found",
          variantSku,
          "for product",
          productDoc._id
        );
        continue;
      }
      const before = Number(v.stock ?? 0);
      v.stock = before + qty;
      console.log(
        `🔁 Restored variant stock: prod=${productDoc._id} sku=${variantSku} ${before}→${v.stock} (qty ${qty})`
      );
    } else {
      const before = Number(productDoc.stock ?? 0);
      productDoc.stock = before + qty;
      console.log(
        `🔁 Restored base stock: prod=${productDoc._id} ${before}→${productDoc.stock} (qty ${qty})`
      );
    }

    await productDoc.save();
  }
}





// ✅ Update order status (Admin) + log + restore stock on cancel
// ✅ Update order status (Admin) + log + restore stock on cancel (with flag)
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    console.log('📝 PUT /api/orders/:id/status', { id, status, body: req.body });

    if (!status) {
      return res.status(400).json({ success: false, message: 'Missing status' });
    }

    // 🔍 Huwag basta-basta mag-findById kung hindi valid ObjectId
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    } else {
      console.warn('⚠️ /api/orders/:id/status got non-ObjectId id, will try orderId lookup:', id);
    }

    // 🔁 Fallback: hanapin gamit orderId (e.g. "ORD-000123")
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      console.warn('⚠️ Order not found for id/orderId:', id);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const prevStatus = order.status || 'Pending';

    // 🔹 Normalize strings (handle "Canceled"/"Cancelled", spaces, casing)
    const prevNorm = String(prevStatus).trim().toLowerCase();
    const newNorm  = String(status).trim().toLowerCase();

    const isNewCancelled =
      newNorm === 'cancelled' || newNorm === 'canceled';

    // 🧷 Flag para hindi double-restore ng stock
    const alreadyRestored = !!order.stockRestored;
    let stockRestored = alreadyRestored;

    // 🔒 Restore stock ONE-TIME kapag naging Cancelled
    if (isNewCancelled && !alreadyRestored) {
      try {
        console.log(
          `🔁 Restoring stock for order ${order._id} (status ${prevStatus} → ${status})`
        );
        await restoreStockForOrder(order);
        stockRestored = true;
        order.stockRestored = true; // mark na nabalik na ang stock
      } catch (stockErr) {
        console.error('❌ Failed to restore stock for cancelled order:', stockErr);
        return res.status(500).json({
          success: false,
          message: 'Failed to restore stock for this order. Status not changed.',
        });
      }
    }

    // 💾 Save final status
    order.status = status;
    await order.save();

    const actionMap = {
      Confirmed: 'ORDER_CONFIRMED',
      Paid:      'ORDER_MARKED_PAID',
      Completed: 'ORDER_COMPLETED',
      Cancelled: 'ORDER_CANCELLED',
      Canceled:  'ORDER_CANCELLED'
    };
    const action = actionMap[status] || 'ORDER_UPDATED';

    try {
      await logAdminAction(req, {
        category: 'orders',
        action,
        target: {
          type: 'order',
          id: order.orderId || order._id.toString(),
          name: order.name,
        },
        meta: {
          previousStatus: prevStatus,
          newStatus: status,
          total: order.totalAmount,
          stockRestored,
        },
      });
    } catch (e) {
      console.warn('log fail (order status):', e.message);
    }

    res.json({ success: true, message: 'Order status updated', order });
  } catch (err) {
    console.error('❌ Order status update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
});





// ✅ Update appointment status or reschedule + log (conflict check + normalized time)
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, newDate, newTime } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const before = { date: booking.date, time: booking.time, status: booking.status || 'Pending' };

    // 🔁 reschedule flow
    if (newDate || newTime) {
      if (!newDate || !newTime) {
        return res.status(400).json({ success: false, message: "Both newDate and newTime are required to reschedule." });
      }

      const normalizedTime = to24h(newTime);

      // prevent conflict on target slot (ignore cancelled; skip self)
      const conflict = await Booking.findOne({
        _id: { $ne: booking._id },
        date: newDate,
        time: normalizedTime,
        status: { $ne: "Cancelled" },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: "Target slot already taken." });
      }

      booking.date = newDate;
      booking.time = normalizedTime;
      booking.status = 'Rescheduled';
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

    // 🏷️ plain status update
    if (status) {
      booking.status = status;
      await booking.save();

      let action = null;
      if (status === 'Confirmed') action = 'APPT_CONFIRMED';
      if (status === 'Cancelled') action = 'APPT_CANCELLED';

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

      return res.json({ success: true, message: 'Appointment updated', booking });
    }

    return res.status(400).json({ success: false, message: "No valid update payload." });
  } catch (err) {
    console.error('❌ Appointment update error:', err);
    res.status(500).json({ success: false, message: 'Server error updating appointment' });
  }
});






// ================================================================
// 🌐 LANDING PAGE
// ================================================================


// 🌐 LANDING PAGE (keep only this one)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landingpage.html'));
});

// 🚀 Start server (keep at the very bottom)
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});


// ================================================================
// 🛡️ ADMIN: VALID ID REVIEW
// PUT /api/admin/valid-id/:userId
// body: { status: 'pending|approved|rejected|declined|none', note?: string }
// ================================================================
app.put('/api/admin/valid-id/:userId', requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const norm = String(status || '').toLowerCase();

    const allowed = ['pending', 'approved', 'rejected', 'declined', 'none'];
    if (!allowed.includes(norm)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const userDoc = await User.findById(req.params.userId);
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const prev = userDoc.validId || {};
    userDoc.validId = {
      ...prev,
      status: norm,
      note: note || prev.note || '',
      reviewedAt: new Date(),
      reviewedBy: req.user.id || req.user._id
    };

    await userDoc.save();

    // optional log
    try {
      await logAdminAction(req, {
        category: 'verification',
        action: 'VALID_ID_REVIEWED',
        target: { type: 'user', id: String(userDoc._id), name: userDoc.fullName || userDoc.email },
        meta: { from: prev.status || 'none', to: norm }
      });
    } catch (e) {
      console.warn('log fail (VALID_ID_REVIEWED):', e.message);
    }

    res.json({ success: true, validId: userDoc.validId });
  } catch (err) {
    console.error('PUT /api/admin/valid-id error:', err);
    res.status(500).json({ success: false, message: 'Error updating Valid ID' });
  }
});
