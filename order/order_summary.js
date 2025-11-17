// ================================================================
// 🌊 CHASE AQUATICS - ORDER SUMMARY SCRIPT (Server cart aware)
// ================================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Order Summary Page Loaded");

  // ✅ Backend base URL (local + Render) — shared with other scripts
  const API_BASE =
    window.__API_BASE__ ||
    ((window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost")
      ? "http://127.0.0.1:3000"                 // local dev
      : "https://chase-aquatics.onrender.com"); // deployed backend

  // Expose globally so cart.js, login.js, forgotpass.js, etc. can reuse it
  window.__API_BASE__ = window.__API_BASE__ || API_BASE;


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
  // 🟩 Get cart
  // 1) Start from localStorage
  // 2) If logged in, try server – but only override LS if server has items
  let cart = loadCartLS();

  if (authToken()) {
    const serverItems = await fetchServerCart();
    const serverCart = normalizeServerItems(serverItems || []);

    if (serverCart.length > 0) {
      // ✅ Server has items – trust server & sync LS
      cart = serverCart;
      saveCartLS(cart);
      console.log("🛒 Using SERVER cart:", cart);
    } else {
      // ✅ Server empty – keep local cart
      console.log("ℹ️ Server cart empty, using LOCAL cart:", cart);
    }
  } else {
    console.log("👤 Guest user, using LOCAL cart:", cart);
  }

  console.log("🛒 Final cart used in order_summary:", cart);


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

    // use entries() so we also get the index for each cart item
    for (const [index, item] of cart.entries()) {
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

        // Prefer cart data (variant-aware), fallback to product
        const productName = item.title || product?.title || "Unknown Product";

        // Prefer image from cart (already normalized), fallback to product
        let productImage = item.image || product?.image || "../images/placeholder.jpg";
        if (productImage.startsWith("/")) {
          productImage = `..${productImage}`;
        } else if (!productImage.startsWith("http") && !productImage.startsWith("../")) {
          productImage = `../${productImage}`;
        }

        // Prefer price from cart (variant price), fallback to product price
        const productPrice = Number(item.price) || Number(product?.price) || 0;
        const quantity = Number(item.quantity) || 1;
        const itemTotal = productPrice * quantity;
        subtotal += itemTotal;

        // If cart item has variant object with Size, show it
        const variantLabel = item.variant?.options?.Size
          ? `<span class="text-muted small d-block">Size: ${item.variant.options.Size}</span>`
          : "";

        const itemHTML = `
          <div class="order-item d-flex align-items-center justify-content-between mb-3 p-2 border rounded shadow-sm">
            <a href="../product_shop.html?id=${productId}" 
               class="d-flex align-items-center text-decoration-none text-dark flex-grow-1">
              <img src="${productImage}" alt="${productName}"
                   style="width:80px; height:80px; object-fit:cover; border-radius:8px; margin-right:12px;"
                   onerror="this.src='../images/placeholder.jpg'">
              <div>
                <h6 class="mb-1">${productName}</h6>
                ${variantLabel}
                <p class="text-muted small mb-0">₱${productPrice.toFixed(2)} × ${quantity}</p>
              </div>
            </a>
            <div class="d-flex align-items-center gap-3">
              <strong class="text-end">₱${itemTotal.toFixed(2)}</strong>
              <button class="remove-btn btn btn-sm btn-danger" 
                      data-id="${productId}" 
                      data-index="${index}" 
                      title="Remove">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        `;

        if (orderItemsContainer) {
          orderItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
        }
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
      const indexAttr = e.currentTarget.getAttribute("data-index");
      const idAttr = e.currentTarget.getAttribute("data-id");
      let removedItem = null;

      if (indexAttr !== null && indexAttr !== undefined) {
        // 🔹 Prefer index-based removal (variant-safe)
        const index = Number(indexAttr);
        if (!Number.isNaN(index) && cart[index]) {
          removedItem = cart.splice(index, 1)[0];
        }
      } else if (idAttr) {
        // 🔹 Fallback: ID-based removal (legacy)
        const id = idAttr;
        const beforeLen = cart.length;
        cart = cart.filter(
          (i) => String(i._id) !== String(id) &&
                 String(i.id) !== String(id) &&
                 String(i.productId) !== String(id)
        );
        if (cart.length < beforeLen) {
          removedItem = { title: "Item" };
        }
      }

      if (!removedItem) {
        console.warn("⚠️ Nothing removed from cart (no matching item).");
        return;
      }

      // Persist locally
      saveCartLS(cart);

      // If logged in, push to server too
      if (authToken()) {
        pushServerCartDebounced(cart);
      }

      // 🔔 Tell cart.js to refresh popup + badge
      window.dispatchEvent(new CustomEvent("cart:refresh"));

      // Toast feedback (if available)
      if (window.Toast?.showToast) {
        window.Toast.showToast({
          title: "Removed",
          message: `${removedItem.title || "Item"} removed from cart.`,
          type: "info"
        });
      }

      if (cart.length === 0) {
        renderEmptyCart();
      } else {
        await renderCartItems();
      }
    });
  });
}

// ================================================================
// 🚪 Gate "Proceed to Checkout" with login + toast
// ================================================================
const checkoutLink = document.querySelector('a[href="checkout.html"]');
if (checkoutLink) {
  checkoutLink.addEventListener('click', (e) => {
    const token = authToken();
    if (!token) {
      e.preventDefault();

      if (window.Toast && typeof window.Toast.showToast === 'function') {
        window.Toast.showToast({
          title: 'Please log in',
          message: 'Sign in or create an account before checking out.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
      } else {
        // Very last fallback
        alert('Please log in before checking out.');
      }
    }
  });
}

});
