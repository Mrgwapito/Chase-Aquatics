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
      const safeImage = fixImg(item.image || "images/placeholder.jpg"); // 🔧 FIX: ensure absolute
      const safePrice = Number(item.price) > 0 ? Number(item.price) : 0;
      const safeQty = Number(item.quantity) > 0 ? item.quantity : 1;

      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <img src="${safeImage}" alt="${safeTitle}">
        <div class="item-info">
          <h4>${safeTitle}</h4>
          <p>₱${safePrice.toFixed(2)}</p>
        </div>
        <div class="item-controls">
          <button class="qty-btn" data-index="${index}" data-action="decrease">-</button>
          <span class="qty">${safeQty}</span>
          <button class="qty-btn" data-index="${index}" data-action="increase">+</button>
          <button class="remove-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
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
          body: JSON.stringify({ items: items.map(it => ({
            productId: it._id || it.productId,
            quantity: it.quantity,
            title: it.title, price: it.price, image: it.image
          })) })
        });
      } catch {}
    }, 300);
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

  // 🆕 BUY NOW → add to cart then redirect to order summary
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", () => {
      const qtyInput = document.getElementById("quantity");
      const quantity = parseInt(qtyInput?.value || "1", 10);
      if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
      }

      const result = addToCart(product, quantity, { skipSuccessToast: true });

      if (result && result.success) {
        // Optional soft toast
        if (window.Toast?.showToast) {
          window.Toast.showToast({
            title: "Proceeding to checkout",
            message: "Review your order before placing it.",
            type: "info"
          });
        }
        // 👉 Go to Order Summary page
        window.location.href = "/order/order_summary.html";
      }
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
});

/* ======================================================
   🧠 Helper: Fetch product with retry for slow responses
====================================================== */
async function fetchProductWithRetry(productId, retries = 1) {
  const API_BASE = window.__API_BASE__; // 🔧 FIX
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt} for product ID: ${productId}`);
      const res = await fetch(`${API_BASE}/api/product/${productId}`); // 🔧 FIX: absolute URL
      if (res.ok) {
        const data = await res.json();
        if (data && data._id) return data;
      }
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
  if (!container) return;

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

    const related = products.filter(
      (p) => p.category === category && String(p._id) !== String(excludeId)
    );

    if (!related.length) {
      container.innerHTML =
        '<p class="text-center text-muted">No related products found.</p>';
      return;
    }

    container.innerHTML = related
      .map((p) => {
        const normalizedImage = fixImg(p.image); // 🔧 FIX
        return `
          <div class="col-md-3 col-sm-6">
            <div class="product-card shadow-sm p-3 border rounded text-center">
              <img src="${normalizedImage}" 
                   alt="${p.title}" 
                   class="img-fluid mb-2 rounded" 
                   style="height:180px; object-fit:cover;"
                   onerror="this.src='images/placeholder.jpg'">
              <h6 class="fw-semibold mt-2">${p.title}</h6>
              <p class="text-muted small mb-2">₱${p.price}${p.price_unit ? "/" + p.price_unit : ""}</p>
              <button class="btn btn-sm btn-outline-primary" onclick="viewProductDetails('${p._id}')">
                View Details
              </button>
            </div>
          </div>`;
      })
      .join("");

    console.log(`✅ ${related.length} related products displayed.`);
  } catch (err) {
    console.error("❌ Failed to load related products:", err);
    container.innerHTML =
      '<p class="text-danger text-center">Error loading related products.</p>';
  }
}

// 🔗 Redirect
function viewProductDetails(productId) {
  console.log("➡️ Viewing product:", productId);
  window.location.href = `/product_shop.html?id=${productId}`;
}
