document.addEventListener('DOMContentLoaded', function () {
  console.log("🟢 cart.js fully initialized");

  const cartButton = document.getElementById('cart-btn');
  const cartPopup = document.querySelector('.cart-popup');
  const clearCartButton = document.querySelector('.clear-cart-btn');
  const reviewBtn = document.querySelector('.review-btn');
  const cartItemsContainer = cartPopup?.querySelector('.cart-items');

  // 🧩 Create a badge element if it doesn't exist
  let cartBadge = document.createElement('span');
  cartBadge.classList.add('cart-badge');
  cartButton.appendChild(cartBadge);

  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  // ===============================================================
  // 🛒 EVENT DELEGATION — WORKS EVEN FOR DYNAMIC PRODUCTS
  // ===============================================================
  document.body.addEventListener('click', function (e) {
    const button = e.target.closest('.add-to-cart');
    if (!button) return;

    const product = button.closest('.product-card');
    if (!product) return;

    const id = product.dataset.id || product.getAttribute('data-id');
    const title = product.querySelector('h3')?.textContent?.trim() || 'Unnamed Product';
    const priceText = product.querySelector('p')?.textContent?.trim() || '₱0';
    const price = parseFloat(priceText.replace(/[₱,/a-z\s]/gi, "")) || 0;
    const image = product.querySelector('img')?.src || 'images/placeholder.jpg';
    const description = product.querySelector('.product-description')?.textContent?.trim() || 'No description available.';

    if (!id) {
      console.warn("⚠️ Missing product ID, skipping add to cart");
      return;
    }

    const existingItem = cart.find(item => String(item._id) === String(id));

    if (existingItem) {
      existingItem.quantity += 1;
      showToast(`Added another ${existingItem.title}`);
    } else {
      cart.push({ _id: id, title, price, image, description, quantity: 1 });
      showToast(`${title} added to cart!`);
    }

    // 🔄 Save + Re-render instantly
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartPopup();
    updateCartBadge();
    openCartPopup(); // auto-show popup to confirm addition
    animateCartIcon(); // 🔴 Animate cart icon
  });

  // ===============================================================
  // 🧾 UPDATE CART POPUP CONTENT (with null safety)
  // ===============================================================
  function updateCartPopup() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';

    if (!cart.length) {
      cartItemsContainer.innerHTML = '<p class="text-center text-muted">Your cart is empty.</p>';
      updateCartBadge();
      return;
    }

    cart.forEach((item, index) => {
      const safeTitle = item.title || "Untitled Product";
      const safeImage = item.image || "images/placeholder.jpg";
      const safePrice = Number(item.price) > 0 ? Number(item.price) : 0;
      const safeQty = Number(item.quantity) > 0 ? item.quantity : 1;

      const cartItem = document.createElement('div');
      cartItem.classList.add('cart-item');
      cartItem.innerHTML = `
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
      cartItemsContainer.appendChild(cartItem);
    });

    attachCartItemEvents();
  }

  // ===============================================================
  // 🔧 CART ITEM CONTROLS (Increase / Decrease / Remove)
  // ===============================================================
  function attachCartItemEvents() {
    document.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const index = this.getAttribute('data-index');
        const action = this.getAttribute('data-action');

        if (!cart[index]) return;

        if (action === 'increase') {
          cart[index].quantity++;
        } else if (action === 'decrease' && cart[index].quantity > 1) {
          cart[index].quantity--;
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartPopup();
        updateCartBadge();
      });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const index = this.getAttribute('data-index');
        if (!cart[index]) return;
        const removed = cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartPopup();
        updateCartBadge();
        showToast(`${removed[0].title} removed from cart.`);
      });
    });
  }

  // ===============================================================
  // 🧭 OPEN / CLOSE CART POPUP
  // ===============================================================
  if (cartButton && cartPopup) {
    cartButton.addEventListener('click', () => {
      if (cartPopup.style.display === 'block') {
        cartPopup.style.opacity = '0';
        setTimeout(() => (cartPopup.style.display = 'none'), 200);
      } else {
        openCartPopup();
      }
    });
  }

  // ===============================================================
  // 🚪 REVIEW MY CART
  // ===============================================================
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      cartPopup.style.opacity = '0';
      setTimeout(() => {
        cartPopup.style.display = 'none';
        window.location.href = 'order/order_summary.html';
      }, 200);
    });
  }

  // ===============================================================
  // ❌ CLEAR CART
  // ===============================================================
  clearCartButton?.addEventListener('click', () => {
    cart = [];
    localStorage.removeItem('cart');
    updateCartPopup();
    updateCartBadge();
    showToast('🧹 Cart cleared successfully.');
  });

  // ===============================================================
  // 🧩 HELPER: OPEN CART INSTANTLY AFTER ADDING + AUTO-HIDE
  // ===============================================================
  function openCartPopup() {
    if (!cartPopup) return;
    cartPopup.style.display = 'block';
    setTimeout(() => (cartPopup.style.opacity = '1'), 10);

    clearTimeout(window.cartAutoHideTimer);
    window.cartAutoHideTimer = setTimeout(() => {
      if (cartPopup.matches(':hover')) return;
      cartPopup.style.opacity = '0';
      setTimeout(() => (cartPopup.style.display = 'none'), 300);
    }, 3000);
  }

  // ===============================================================
  // 🔴 Animate Cart Icon when adding item
  // ===============================================================
  function animateCartIcon() {
    const icon = cartButton.querySelector('i');
    if (!icon) return;
    icon.classList.add('cart-animate');
    setTimeout(() => icon.classList.remove('cart-animate'), 700);
  }

  // ===============================================================
  // 🔢 Update Cart Badge (total quantity)
  // ===============================================================
  function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalItems > 0) {
      cartBadge.textContent = totalItems;
      cartBadge.style.display = 'flex';
    } else {
      cartBadge.style.display = 'none';
    }
  }

  // ===============================================================
  // 🧩 TOAST NOTIFICATION
  // ===============================================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    }, 2000);
  }

  // ===============================================================
  // 🔁 INITIAL LOAD
  // ===============================================================
  updateCartPopup();
  updateCartBadge();
});
