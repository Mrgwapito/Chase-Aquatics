document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Checkout Page Loaded");

  // ----------------------------------------------------
  // Env + helpers (aligned with cart.js / order_summary.js)
  // ----------------------------------------------------
  // ✅ Backend base URL (local + Render) — shared across scripts
  const API_BASE =
    window.__API_BASE__ ||
    ((window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost")
      ? "http://127.0.0.1:3000"                 // local dev
      : "https://chase-aquatics.onrender.com"); // deployed backend

  // expose globally so other scripts can reuse it
  window.__API_BASE__ = window.__API_BASE__ || API_BASE;

  function authToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
  }
  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem("user")) ||
             JSON.parse(sessionStorage.getItem("user")) || null;
    } catch { return null; }
  }
  function getCartKey() {
    const u = currentUser();
    return u?.id ? `cart_${u.id}` : "cart_guest";
  }
  function loadCartLS() {
    return JSON.parse(localStorage.getItem(getCartKey())) || [];
  }
  function saveCartLS(c) {
    localStorage.setItem(getCartKey(), JSON.stringify(c));
  }
  async function fetchServerCart() {
    const token = authToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("fetch cart failed");
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      console.warn("⚠️ fetchServerCart failed:", e.message);
      return null;
    }
  }
  let _pushTimer = null;
  function pushServerCartDebounced(items) {
    const token = authToken();
    if (!token) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/cart`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            items: (items || []).map(it => ({
              productId: it._id || it.productId,
              quantity: it.quantity,
              title: it.title,
              price: it.price,
              image: it.image
            }))
          })
        });
      } catch (e) {
        console.warn("⚠️ pushServerCartDebounced failed:", e.message);
      }
    }, 250);
  }
  function normalizeServerItems(items) {
    return (items || []).map(it => ({
      _id: String(it.productId || it._id),
      title: it.title,
      price: it.price,
      image: it.image,
      quantity: Number(it.quantity) || 1
    }));
  }

  // ----------------------------------------------------
  // DOM
  // ----------------------------------------------------
  const itemsContainer = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const vatEl = document.getElementById("checkout-vat");
  const shippingEl = document.getElementById("checkout-shipping");

  const shipping = 100;       // flat shipping for now (BMBE / non-VAT)
  let latestTotals = null;    // used later for thankyou page
  let checkoutSelection = null; // 🆕 holds selected items for this checkout




  // Form fields
  const nameInput = document.getElementById("custName");
  const emailInput = document.getElementById("custEmail");
  const phoneInput = document.getElementById("custPhone");
  const addressInput = document.getElementById("custAddress");

  let userData = null;
  const token = authToken();

  // ----------------------------------------------------
  // STEP 1: require login
  // ----------------------------------------------------
  // ----------------------------------------------------
  // STEP 1: require login
  // ----------------------------------------------------
  if (!token) {
    // Use toast + flash message for consistency
    if (window.Toast && typeof window.Toast.queueFlashToast === 'function') {
      window.Toast.queueFlashToast({
        title: 'Please log in',
        message: 'Create an account or sign in before checking out.',
        type: 'error',
        duration: 5000,
        position: 'top'
      });
    } else {
      // Fallback (only if toast is not loaded for some reason)
      alert("⚠️ Please log in first before checking out.");
    }

    window.location.href = "../index.html";
    return;
  }



  
  // ----------------------------------------------------
  // STEP 2: load user profile (gives us stable user.id)
  // ----------------------------------------------------
  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Profile fetch failed:", errorText);
      alert("⚠️ Session expired or unauthorized. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
      return;
    }

    const data = await res.json();
    if (data.success && data.user) {
      userData = data.user; // <- has `id` (Mongo ObjectId)
      console.log("👤 Loaded user profile:", userData);

      // Pre-fill form
      nameInput.value = userData.fullName || "";
      emailInput.value = userData.email || "";
      phoneInput.value = userData.phone || "";
      addressInput.value = userData.address || "";
    } else {
      alert("⚠️ Unable to load user profile. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
      return;
    }
  } catch (err) {
    console.error("❌ Failed to load user info:", err);
    alert(
      "⚠️ Unable to connect to backend. Make sure:\n" +
      "1️⃣ Node.js server is running (npm run dev)\n" +
      "2️⃣ You're using Live Server (http://localhost:5500)\n" +
      "3️⃣ Port 3000 is not blocked by firewall"
    );
    return;
  }

  // ----------------------------------------------------
  // STEP 3: load cart (LS first, then server override, then selection)
  // ----------------------------------------------------
  // 1) Start from localStorage (same pattern as order_summary.js)
  let cart = loadCartLS();

  if (token) {
    const serverItems = await fetchServerCart();
    const serverCart = normalizeServerItems(serverItems || []);

    if (serverCart.length > 0) {
      // ✅ Server has items – trust server & sync LS
      cart = serverCart;
      saveCartLS(cart);
      console.log("🛒 Checkout using SERVER cart:", cart);
    } else {
      console.log("ℹ️ Checkout using LOCAL cart (server empty):", cart);
    }
  } else {
    console.log("👤 Guest checkout using LOCAL cart:", cart);
  }

  // 🆕 Use selection from cart popup if it exists
  try {
    const selectedRaw = sessionStorage.getItem('checkoutItems');
    if (selectedRaw) {
      const selected = JSON.parse(selectedRaw);
      if (Array.isArray(selected) && selected.length > 0) {
        checkoutSelection = selected;
        cart = selected;
        console.log("🧺 Checkout using SELECTED items from cart popup:", cart);
      }
    }
  } catch (e) {
    console.warn("⚠️ Failed to read checkoutItems from sessionStorage:", e);
  }

  if (!cart.length) {
    itemsContainer.innerHTML = `<p class="text-center text-muted py-4">Your cart is empty.</p>`;
    const btn = document.querySelector("button[type='submit']");
    if (btn) btn.disabled = true;
    return;
  }


  // Render items + totals
  let subtotal = 0;
  itemsContainer.innerHTML = "";
  cart.forEach((item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    const itemTotal = price * qty;
    subtotal += itemTotal;

    const safeImg = item.image?.startsWith("http")
      ? item.image
      : `../${String(item.image || "").replace(/^\//, "")}`;

    const itemHTML = `
      <div class="order-item d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
        <div class="d-flex align-items-center">
          <img src="${safeImg}" alt="${item.title}"
               style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-right:12px;"
               onerror="this.src='../images/placeholder.jpg'">
          <div class="order-item-info">
            <h6 class="mb-0">${item.title}</h6>
            <p class="text-muted mb-0 small">₱${price.toFixed(2)} × ${qty}</p>
          </div>
        </div>
        <strong>₱${itemTotal.toFixed(2)}</strong>
      </div>
    `;
    itemsContainer.insertAdjacentHTML("beforeend", itemHTML);
  });

  // 💰 Subtotal + VAT + Shipping
  // For computation: VAT is 12% of the subtotal.
const grossSubtotal = subtotal;   // item subtotal
const VAT_RATE = 0.12;           // 12% standard VAT
const vatAmount = parseFloat((grossSubtotal * VAT_RATE).toFixed(2));

// remember totals so we can show on thankyou page
latestTotals = {
  subtotal: grossSubtotal,
  vat: vatAmount,
  shipping,
  total: grossSubtotal + vatAmount + shipping,
};

if (subtotalEl) subtotalEl.textContent = `₱${grossSubtotal.toFixed(2)}`;
if (vatEl)      vatEl.textContent      = `₱${vatAmount.toFixed(2)}`;
if (shippingEl) shippingEl.textContent = `₱${shipping.toFixed(2)}`;
if (totalEl)    totalEl.textContent    = `₱${latestTotals.total.toFixed(2)}`;



// ----------------------------------------------------
// STEP 4: place order  (now sends payment + fulfillment fields)
// ----------------------------------------------------
const checkoutForm = document.getElementById("checkout-form");
if (!checkoutForm) {
  console.error("❌ checkout-form not found!");
} else {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!userData) {
      alert("⚠️ Unable to confirm user information.");
      return;
    }

    // Read payment selections/fields
    const method = (document.querySelector('input[name="paymentMethod"]:checked')?.value || "COD").trim();
    const codLandmarkEl = document.getElementById("codLandmark");
    const payAmountEl   = document.getElementById("payAmount");
    const payReceiptEl  = document.getElementById("payReceipt");
    const fulfill       = document.querySelector('input[name="fulfillment"]:checked')?.value || "Delivery";

    // Make sure we have a stable userId (id / _id / userId)
    const storedUser = currentUser();
    const userId =
      (userData && (userData.id || userData._id || userData.userId)) ||
      (storedUser && (storedUser.id || storedUser._id || storedUser.userId)) ||
      null;

    if (!userId) {
      console.error("❌ No userId found in userData or stored user:", { userData, storedUser });
      alert("⚠️ Unable to determine your account ID. Please log in again.");
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.href = "../index.html";
      return;
    }

    // Build a structured shipping address based on profile + checkout input
    const fullAddress = (addressInput.value || "").trim() ||
                        (userData && userData.address) ||
                        "";

    const shippingAddress = {
      line1:      fullAddress,
      barangay:   userData?.barangay   || "",
      city:       userData?.city       || "",
      province:   userData?.province   || "",
      region:     userData?.region     || "",
      postalCode: userData?.postalCode || "",
      country:    "Philippines",
    };

    const bodyFields = {
      userId:  userId,
      name:    nameInput.value.trim(),
      email:   emailInput.value.trim(),
      phone:   phoneInput.value.trim(),

      // keep the old flat address for backward compatibility
      address: fullAddress,

      // 🔹 NEW: send structured shipping address to backend
      shippingAddress,

      paymentMethod: method,
      codLandmark:   (codLandmarkEl && codLandmarkEl.value ? codLandmarkEl.value.trim() : ""),
      payAmount:     (payAmountEl && payAmountEl.value ? payAmountEl.value : ""),
      fulfillment:   fulfill,
      cart:          cart
    };



    try {
      let res;
      let data;

      // Use FormData only when a receipt file is attached for GCash/Bank
      const hasFile = (method === "GCash" || method === "Bank") && payReceiptEl && payReceiptEl.files && payReceiptEl.files[0];
      if (hasFile) {
        const fd = new FormData();
        // Append fields; stringify cart for multipart
        Object.keys(bodyFields).forEach((k) => {
          if (k === "cart") {
            fd.append("cart", JSON.stringify(bodyFields.cart));
          } else {
            fd.append(k, bodyFields[k] == null ? "" : String(bodyFields[k]));
          }
        });
        fd.append("payReceipt", payReceiptEl.files[0]);

        res = await fetch(`${API_BASE}/api/orders`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }, // don't set Content-Type manually
          body: fd
        });
      } else {
        // JSON for COD or wallet without file
        res = await fetch(`${API_BASE}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(bodyFields)
        });
      }

      // Parse response safely even if server returns HTML on error
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Unexpected server response: ${text.slice(0, 200)}`);
      }

      // ✅ Treat any response with data.success === true as success
// ✅ Treat any response with data.success === true as success
if (data && data.success) {
  // 🔔 Send order confirmation email via EmailJS (browser)
  try {
    const serverOrder = data.order || data.savedOrder || null;
    const orderId = serverOrder?.orderId || serverOrder?._id || data.orderId || "ORD-0000";

    console.log("🔄 Starting email sending process...");
    console.log("📧 Recipient:", bodyFields.email);
    console.log("🆔 Order ID:", orderId);

    // Build email template that MATCHES your EmailJS template parameters
    const emailTemplate = {
      // Basic recipient info
      to_email: bodyFields.email,
      to_name: bodyFields.name || bodyFields.email.split('@')[0],
      
      // Brand and submission info
      brand: "Life in a Box",
      submitted_at: new Date().toLocaleString(),
      
      // Order details (MUST match template variables)
      order_id: orderId,
      order_date: new Date().toLocaleString(),
      order_status: "Pending",
      payment_method: bodyFields.paymentMethod || "COD",
      fulfillment_method: bodyFields.fulfillment || "Delivery",
      
      // Customer info
      customer_name: bodyFields.name,
      email: bodyFields.email,
      phone: bodyFields.phone || "",
      
      // Shipping address
      shipping_name: bodyFields.name,
      shipping_address_line1: bodyFields.address || "",
      shipping_barangay: userData?.barangay || "",
      shipping_city: userData?.city || "",
      shipping_province: userData?.province || "",
      shipping_postal: userData?.postalCode || "",
      shipping_region: userData?.region || "Philippines",
      
      // Totals
      subtotal_amount: latestTotals?.subtotal?.toFixed(2) || '0.00',
      vat_amount: latestTotals?.vat?.toFixed(2) || '0.00',
      shipping_amount: latestTotals?.shipping?.toFixed(2) || '100.00',
      total_amount: latestTotals?.total?.toFixed(2) || '0.00',
      
      // Items count
      items_count: cart.length,
      
      // Items HTML
      items_html: buildItemsHTML(cart),
    };

    console.log("📄 Email template parameters:", emailTemplate);

    // Check if EmailJS is available and initialized
    if (window.emailjs) {
      console.log("✅ EmailJS is loaded in window");
      
      try {
        console.log("🔄 Initializing EmailJS...");
        emailjs.init("HCwUJE1S2hr3TtLfB");
        console.log("✅ EmailJS initialized successfully");
        
        console.log("🚀 Attempting to send email...");
        const result = await emailjs.send("service_1c8lq6n", "template_3v3z8n7", emailTemplate);
        
        console.log("🎉 EMAIL SENT SUCCESSFULLY!");
        console.log("📨 EmailJS Response:", result);
        
        if (window.Toast && typeof window.Toast.showToast === 'function') {
          window.Toast.showToast({
            title: 'Email Sent!',
            message: 'Order confirmation email sent successfully!',
            type: 'success',
            duration: 5000
          });
        }
        
      } catch (emailError) {
        console.error("💥 EMAIL SENDING FAILED!");
        console.error("❌ Error details:", emailError);
        
        if (window.Toast && typeof window.Toast.showToast === 'function') {
          window.Toast.showToast({
            title: 'Email Failed',
            message: 'Order placed but email failed: ' + (emailError.message || 'Unknown error'),
            type: 'error',
            duration: 10000
          });
        }
      }
      
    } else {
      console.error("❌ EmailJS NOT FOUND in window object!");
      
      if (window.Toast && typeof window.Toast.showToast === 'function') {
        window.Toast.showToast({
          title: 'EmailJS Missing',
          message: 'Email service not loaded. Order placed but no confirmation email.',
          type: 'warning',
          duration: 8000
        });
      }
    }

  } catch (e) {
    console.error("💥 UNEXPECTED ERROR IN EMAIL PROCESS:", e);
  }

  // 🧾 Build a compact order summary for the thankyou page
  const serverOrder = data.order || data.savedOrder || null;
  const frontOrderId = localStorage.getItem("orderId");
  const orderId = frontOrderId || (serverOrder && (serverOrder.orderCode || serverOrder.orderNumber || serverOrder.shortId || serverOrder._id)) || data.orderId || "ORD-0000";
  const placedAt = (serverOrder && serverOrder.createdAt) || new Date().toISOString();

  // 🆕 Use structured shipping from server if available
  const shipFromServer = serverOrder && serverOrder.shippingAddress ? serverOrder.shippingAddress : null;
  const shippingSummary = {
    line1: (shipFromServer && (shipFromServer.addressLine1 || shipFromServer.line1)) || bodyFields.address || "",
    barangay: (shipFromServer && shipFromServer.barangay) || (userData && userData.barangay) || "",
    city: (shipFromServer && shipFromServer.city) || (userData && userData.city) || "",
    province: (shipFromServer && shipFromServer.province) || (userData && userData.province) || "",
    postal: (shipFromServer && (shipFromServer.postalCode || shipFromServer.postal)) || (userData && userData.postalCode) || "",
    region: (shipFromServer && shipFromServer.region) || (userData && userData.region) || "Philippines",
  };

  const summary = {
    orderId,
    placedAt,
    customer: { name: bodyFields.name, email: bodyFields.email, phone: bodyFields.phone },
    shipping: shippingSummary,
    paymentMethod: bodyFields.paymentMethod,
    fulfillment: bodyFields.fulfillment,
    totals: latestTotals || { subtotal: 0, vat: 0, shipping, total: 0 },
    items: serverOrder && Array.isArray(serverOrder.items) ? serverOrder.items : cart,
  };

  try {
    sessionStorage.setItem("lastOrderSummary", JSON.stringify(summary));
  } catch (err) {
    console.warn("⚠️ Unable to store lastOrderSummary:", err);
  }

  // ✅ CLEAR ONLY THE CHECKED-OUT ITEMS FROM CART
  try {
    const fullCart = loadCartLS();
    let remaining = fullCart;

    if (Array.isArray(checkoutSelection) && checkoutSelection.length > 0) {
      const selectedKeys = new Set(checkoutSelection.map(it => `${it._id || it.productId || it.id}::${it.variant?.options?.Size || ""}`));
      remaining = fullCart.filter(it => {
        const key = `${it._id || it.productId || it.id}::${it.variant?.options?.Size || ""}`;
        return !selectedKeys.has(key);
      });
    } else {
      remaining = [];
    }

    saveCartLS(remaining);
    localStorage.removeItem("cart_guest");

    await fetch(`${API_BASE}/api/cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: (remaining || []).map(it => ({ productId: it._id || it.productId, quantity: it.quantity, title: it.title, price: it.price, image: it.image })) }),
    });

    sessionStorage.removeItem("checkoutItems");
    window.dispatchEvent(new CustomEvent("cart:refresh"));
    
    window.location.href = "thankyou.html";
  } catch (err) {
    console.warn("⚠️ Failed to clear cart after order:", err);
    window.location.href = "thankyou.html";
  }
}


      // Not OK
    } catch (err) {
      console.error("❌ Checkout Error:", err);
      alert("⚠️ Could not connect to backend. Please make sure your server is running (http://localhost:3000).");
    }
  });
}

});


// Helper function to build items HTML for email template
function buildItemsHTML(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return '';
  
  return cart.map(item => {
    const title = item.title || 'Item';
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const lineTotal = price * qty;

    // Make image URL absolute for email
    const imgUrl = item.image?.startsWith('http') 
      ? item.image 
      : item.image 
        ? `https://chase-aquatics.onrender.com${item.image.startsWith('/') ? '' : '/'}${item.image}`
        : 'https://via.placeholder.com/40x40?text=📦';

    return `
      <tr>
        <td style="padding:8px 12px;border-top:1px solid #e5e7eb;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td width="44" valign="top" style="padding-right:8px;">
                <img
                  src="${imgUrl}"
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
          ₱${price.toFixed(2)}
        </td>
        <td align="right" style="padding:8px 12px;border-top:1px solid #e5e7eb;">
          ₱${lineTotal.toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');
}




(function () {
  const payCOD   = document.getElementById('payCOD');
  const payGCash = document.getElementById('payGCash');
  const payBank  = document.getElementById('payBank');

  const codFields      = document.getElementById('codFields');
  const transferFields = document.getElementById('transferFields');

  const codLandmark = document.getElementById('codLandmark');
  const payAmount   = document.getElementById('payAmount');
  const payReceipt  = document.getElementById('payReceipt');

  const fulfillDelivery     = document.getElementById('fulfillDelivery');
  const fulfillPickup       = document.getElementById('fulfillPickup');
  const deliveryAddressWrap = document.getElementById('deliveryAddressWrap');
  const deliveryAddress     = document.getElementById('deliveryAddress');

  // QR block (works for single <img> OR two <img>s)
  const paymentQRWrap   = document.getElementById('paymentQRWrap');
  const paymentQRImg    = document.getElementById('paymentQRImg');        // single-img mode
  const paymentQRImgGC  = document.getElementById('paymentQRImgGCash');   // two-img mode
  const paymentQRImgBK  = document.getElementById('paymentQRImgBank');    // two-img mode
  const paymentQRLabel  = document.getElementById('paymentQRLabel');

  // Single-image sources (used only if #paymentQRImg exists)
  const GCASH_QR_SRC = '../images/gcash-sampleqr.jpg';
  const BANK_QR_SRC  = '../images/bank-sampleqr.jpg';

  // Details to render under the QR
  const GCASH_DETAILS = { title: 'GCash', number: '09150463860', name: 'Mark Milca' };
  const BANK_DETAILS  = { title: 'Bank',  account: '12313123123', name: 'Mark Milca' };

  function setRequired(el, isReq) {
    if (!el) return;
    if (isReq) el.setAttribute('required', 'required');
    else el.removeAttribute('required');
  }

  function show(el) { if (el) el.classList.remove('hide'); }
  function hide(el) { if (el) el.classList.add('hide'); }

  function renderDetails(kind) {
    if (!paymentQRLabel) return;
    if (kind === 'gcash') {
      paymentQRLabel.innerHTML =
        `<div class="qr-title" style="font-weight:700;margin-bottom:4px">GCash</div>
         <div>Number: <strong>${GCASH_DETAILS.number}</strong></div>
         <div>Name: <strong>${GCASH_DETAILS.name}</strong></div>`;
    } else if (kind === 'bank') {
      paymentQRLabel.innerHTML =
        `<div class="qr-title" style="font-weight:700;margin-bottom:4px">Bank</div>
         <div>Bank number: <strong>${BANK_DETAILS.account}</strong></div>
         <div>Name: <strong>${BANK_DETAILS.name}</strong></div>`;
    } else {
      paymentQRLabel.innerHTML = '';
    }
  }

  // Show/hide QR image(s) and details without changing your layout
  function showQR(which) {
    if (!paymentQRWrap) return;

    const twoImgMode = !!(paymentQRImgGC || paymentQRImgBK);

    // Reset visuals
    if (paymentQRImgGC) paymentQRImgGC.style.display = 'none';
    if (paymentQRImgBK) paymentQRImgBK.style.display = 'none';
    if (paymentQRImg)   paymentQRImg.removeAttribute('src');
    renderDetails(null);
    hide(paymentQRWrap);

    if (which === 'gcash') {
      if (twoImgMode && paymentQRImgGC) {
        paymentQRImgGC.style.display = 'block';
      } else if (paymentQRImg) {
        paymentQRImg.src = GCASH_QR_SRC;
      }
      renderDetails('gcash');
      show(paymentQRWrap);
      return;
    }

    if (which === 'bank') {
      if (twoImgMode && paymentQRImgBK) {
        paymentQRImgBK.style.display = 'block';
      } else if (paymentQRImg) {
        paymentQRImg.src = BANK_QR_SRC;
      }
      renderDetails('bank');
      show(paymentQRWrap);
      return;
    }

    // otherwise keep hidden (COD / none)
  }

  function updatePaymentExtras() {
    if (payCOD && payCOD.checked) {
      show(codFields);
      hide(transferFields);

      setRequired(codLandmark, true);
      setRequired(payAmount, false);
      setRequired(payReceipt, false);

      if (payAmount)  payAmount.value = '';
      if (payReceipt) payReceipt.value = '';

      showQR(null); // hide QR on COD
      return;
    }

    if ((payGCash && payGCash.checked) || (payBank && payBank.checked)) {
      hide(codFields);
      show(transferFields);

      setRequired(codLandmark, false);
      setRequired(payAmount, true);
      setRequired(payReceipt, true);

      if (codLandmark) codLandmark.value = '';

      if (payGCash && payGCash.checked) showQR('gcash');
      else if (payBank && payBank.checked) showQR('bank');
      return;
    }

    // None selected yet
    hide(codFields);
    hide(transferFields);
    setRequired(codLandmark, false);
    setRequired(payAmount, false);
    setRequired(payReceipt, false);
    showQR(null);
  }

  function updateFulfillmentExtras() {
    if (fulfillDelivery && fulfillDelivery.checked) {
      show(deliveryAddressWrap);
      setRequired(deliveryAddress, true);
    } else {
      hide(deliveryAddressWrap);
      setRequired(deliveryAddress, false);
      if (deliveryAddress) deliveryAddress.value = '';
    }
  }

  [payCOD, payGCash, payBank].forEach(r => r && r.addEventListener('change', updatePaymentExtras));
  [fulfillDelivery, fulfillPickup].forEach(r => r && r.addEventListener('change', updateFulfillmentExtras));

  // Init
  updatePaymentExtras();
  updateFulfillmentExtras();
})();

  

// ======================================================
// 🌍 Estimated shipping map (Leaflet) – estimate ONLY
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('shipping-map');
  if (!mapContainer) return; // safety

  const subtotalDisplayEl = document.getElementById('checkout-subtotal');
  const estShippingEl     = document.getElementById('shipping-estimate-amount');
  const estTotalEl        = document.getElementById('shipping-estimate-total');
  const distanceText      = document.getElementById('shipping-distance-text');

  if (!subtotalDisplayEl || !estShippingEl || !estTotalEl) return;

  // 👉 Actual coordinates of your shop (Chase Aquatics)
  const SHOP_COORDS = {
    lat: 14.3139,
    lng: 121.0576
  };

  // 🔲 NCR bounds (approx) – estimate only works inside this box
  const NCR_BOUNDS = L.latLngBounds(
    [14.27, 120.90], // southwest corner
    [14.85, 121.15]  // northeast corner
  );

  // 🗺️ Initialize map (locked within NCR)
  const map = L.map('shipping-map', {
    maxBounds: NCR_BOUNDS,
    maxBoundsViscosity: 1.0, // "rubber band" lock
    minZoom: 10,
    maxZoom: 18
  }).setView([SHOP_COORDS.lat, SHOP_COORDS.lng], 13);

  // Tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Marker for shop
  L.marker([SHOP_COORDS.lat, SHOP_COORDS.lng])
    .addTo(map)
    .bindPopup('Chase Aquatics (Shop)')
    .openPopup();

  // Marker for customer (movable)
  let customerMarker = null;

  // Haversine distance (km)
  function distanceKm(a, b) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; // Earth radius km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }

  function parseAmount(text) {
    return Number(text.replace(/[₱,]/g, '').trim()) || 0;
  }

  function formatAmount(num) {
    return '₱' + num.toFixed(2);
  }

  // 💸 Rule: base 80 + 10 per km, min 100 (example lang, adjust mo)
  function computeShipping(distanceKmValue) {
    const base = 80;
    const perKm = 10;
    const est = base + distanceKmValue * perKm;
    return Math.max(100, Math.round(est));
  }

  // 👉 Only updates the ESTIMATE labels, not the real checkout total
  function updateEstimateTotals(newShipping) {
    const subtotal = parseAmount(subtotalDisplayEl.textContent);
    const estTotal = subtotal + newShipping;
    estShippingEl.textContent = formatAmount(newShipping);
    estTotalEl.textContent = formatAmount(estTotal);
  }

  // 📍 When user clicks map → drop/move pin + recompute
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const clickedLatLng = L.latLng(lat, lng);

    // 🚫 Outside NCR → no estimate, just warning
    if (!NCR_BOUNDS.contains(clickedLatLng)) {
      if (window.Toast?.showToast) {
        window.Toast.showToast({
          title: 'Outside NCR',
          message: 'Estimated shipping is only available within NCR. For other areas, final shipping fee will be coordinated via courier.',
          type: 'warning',
          position: 'top'
        });
      } else {
        alert('Estimated shipping is only available within NCR.');
      }

      if (distanceText) {
        distanceText.textContent =
          'Outside NCR – we’ll contact you via email with the exact shipping fee after checking couriers in your area.';
      }

      return; // ❌ wag mag-compute ng estimate
    }

    // ✅ Inside NCR – allow marker + estimate
    if (!customerMarker) {
      customerMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
      customerMarker.bindPopup('Your location (drag to adjust)').openPopup();

      customerMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        handleLocationChange(pos.lat, pos.lng);
      });
    } else {
      customerMarker.setLatLng([lat, lng]);
    }

    handleLocationChange(lat, lng);
  });

  function handleLocationChange(lat, lng) {
    const point = L.latLng(lat, lng);

    // 🛡 Double-check inside NCR (safety)
    if (!NCR_BOUNDS.contains(point)) {
      if (distanceText) {
        distanceText.textContent =
          'Outside NCR – shipping fee will be confirmed by the courier.';
      }
      return;
    }

    const dist = distanceKm(SHOP_COORDS, { lat, lng }); // km
    const shippingEstimate = computeShipping(dist);
    updateEstimateTotals(shippingEstimate);

    if (distanceText) {
      distanceText.textContent =
        `${dist.toFixed(1)} km from shop (within NCR). This amount is an estimate only; final shipping will be emailed to you.`;
    }
  }
});
