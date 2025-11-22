// product_shop.js (patched to use namespaced cart key + server sync)

// 🔧 FIX: make API base globally accessible to helpers below
window.__API_BASE__ =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:3000"
    : "https://chase-aquatics.onrender.com";

// 🔧 FIX: tiny helper to normalize image paths (uploads -> absolute)
function fixImg(src) {
  if (!src) return 'images/placeholder.jpg';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  // serve /uploads/... from backend
  return `${window.__API_BASE__}${src.startsWith('/') ? '' : '/'}${src}`;
}

document.addEventListener("DOMContentLoaded", async function () {
  console.log("🟢 product_shop.js loaded");

  await new Promise((resolve) => setTimeout(resolve, 100));

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");
  const cartPopup = document.querySelector(".cart-popup");
  const cartButton = document.getElementById("cart-btn");
  const cartBadge = document.querySelector(".cart-badge");
  const cartItemsContainer = cartPopup?.querySelector(".cart-items"); // ✅ NEW

  // ===== Consistent cart key helpers (same as cart.js) =====
  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('user')) ||
             JSON.parse(sessionStorage.getItem('user')) || null;
    } catch { return null; }
  }
  function getCartKey() {
    const u = currentUser();
    return u?.id ? `cart_${u.id}` : 'cart_guest';
  }
  function loadCartLS() {
    return JSON.parse(localStorage.getItem(getCartKey())) || [];
  }
  function saveCartLS(c) {
    localStorage.setItem(getCartKey(), JSON.stringify(c));
  }

  // ✅ NEW: quick local re-render of the popup (so no reload is needed)
  function renderPopupFromLocal() {
    if (!cartItemsContainer) return;
    const cart = loadCartLS();

    if (!cart.length) {
      cartItemsContainer.innerHTML = '<p class="text-center text-muted">Your cart is empty.</p>';
      return;
    }

    cartItemsContainer.innerHTML = "";
cart.forEach((item, index) => {
  const safeTitle = item.title || "Untitled Product";
  const safeImage = fixImg(item.image || "images/placeholder.jpg");
  const safePrice = Number(item.price) > 0 ? Number(item.price) : 0;
  const safeQty = Number(item.quantity) > 0 ? item.quantity : 1;

  const div = document.createElement("div");
  div.className = "cart-item";
  div.innerHTML = `
        <input
          type="checkbox"
          class="item-select"
          data-index="${index}"
          checked
        >
        <img src="${safeImage}" alt="${safeTitle}">
        <div class="item-info">
          <h4>${safeTitle}</h4>
          <p>₱${safePrice.toFixed(2)}</p>
        </div>
        <div class="item-controls">
          <button class="qty-btn" data-index="${index}" data-action="decrease">-</button>
          <span class="qty">${safeQty}</span>
          <button class="qty-btn" data-index="${index}" data-action="increase">+</button>
          <button class="remove-btn" data-index="${index}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
  cartItemsContainer.appendChild(div);
});


    attachCartItemEvents(); // 👈 bind +/–/remove after rendering
  }

  function attachCartItemEvents() {
    // + / - quantity
    cartItemsContainer.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.getAttribute('data-index'));
        const action = btn.getAttribute('data-action');
        const cart = loadCartLS();
        if (!cart[index]) return;

        if (action === 'increase') {
          cart[index].quantity = Math.min(99, (Number(cart[index].quantity) || 1) + 1);
        } else if (action === 'decrease') {
          cart[index].quantity = Math.max(1, (Number(cart[index].quantity) || 1) - 1);
        }

        saveCartLS(cart);
        pushServerCartDebounced(cart);
        renderPopupFromLocal();
        updateCartBadge();
      });
    });

    // remove item
    cartItemsContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.getAttribute('data-index'));
        const cart = loadCartLS();
        if (!cart[index]) return;

        const removed = cart.splice(index, 1);
        saveCartLS(cart);
        pushServerCartDebounced(cart);
        renderPopupFromLocal();
        updateCartBadge();

        // toast
        window.Toast?.showToast({
          title: 'Removed',
          message: `${removed[0]?.title || 'Item'} removed from cart.`,
          type: 'info'
        });
      });
    });
  }

  function openCartPopupLocal() {
    if (!cartPopup) return;
    cartPopup.style.display = "block";
    setTimeout(() => (cartPopup.style.opacity = "1"), 10);
    clearTimeout(window.cartAutoHideTimer);
    window.cartAutoHideTimer = setTimeout(() => {
      if (cartPopup.matches(':hover')) return;
      cartPopup.style.opacity = '0';
      setTimeout(() => (cartPopup.style.display = 'none'), 300);
    }, 3000);
  }
  // ========================================================

  // (optional) server sync like cart.js
  const API_BASE = window.__API_BASE__; // 🔧 FIX: use global base
  function authToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  }
  let _pushTimer = null;
  function pushServerCartDebounced(items) {
    const token = authToken();
    if (!token) return; // only if logged in
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/cart`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            items: items.map(it => ({
              productId: it._id || it.productId,
              quantity: it.quantity,
              title: it.title,
              price: it.price,
              image: it.image
            }))
          })
        });
      } catch {}
    }, 300);
  }

  // 🔐 Before ordering, require the user to be logged in AND have a Valid ID
  async function ensureValidIdBeforeOrder() {
    const token = authToken();

// 1) Not logged in → show error at top + open login popup
if (!token) {
  window.Toast?.showToast?.({
    title: 'Sign in required',
    message: 'Please sign in or sign up first before ordering items.',
    type: 'error',
    position: 'top'
  });

  // 🔓 Try normal triggers first
  const loginIcon   = document.getElementById('loginTrigger'); // <i ...>
  const loginButton = document.querySelector('.user');         // <button class="user">

  if (loginIcon) {
    // Fire a real click on the icon
    loginIcon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  } else if (loginButton) {
    // Or on the button that usually opens the popup
    loginButton.click();
  }

  // 🔁 Hard fallback: directly force the popup open
  if (typeof window.forceOpenLoginPopup === 'function') {
    window.forceOpenLoginPopup();
  }

  return { ok: false, reason: 'noToken' };
}


    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to read profile.');
      }

      const rawStatus = data.user?.validId?.status || 'none';
      const status = rawStatus.toLowerCase();

      // 2) Check ID status AFTER the user is signed in
      if (status !== 'approved') {
        let title = 'Valid ID required';
        let message = 'We could not verify your Valid ID. Please check your profile.';

        if (status === 'none') {
          // ❌ No ID yet
          message = 'Please submit your Valid ID in your profile before ordering items.';
        } else if (status === 'pending') {
          // ⏳ Under review
          title   = 'ID under review';
          message = 'Your Valid ID is currently under review. You can place orders once it is approved.';
        } else if (status === 'rejected' || status === 'declined') {
          // ❌ Declined
          message = 'Your Valid ID was declined. Please upload a new Valid ID before placing an order.';
        }

        window.Toast?.showToast?.({
          title,
          message,
          type: 'error',
          position: 'top'
        });

        // Redirect to profile so they can upload / check ID
        setTimeout(() => {
          window.location.href = '/profile/profile.html';
        }, 800);

        return { ok: false, reason: status };
      }

      // 👍 Approved → allowed to order
      return { ok: true, status: 'approved' };
    } catch (err) {
      console.error('Valid ID check failed:', err);
      window.Toast?.showToast?.({
        title: 'Could not verify ID',
        message: 'Please try again in a moment.',
        type: 'error',
        position: 'top'
      });
      return { ok: false, reason: 'error', error: err };
    }
  }


  console.log("🌐 Current URL:", window.location.href);
  console.log("🆔 Product ID from URL:", productId);

  if (!productId || productId === "undefined" || productId === "null") {
    alert("⚠️ Product ID missing or invalid.");
    return;
  }

  // 🔁 Fetch product with fallback retry if needed
  let product = await fetchProductWithRetry(productId, 2);
  if (!product) {
    alert("❌ Failed to load product data. Please try again.");
    return;
  }

  console.log("✅ Product data fetched:", product);

  // 🖼️ Normalize image path (fixes broken image issue)
  const normalizedImage = fixImg(product.image); // 🔧 FIX: use helper

  // ==========================================================
  // ✅ Populate product details (Variant-Aware)
  // ==========================================================
  document.getElementById("product-name").textContent =
    product.title || "Untitled Product";

  document.getElementById("product-category").innerHTML =
    `<strong>Category:</strong> ${product.category || "Uncategorized"}`;

  // DOM refs
  const priceEl = document.getElementById("product-price");
  const skuEl   = document.getElementById("product-sku");
  const stockEl = document.getElementById("product-stock");
  const variantBox = document.getElementById("variant-options");

  // ==========================================================
  // 📌 If the product has variants → build dropdown selector
  // ==========================================================
  if (Array.isArray(product.variants) && product.variants.length > 0) {

    // Create dropdown UI
    let html = `
      <label class="fw-semibold mb-1">Available Sizes</label>
      <select id="variant-select" class="form-select" style="max-width:250px;">
        ${product.variants.map((v, i) =>
          `<option value="${i}">
             ${v.options?.Size || v.sku} — ₱${v.price}
           </option>`
        ).join("")}
      </select>
    `;
    variantBox.innerHTML = html;

    // Default variant = first one
    let selectedVariant = product.variants[0];

    // Display initial values
    priceEl.innerHTML = `<strong>Price:</strong> ₱${selectedVariant.price}`;
    skuEl.textContent  = `SKU: ${selectedVariant.sku}`;
    stockEl.textContent = `Stock: ${selectedVariant.stock}`;

    // Change when user selects another variant
    document.getElementById("variant-select").addEventListener("change", (e) => {
      const v = product.variants[Number(e.target.value)];
      selectedVariant = v;

      priceEl.innerHTML = `<strong>Price:</strong> ₱${v.price}`;
      skuEl.textContent = `SKU: ${v.sku}`;
      stockEl.textContent = `Stock: ${v.stock}`;

      // Update main image if variant has its own
      if (v.image) {
        document.getElementById("product-image").src = fixImg(v.image);
      }
    });

    // Store selected variant for Add-to-Cart
    product.__selectedVariant = () => selectedVariant;

  } else {

    // ========================================================
    // 📌 If NO variants → fallback to base price and stock
    // ========================================================
    priceEl.innerHTML =
      `<strong>Price:</strong> ₱${product.price}${product.price_unit ? "/" + product.price_unit : ""}`;

    skuEl.textContent = `SKU: —`;
    stockEl.textContent = `Stock: ${product.stock ?? 0}`;

    variantBox.innerHTML = ""; // no variant UI
  }

  // Description
  document.getElementById("product-description").textContent =
    product.description || "No description available.";

  const mainImage = document.getElementById("product-image");
  mainImage.src = normalizedImage;
  mainImage.onerror = () => (mainImage.src = "images/placeholder.jpg");

  // ✅ Additional images preview
  const additionalImagesContainer = document.getElementById("product-additional-images");
  if (additionalImagesContainer && Array.isArray(product.additionalImages)) {
    additionalImagesContainer.innerHTML = "";
    product.additionalImages.forEach((imgSrc) => {
      const resolvedImg = fixImg(imgSrc); // 🔧 FIX
      const img = document.createElement("img");
      img.src = resolvedImg;
      img.alt = `${product.title} - additional image`;
      img.classList.add("img-thumbnail");
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.marginRight = "10px";
      img.addEventListener("click", () => {
        mainImage.src = resolvedImg;
      });
      additionalImagesContainer.appendChild(img);
    });
  }

  // ✅ Buttons
  const addToCartBtn = document.getElementById("add-to-cart-btn");
  const buyNowBtn    = document.getElementById("buy-now-btn");

  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
      const qtyInput = document.getElementById("quantity");
      const quantity = parseInt(qtyInput?.value || "1", 10);
      if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
      }
      addToCart(product, quantity); // normal add to cart (with success toast + popup)
    });
  }

   // 🆕 BUY NOW → require login + Valid ID, then create a SINGLE checkout item (hindi dumadaan sa cart)
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", async () => {
      const qtyInput = document.getElementById("quantity");
      const quantity = parseInt(qtyInput?.value || "1", 10);
      if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
      }

      // ✅ First gate: login + Valid ID
      const gate = await ensureValidIdBeforeOrder();
      if (!gate.ok) {
        // A toast was already shown (and maybe redirect to profile/login/profile),
        // so just stop here. User can STILL use normal "Add to Cart" button.
        return;
      }

      // 🧩 Get currently selected variant (if any)
      const chosenVariant = product.__selectedVariant ? product.__selectedVariant() : null;

      // 🔢 Check stock (same logic as addToCart)
      let availableStock = chosenVariant
        ? Number(chosenVariant.stock)
        : Number(product.stock ?? 0);

      if (!Number.isFinite(availableStock) || availableStock <= 0) {
        window.Toast?.showToast?.({
          title: "Unavailable",
          message: "This product is not available right now.",
          type: "warning"
        });
        return;
      }

      if (quantity > availableStock) {
        window.Toast?.showToast?.({
          title: "Stock limit reached",
          message: `This product only has ${availableStock} remaining in stock.`,
          type: "warning"
        });
        return;
      }

      // 🖼 Normalize main image / variant image
      const baseImage = fixImg(product.image);
      const finalImage = chosenVariant?.image ? fixImg(chosenVariant.image) : baseImage;

      // 🧺 Build a SINGLE checkout item (same shape as cart item)
      const buyNowItem = {
        _id: String(product._id),
        title: chosenVariant
          ? `${product.title} (${chosenVariant.options?.Size})`
          : product.title,
        price: chosenVariant ? chosenVariant.price : product.price,
        image: finalImage,
        quantity: quantity,
        variant: chosenVariant
          ? {
              sku: chosenVariant.sku,
              options: chosenVariant.options,
              stock: chosenVariant.stock
            }
          : null
      };

      try {
        // 💾 Store ONLY this item for this checkout flow
        sessionStorage.setItem("checkoutItems", JSON.stringify([buyNowItem]));
      } catch (err) {
        console.warn("⚠️ Failed to store checkoutItems for Buy Now:", err);
      }

      // Optional soft toast
      window.Toast?.showToast?.({
        title: "Proceeding to checkout",
        message: "Review your order before placing it.",
        type: "info",
        position: "top"
      });

      // 👉 Go to Order Summary page
      window.location.href = "/order/order_summary.html";
    });
  }


  // ======================================================
  // 🛒 ADD TO CART FUNCTION (with popup + badge animation)
  // ======================================================
  function addToCart(product, quantity, opts = {}) {
    const { skipSuccessToast = false } = opts;

    // 🔁 use namespaced key
    let cart = loadCartLS();
    // ✅ Normalize image before storing to cart
    const normalizedImage = fixImg(product.image); // 🔧 FIX

    let chosenVariant = product.__selectedVariant ? product.__selectedVariant() : null;

    // Determine available stock
    let availableStock = chosenVariant
      ? Number(chosenVariant.stock)
      : Number(product.stock ?? 0);

    // ⛔ No stock at all
    if (!Number.isFinite(availableStock) || availableStock <= 0) {
      window.Toast?.showToast({
        title: "Unavailable",
        message: "This product is not available right now.",
        type: "warning"
      });
      return { success: false, reason: "noStock" };
    }

    // Find existing item in cart (variant-aware)
    const existing = cart.find((item) => {
      if (chosenVariant) {
        return String(item._id) === String(product._id) &&
               item.variant?.sku === chosenVariant.sku;
      }
      return String(item._id) === String(product._id);
    });

    let newQty = quantity;

    if (existing) {
      // If exists, check if adding quantity exceeds stock
      const currentQty = Number(existing.quantity) || 0;
      newQty = currentQty + quantity;

      if (newQty > availableStock) {
        const remaining = Math.max(0, availableStock - currentQty);
        const msg = remaining > 0
          ? `You can only add ${remaining} more of ${product.title || 'this product'}.`
          : `You already reached the maximum stock (${availableStock}) for this product.`;

        window.Toast?.showToast({
          title: "Stock limit reached",
          message: msg,
          type: "warning"
        });
        return { success: false, reason: "stockLimit" };
      }

      existing.quantity = newQty;

    } else {
      // New item but requested quantity is more than stock
      if (quantity > availableStock) {
        const msg = `This product only has ${availableStock} remaining in stock.`;

        window.Toast?.showToast({
          title: "Stock limit reached",
          message: msg,
          type: "warning"
        });
        return { success: false, reason: "tooManyRequested" };
      }

      cart.push({
        _id: String(product._id),
        title: chosenVariant
          ? `${product.title} (${chosenVariant.options?.Size})`
          : product.title,
        price: chosenVariant ? chosenVariant.price : product.price,
        image: chosenVariant?.image ? fixImg(chosenVariant.image) : normalizedImage,
        quantity: quantity,
        variant: chosenVariant
          ? {
              sku: chosenVariant.sku,
              options: chosenVariant.options,
              stock: chosenVariant.stock
            }
          : null
      });
    }

    // ✅ Save + UI updates
    saveCartLS(cart);                 // 🔒 write to the same key as cart.js
    renderPopupFromLocal();           // ✅ NEW: refresh popup instantly
    pushServerCartDebounced(cart);    // 🔄 sync when logged in
    console.log("🛒 Cart updated:", cart);

    updateCartBadge();

    // Animate icon
    const icon = cartButton?.querySelector("i");
    if (icon) {
      icon.classList.add("cart-animate");
      setTimeout(() => icon.classList.remove("cart-animate"), 300);
    }

    openCartPopupLocal();

    // use the shared toast (works because /assets/toast.js sets window.Toast)
    if (!skipSuccessToast) {
      window.Toast?.showToast({
        title: 'Added to cart',
        message: `${product.title} added to cart!`,
        type: 'success'
      });
    }

    return { success: true, cart };
  }

  // ======================================================
  // 🔢 UPDATE CART BADGE COUNT (uses namespaced key)
  // ======================================================
  function updateCartBadge() {
    const cart = loadCartLS();
    const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    if (cartBadge) {
      if (count > 0) {
        cartBadge.textContent = count;
        cartBadge.style.display = "flex";
      } else {
        cartBadge.style.display = "none";
      }
    }
  }

  // ======================================================
  // 🧩 SHOW CART POPUP BRIEFLY (auto-hide after 3s)
  // ======================================================
  function showCartPopup() {
    if (!cartPopup) return;
    cartPopup.style.display = "block";
    cartPopup.style.opacity = "1";
    setTimeout(() => {
      cartPopup.style.opacity = "0";
      setTimeout(() => (cartPopup.style.display = "none"), 400);
    }, 3000);
  }

  // Initialize badge count (from namespaced key)
  renderPopupFromLocal(); // ✅ keep popup in sync if it opens immediately
  updateCartBadge();

  // 🔗 Load related products (same category, exclude current product)
  if (product.category && product._id) {
    displayRelatedProducts(product.category, product._id);
  } else {
    console.warn("⚠️ Cannot load related products: missing category or _id on product.", product);
  }
});


/* ======================================================
   🧠 Helper: Fetch product with retry for slow responses
   – also normalizes variants from string → array
====================================================== */
async function fetchProductWithRetry(productId, retries = 1) {
  const API_BASE = window.__API_BASE__;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt} for product ID: ${productId}`);
      const res = await fetch(`${API_BASE}/api/product/${productId}`);
      if (!res.ok) {
        console.warn("❌ Product fetch HTTP", res.status);
        continue;
      }

      const data = await res.json();
      let prod = data;

      // support both: { _id, ... } and { success, product: { ... } }
      if (data && data.product && data.product._id) {
        prod = data.product;
      }

      // 🔁 Normalize variants: if string, try to JSON.parse
      if (prod && typeof prod.variants === "string") {
        try {
          const parsed = JSON.parse(prod.variants);
          if (Array.isArray(parsed)) {
            prod.variants = parsed;
          }
        } catch (e) {
          console.warn("⚠️ Failed to parse variants JSON:", e, prod.variants);
        }
      }

      if (prod && prod._id) return prod;
    } catch (err) {
      console.warn(`⚠️ Fetch attempt ${attempt} failed:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

/* ======================================================
   🧩 Related products section
====================================================== */
async function displayRelatedProducts(category, excludeId) {
  const container = document.getElementById("related-products-container");
  if (!container) {
    console.warn("⚠️ No #related-products-container found in DOM.");
    return;
  }

  try {
    const API_BASE = window.__API_BASE__; // 🔧 FIX
    // 🔧 FIX: ask server for all items and parse payload shape
    const res = await fetch(`${API_BASE}/api/products?limit=0`);
    if (!res.ok) throw new Error(`Failed to fetch related products (${res.status})`);

    const payload = await res.json();
    const products = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.products)
        ? payload.products
        : [];

    // 🧠 Case-insensitive match on category + exclude current product
    const related = products.filter((p) => {
      if (!p.category || !category) return false;
      return (
        p.category.toString().toLowerCase() === category.toString().toLowerCase() &&
        String(p._id) !== String(excludeId)
      );
    });

    if (!related.length) {
      container.innerHTML =
        '<p class="text-center text-muted">No related products found.</p>';
      console.log("ℹ️ No related products for category:", category);
      return;
    }

    container.innerHTML = related
      .map((p) => {
        const normalizedImage = fixImg(p.image); // 🔧 FIX
        return `
          <div class="col-md-3 col-sm-6">
            <div 
              class="product-card shadow-sm p-3 border rounded text-center"
              onclick="viewProductDetails('${p._id}')"
              style="cursor: pointer;"
            >
              <img src="${normalizedImage}" 
                   alt="${p.title}" 
                   class="img-fluid mb-2 rounded" 
                   style="height:180px; object-fit:cover;"
                   onerror="this.src='images/placeholder.jpg'">
              <h6 class="fw-semibold mt-2">${p.title}</h6>
              <p class="text-muted small mb-2">₱${p.price}${p.price_unit ? "/" + p.price_unit : ""}</p>
              <button class="btn btn-sm btn-outline-primary">
                View Details
              </button>
            </div>
          </div>`;
      })
      .join("");


    console.log(`✅ ${related.length} related products displayed for category:`, category);
  } catch (err) {
    console.error("❌ Failed to load related products:", err);
    container.innerHTML =
      '<p class="text-danger text-center">Error loading related products.</p>';
  }
}

// ======================================================
// 🪟 Hard fallback: force open login popup programmatically
// ======================================================
window.forceOpenLoginPopup = function () {
  const loginContainer    = document.getElementById('loginContainer');
  const registerContainer = document.getElementById('registerContainer');
  const loginEmail        = document.getElementById('loginEmail');

  if (registerContainer) {
    // make sure register is hidden
    registerContainer.style.display = 'none';
    registerContainer.classList.remove('active', 'show');
  }

  if (loginContainer) {
    // show login popup (covers both "flex" and class-based CSS)
    loginContainer.style.display = 'flex';
    loginContainer.classList.add('active', 'show');
  }

  if (loginEmail) {
    loginEmail.focus();
  }
};


// 🔗 Redirect
function viewProductDetails(productId) {
  console.log("➡️ Viewing product:", productId);
  window.location.href = `/product_shop.html?id=${productId}`;
}
