// product_shop.js (patched to use namespaced cart key + server sync)

// 🔧 FIX: make API base globally accessible to helpers below
window.__API_BASE__ = window.__API_BASE__ || 'http://localhost:3000';

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

  // ✅ Populate product details
  document.getElementById("product-name").textContent =
    product.title || "Untitled Product";
  document.getElementById(
    "product-category"
  ).innerHTML = `<strong>Category:</strong> ${product.category || "Uncategorized"}`;
  document.getElementById(
    "product-price"
  ).innerHTML = `<strong>Price:</strong> ₱${product.price}${product.price_unit ? "/" + product.price_unit : ""}`;
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

  // ✅ Add-to-cart button
  const addToCartBtn = document.getElementById("add-to-cart-btn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
      const qtyInput = document.getElementById("quantity");
      const quantity = parseInt(qtyInput?.value || "1");
      if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
      }
      addToCart(product, quantity);
    });
  }

  // ✅ Fetch & show related products
  await displayRelatedProducts(product.category, product._id);

  // ======================================================
  // 🛒 ADD TO CART FUNCTION (with popup + badge animation)
  // ======================================================
  function addToCart(product, quantity) {
    // 🔁 use namespaced key
    let cart = loadCartLS();

    const existing = cart.find((item) => String(item._id) === String(product._id));

    // ✅ Normalize image before storing to cart
    const normalizedImage = fixImg(product.image); // 🔧 FIX

    if (existing) {
      existing.quantity = Math.min(99, (existing.quantity || 1) + quantity);
    } else {
      cart.push({
        _id: String(product._id),
        title: product.title,
        price: product.price,
        image: normalizedImage, // ✅ fixed path
        quantity: Math.max(1, quantity),
      });
    }

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
    window.Toast?.showToast({
      title: 'Added to cart',
      message: `${product.title} added to cart!`,
      type: 'success'
    });

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
