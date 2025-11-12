// ================================================================
// 🌊 CHASE AQUATICS - ORDER SUMMARY SCRIPT (Server cart aware)
// ================================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Order Summary Page Loaded");

  const API_BASE = window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "http://localhost:3000";

  // ---------- auth + cart helpers (aligned with cart.js) ----------
  function authToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
  }
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
  async function fetchServerCart() {
    const token = authToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('fetch cart failed');
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
  // ---------------------------------------------------------------

  // 🟩 Get cart (server if logged-in; LS if guest)
  let cart = [];
  if (authToken()) {
    const serverItems = await fetchServerCart();
    cart = normalizeServerItems(serverItems || []);
    saveCartLS(cart); // keep LS in sync for quick UI
  } else {
    cart = loadCartLS();
  }

  console.log("🛒 Cart Data:", cart);

  const orderItemsContainer = document.getElementById("order-items");
  const subtotalEl = document.getElementById("order-subtotal");
  const shippingEl = document.getElementById("order-shipping");
  const totalEl = document.querySelector(".order-total-value");
  const orderIdEl = document.getElementById("order-id");

  // ================================================================
  // 🧾 Generate a unique order ID (every page load) — unchanged
  // ================================================================
  function generateOrderId() {
    const prefix = "CAQ"; // Chase Aquatics
    const date = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    return `${prefix}-${date}-${randomNum}`;
  }

  const newOrderId = generateOrderId();
  console.log("🎫 Generated Order ID:", newOrderId);
  if (orderIdEl) orderIdEl.textContent = newOrderId;
  localStorage.setItem("orderId", newOrderId);

  // ================================================================
  // 🚨 If cart empty
  // ================================================================
  if (!cart || cart.length === 0) {
    renderEmptyCart();
    return;
  }

  // ================================================================
  // 🧾 Render all items
  // ================================================================
  await renderCartItems();

  // ================================================================
  // 🧩 FUNCTIONS
  // ================================================================

  function renderEmptyCart() {
    if (orderItemsContainer) {
      orderItemsContainer.innerHTML = `
        <div class="text-center text-muted py-5">
          <p>Your cart is empty.</p>
          <a href="../product.html" class="btn btn-outline-secondary mt-3">
            <i class="fa-solid fa-arrow-left"></i> Continue Shopping
          </a>
        </div>
      `;
    }
    if (subtotalEl) subtotalEl.textContent = "₱0.00";
    if (shippingEl) shippingEl.textContent = "₱0.00";
    if (totalEl) totalEl.textContent = "₱0.00";
  }

  async function renderCartItems() {
    let subtotal = 0;
    if (orderItemsContainer) orderItemsContainer.innerHTML = "";

    for (const item of cart) {
      try {
        const productId = item._id || item.id || item.productId;
        let product = null;

        // Try fetching the latest product info from backend
        try {
          const res = await fetch(`${API_BASE}/api/product/${productId}`);
          if (res.ok) product = await res.json();
        } catch (err) {
          console.warn(`⚠️ Failed to fetch product ${productId}`, err);
        }

        // Fallback to local data
        const productName = product?.title || item.title || "Unknown Product";
        let productImage = product?.image || item.image || "../images/placeholder.jpg";

        if (productImage.startsWith("/")) {
          productImage = `..${productImage}`;
        } else if (!productImage.startsWith("http") && !productImage.startsWith("../")) {
          productImage = `../${productImage}`;
        }

        const productPrice = Number(product?.price) || Number(item.price) || 0;
        const quantity = item.quantity || 1;
        const itemTotal = productPrice * quantity;
        subtotal += itemTotal;

        const itemHTML = `
          <div class="order-item d-flex align-items-center justify-content-between mb-3 p-2 border rounded shadow-sm">
            <a href="../product_shop.html?id=${productId}" 
               class="d-flex align-items-center text-decoration-none text-dark flex-grow-1">
              <img src="${productImage}" alt="${productName}"
                   style="width:80px; height:80px; object-fit:cover; border-radius:8px; margin-right:12px;"
                   onerror="this.src='../images/placeholder.jpg'">
              <div>
                <h6 class="mb-1">${productName}</h6>
                <p class="text-muted small mb-0">₱${productPrice.toFixed(2)} × ${quantity}</p>
              </div>
            </a>
            <div class="d-flex align-items-center gap-3">
              <strong class="text-end">₱${itemTotal.toFixed(2)}</strong>
              <button class="remove-btn btn btn-sm btn-danger" data-id="${productId}" title="Remove">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        `;

        if (orderItemsContainer) orderItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
      } catch (err) {
        console.error("❌ Error rendering product:", err);
      }
    }

    // 🧮 Totals
    const shipping = subtotal > 0 ? 100 : 0;
    const total = subtotal + shipping;
    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = `₱${shipping.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;

    attachRemoveEvents();

    console.log("✅ Order summary rendered successfully.");
  }

  function attachRemoveEvents() {
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");

        // Remove from local cart
        cart = cart.filter(
          (i) => String(i._id) !== String(id) &&
                 String(i.id) !== String(id) &&
                 String(i.productId) !== String(id)
        );

        // Persist locally
        saveCartLS(cart);

        // If logged in, push to server too
        if (authToken()) {
          pushServerCartDebounced(cart);
        }

        if (cart.length === 0) {
          renderEmptyCart();
        } else {
          await renderCartItems();
        }
      });
    });
  }
});
