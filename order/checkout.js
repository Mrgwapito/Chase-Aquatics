document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Checkout Page Loaded");

  // ----------------------------------------------------
  // Env + helpers (aligned with cart.js / order_summary.js)
  // ----------------------------------------------------
  const API_BASE = window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "http://localhost:3000";

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

  const shipping = 100;       // flat shipping for now
  const VAT_RATE = 0.12;      // 12% VAT
  let latestTotals = null;    // used later for thankyou page


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
  if (!token) {
    alert("⚠️ Please log in first before checking out.");
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
  // STEP 3: load cart (server for logged-in, LS fallback)
  // ----------------------------------------------------
  let cart = [];
  if (token) {
    const serverItems = await fetchServerCart();
    cart = normalizeServerItems(serverItems || []);
    saveCartLS(cart); // keep LS in sync for UI
  } else {
    cart = loadCartLS();
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

  // 💰 Prices in your DB already INCLUDE 12% VAT.
  // So we back-calculate the net amount and VAT portion.
  const grossSubtotal = subtotal;                     // with VAT
  const netSubtotal   = grossSubtotal / (1 + VAT_RATE);
  const vat           = grossSubtotal - netSubtotal;

  // remember totals so we can show on thankyou page
  latestTotals = {
    subtotal: netSubtotal,
    vat,
    shipping,
    total: netSubtotal + vat + shipping,
  };

  if (subtotalEl) subtotalEl.textContent = `₱${netSubtotal.toFixed(2)}`;
  if (vatEl)      vatEl.textContent      = `₱${vat.toFixed(2)}`;
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

    const bodyFields = {
      userId:  userData.id,
      name:    nameInput.value.trim(),
      email:   emailInput.value.trim(),
      phone:   phoneInput.value.trim(),
      address: addressInput.value.trim(),
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
      if (data && data.success) {
        // 🔔 Try to send the order confirmation email from the BROWSER via EmailJS
        try {
          if (window.emailjs && data.emailTemplate) {
            // Init with the PUBLIC key that belongs to service_1c8lq6n / template_3v3z8n7
            emailjs.init("HCwUJE1S2hr3TtLfB");

            emailjs
              .send("service_1c8lq6n", "template_3v3z8n7", data.emailTemplate)
              .then(() => {
                console.log("📨 Order confirmation email sent (browser)");
              })
              .catch((err) => {
                console.warn("⚠️ EmailJS browser send failed:", err);
              });
          } else {
            console.log(
              "ℹ️ EmailJS not loaded on this page or emailTemplate missing from response."
            );
          }
        } catch (e) {
          console.warn("⚠️ Error triggering EmailJS in browser:", e);
        }

        // 🧾 Build a compact order summary for the thankyou page
        const serverOrder = data.order || data.savedOrder || null;

        // 🔗 Prefer the CAQ-… order id generated in order_summary.js
        const frontOrderId = localStorage.getItem("orderId");

        const orderId =
          frontOrderId ||
          (serverOrder && (serverOrder.orderCode || serverOrder.orderNumber || serverOrder.shortId || serverOrder._id)) ||
          data.orderId ||
          "ORD-0000";

        const placedAt =
          (serverOrder && serverOrder.createdAt) || new Date().toISOString();

        const summary = {
          orderId,
          placedAt,
          customer: {
            name:  bodyFields.name,
            email: bodyFields.email,
            phone: bodyFields.phone,
          },
          shipping: {
            // right now we just store the full address line;
            // if later you have separate barangay/city fields, you can add them here
            line1: bodyFields.address || "",
            barangay: "",
            city: "",
            province: "",
            postal: "",
            region: "",
          },
          paymentMethod: bodyFields.paymentMethod,
          fulfillment:   bodyFields.fulfillment,
          totals: latestTotals || {
            subtotal: 0,
            vat: 0,
            shipping,
            total: 0,
          },
          // prefer items from serverOrder if it has them, otherwise use the cart we just sent
          items: (serverOrder && Array.isArray(serverOrder.items))
            ? serverOrder.items
            : cart,
        };

        try {
          sessionStorage.setItem("lastOrderSummary", JSON.stringify(summary));
        } catch (err) {
          console.warn("⚠️ Unable to store lastOrderSummary:", err);
        }

        // 🔄 Clear both local + server carts
        saveCartLS([]);
        pushServerCartDebounced([]);

        // 🔔 Tell cart.js (if loaded) to refresh popup + badge
        window.dispatchEvent(new CustomEvent("cart:refresh"));

        // ✅ Redirect to receipt page which will read lastOrderSummary
        window.location.href = "thankyou.html";
        return;
      }



      // Not OK
      const msg = (data && data.message) ? data.message : `HTTP ${res.status}`;
      console.error("❌ Failed to place order:", data);
      alert(`❌ Failed to place order: ${msg}`);
    } catch (err) {
      console.error("❌ Checkout Error:", err);
      alert("⚠️ Could not connect to backend. Please make sure your server is running (http://localhost:3000).");
    }
  });
}

});







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

  