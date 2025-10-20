// ================================================================
// 🌊 CHASE AQUATICS - ORDER SUMMARY SCRIPT (Dynamic Order ID Fix)
// ================================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Order Summary Page Loaded");

  // 🟩 Get cart from localStorage
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  console.log("🛒 Cart Data:", cart);

  const orderItemsContainer = document.getElementById("order-items");
  const subtotalEl = document.getElementById("order-subtotal");
  const shippingEl = document.getElementById("order-shipping");
  const totalEl = document.querySelector(".order-total-value");
  const orderIdEl = document.getElementById("order-id");

  // ================================================================
  // 🧾 Generate a unique order ID (every page load)
  // ================================================================
  function generateOrderId() {
    const prefix = "CAQ"; // Chase Aquatics
    const date = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    return `${prefix}-${date}-${randomNum}`;
  }

  // Always generate a new one when the page loads
  const newOrderId = generateOrderId();
  console.log("🎫 Generated Order ID:", newOrderId);

  // ✅ Update the displayed Order ID
  if (orderIdEl) {
    orderIdEl.textContent = newOrderId;
  }

  // ✅ Save it to localStorage for checkout use
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
    orderItemsContainer.innerHTML = `
      <div class="text-center text-muted py-5">
        <p>Your cart is empty.</p>
        <a href="../product.html" class="btn btn-outline-secondary mt-3">
          <i class="fa-solid fa-arrow-left"></i> Continue Shopping
        </a>
      </div>
    `;
    subtotalEl.textContent = "₱0.00";
    shippingEl.textContent = "₱0.00";
    totalEl.textContent = "₱0.00";
  }

  async function renderCartItems() {
    let subtotal = 0;
    orderItemsContainer.innerHTML = "";

    for (const item of cart) {
      try {
        const productId = item._id || item.id;
        let product = null;

        // Try fetching the latest product info from backend
        try {
          const res = await fetch(`http://localhost:3000/api/product/${productId}`);
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

        orderItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
      } catch (err) {
        console.error("❌ Error rendering product:", err);
      }
    }

    // 🧮 Totals
    const shipping = subtotal > 0 ? 100 : 0;
    const total = subtotal + shipping;
    subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
    shippingEl.textContent = `₱${shipping.toFixed(2)}`;
    totalEl.textContent = `₱${total.toFixed(2)}`;

    attachRemoveEvents();

    console.log("✅ Order summary rendered successfully.");
  }

  function attachRemoveEvents() {
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        cart = cart.filter(
          (i) => String(i._id) !== String(id) && String(i.id) !== String(id)
        );

        // Update localStorage + re-render
        localStorage.setItem("cart", JSON.stringify(cart));

        if (cart.length === 0) {
          renderEmptyCart();
        } else {
          renderCartItems();
        }
      });
    });
  }
});
