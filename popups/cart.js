// /popups/cart.js

import { showToast, queueFlashToast } from '/assets/toast.js';



document.addEventListener('DOMContentLoaded', function () {
  console.log("🟢 cart.js fully initialized");

  const cartButton = document.getElementById('cart-btn');
  const cartPopup = document.querySelector('.cart-popup');
  const clearCartButton = document.querySelector('.clear-cart-btn');
  const reviewBtn = document.querySelector('.review-btn');
  const cartItemsContainer = cartPopup?.querySelector('.cart-items');

 // 🧩 Create a badge element if it exists on this page
let cartBadge = document.querySelector('#cart-btn .cart-badge');
if (!cartBadge) {
  cartBadge = document.createElement('span');
  cartBadge.classList.add('cart-badge');
  if (cartButton) cartButton.appendChild(cartBadge); // guard!
}


let cart = loadCartLS();

// 👂 Allow other pages (order_summary / checkout) to force-refresh cart UI
window.addEventListener('cart:refresh', () => {
  cart = loadCartLS();
  updateCartPopup();
  updateCartBadge();
});

// ✅ NEW: helpers for one-time merge + normalization
function mergedFlagKey() {
  const u = currentUser();
  return u?.id ? `cart_merged_${u.id}` : null;
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
// ✅ NEW: always be able to read the guest cart separately
function loadGuestCartLS() {
  try { return JSON.parse(localStorage.getItem('cart_guest')) || []; }
  catch { return []; }
}
// ✅ NEW: convenience to force-save into the current user's cart key
function setUserCartLS(items) {
  saveCartLS(items || []);
}

// Try syncing with server on load (if logged in)
async function syncCartAfterAuthChange({ forceFresh = false } = {}) {
  if (!authToken()) return;

  const flagKey = mergedFlagKey();
  const alreadyMerged = flagKey && sessionStorage.getItem(flagKey) === '1';

  // if forceFresh -> ignore alreadyMerged so first sync post-login can merge guest→user
  if (!alreadyMerged || forceFresh) {
    const userLocalCart  = loadCartLS();
    const guestLocalCart = loadGuestCartLS();

    if (Array.isArray(userLocalCart) && userLocalCart.length > 0) {
      const serverItems = await fetchServerCart();
      if (Array.isArray(serverItems)) {
        cart = normalizeServerItems(serverItems);
        setUserCartLS(cart);
      }
      if (flagKey) sessionStorage.setItem(flagKey, '1');
    } else if (Array.isArray(guestLocalCart) && guestLocalCart.length > 0) {
      const merged = await mergeLocalIntoServer(guestLocalCart);
      if (Array.isArray(merged)) {
        cart = merged;
        setUserCartLS(cart);
        localStorage.removeItem('cart_guest');
      } else {
        const serverItems = await fetchServerCart();
        if (Array.isArray(serverItems)) {
          cart = normalizeServerItems(serverItems);
          setUserCartLS(cart);
        }
      }
      if (flagKey) sessionStorage.setItem(flagKey, '1');
    } else {
      const serverItems = await fetchServerCart();
      if (Array.isArray(serverItems)) {
        cart = normalizeServerItems(serverItems);
        setUserCartLS(cart);
      }
      if (flagKey) sessionStorage.setItem(flagKey, '1');
    }
  } else {
    const serverItems = await fetchServerCart();
    if (Array.isArray(serverItems)) {
      cart = normalizeServerItems(serverItems);
      setUserCartLS(cart);
    }
  }

  updateCartPopup();
  updateCartBadge();

  // ✅ Tell login.js that sync finished (with total item count)
  try {
    const count = (cart || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    window.dispatchEvent(new CustomEvent('cart:synced', { detail: { itemCount: count } }));
  } catch {}
}


// 🔁 Initial sync on page load (replaces the removed IIFE)
syncCartAfterAuthChange();


// Silent: just (re)sync on login. login.js will handle toasts.
window.addEventListener('auth:login', async (evt) => {
  try {
    const u = evt.detail?.user || currentUser();
    if (u?.id) sessionStorage.removeItem(`cart_merged_${u.id}`);
  } catch {}

  await syncCartAfterAuthChange({ forceFresh: true });
});
// (No cart:synced dispatch here anymore – it will happen inside syncCartAfterAuthChange)


// Toast helpers that work whether /assets/toast.js is a classic script
const showToast = (opts) => {
  if (window.Toast?.showToast) return window.Toast.showToast(opts);
  // fallback – won’t block anything if toast file loads a bit later
  alert(`${opts?.title || 'Notice'}\n${opts?.message || ''}`);
};
const queueFlashToast = (opts) => {
  if (window.Toast?.queueFlashToast) return window.Toast.queueFlashToast(opts);
  // no-op fallback
};


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
  const description =
    product.querySelector('.product-description')?.textContent?.trim() ||
    'No description available.';

  if (!id) {
    console.warn("⚠️ Missing product ID, skipping add to cart");
    return;
  }

  // 🔢 Read stock from the card (set in product.js)
  const rawStock = product.dataset.stock;
  const maxStock = rawStock != null && rawStock !== '' ? Number(rawStock) : NaN;

  const existingItem = cart.find(item => String(item._id) === String(id));
  const currentQty = existingItem ? (Number(existingItem.quantity) || 0) : 0;
  const nextQty = currentQty + 1;

  // ⛔ Case 1: No stock at all
  if (Number.isFinite(maxStock) && maxStock <= 0) {
    showToast({
      title: 'Unavailable',
      message: 'This product is not available right now.',
      type: 'warning'
    });
    return;
  }

  // ⛔ Case 2: trying to exceed remaining stock
  if (Number.isFinite(maxStock) && maxStock >= 0 && nextQty > maxStock) {
    const remaining = Math.max(0, maxStock - currentQty);
    const msg = remaining > 0
      ? `This product only has ${remaining} remaining in stock.`
      : `You already reached the maximum stock (${maxStock}) for this product.`;

    showToast({
      title: 'Stock limit reached',
      message: msg,
      type: 'warning'
    });
    return;
  }

  if (existingItem) {
    existingItem.quantity = nextQty;
    if (Number.isFinite(maxStock)) {
      existingItem.maxStock = maxStock; // remember max for the popup
    }
    showToast({
      title: 'Added to cart',
      message: `Added another ${existingItem.title}`,
      type: 'success'
    });
  } else {
    const newItem = { _id: id, title, price, image, description, quantity: 1 };
    if (Number.isFinite(maxStock)) {
      newItem.maxStock = maxStock;
    }
    cart.push(newItem);
    showToast({
      title: 'Added to cart',
      message: `${title} added to cart!`,
      type: 'success'
    });
  }

  // 🔄 Save + re-render
  saveCartLS(cart);
  pushServerCartDebounced(cart);
  updateCartPopup();
  updateCartBadge();
  openCartPopup();
  animateCartIcon();
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

      const item = cart[index];
      if (!item) return;

      const maxStock =
        typeof item.maxStock === 'number' ? item.maxStock : NaN;

      if (action === 'increase') {
        if (Number.isFinite(maxStock) && maxStock >= 0) {
          const newQty = (Number(item.quantity) || 0) + 1;
          if (newQty > maxStock) {
            const remaining = Math.max(0, maxStock - (Number(item.quantity) || 0));
            const msg = remaining > 0
              ? `You can only add ${remaining} more of ${item.title || 'this product'}.`
              : `You already reached the maximum stock (${maxStock}) for ${item.title || 'this product'}.`;

            showToast({
              title: 'Stock limit reached',
              message: msg,
              type: 'warning'
            });
            return;
          }
        }
        item.quantity++;
      } else if (action === 'decrease' && item.quantity > 1) {
        item.quantity--;
      }

      saveCartLS(cart);
      updateCartPopup();
      updateCartBadge();
      pushServerCartDebounced(cart);
    });
  });
  
  // keep your existing remove-btn logic as is
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const index = this.getAttribute('data-index');
      if (!cart[index]) return;
      const removed = cart.splice(index, 1);
      saveCartLS(cart);
      updateCartPopup();
      updateCartBadge();
      pushServerCartDebounced(cart);
      showToast({
        title: 'Removed',
        message: `${removed[0].title} removed from cart.`,
        type: 'info'
      });
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

// --- helpers to namespace cart in storage ---
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
    localStorage.removeItem(getCartKey());
    pushServerCartDebounced(cart);   // (saves empty server cart)
    updateCartPopup();
    updateCartBadge();
    showToast({
  title: 'Cart cleared',
  message: 'All items have been removed.',
  type: 'info'
});



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
  // 🔁 INITIAL LOAD
  // ===============================================================
  updateCartPopup();
  updateCartBadge();
});

// ✅ Backend base URL (local + Render) — shared with other scripts
const API_BASE =
  window.__API_BASE__ ||
  ((window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:3000'
    : 'https://chase-aquatics.onrender.com');

// Expose globally so login.js, forgotpass.js, booking.js, etc. can reuse it
window.__API_BASE__ = window.__API_BASE__ || API_BASE;


function authToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
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
  } catch {
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
          productId: it._id || it.productId, // support your current shape
          quantity: it.quantity,
          title: it.title, price: it.price, image: it.image
        })) })
      });
    } catch {}
  }, 300);
}

async function mergeLocalIntoServer(localItems) {
  const token = authToken();
  if (!token || !Array.isArray(localItems) || !localItems.length) return;
  try {
    const res = await fetch(`${API_BASE}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ items: localItems.map(it => ({
        productId: it._id || it.productId,
        quantity: it.quantity,
        title: it.title, price: it.price, image: it.image
      })) })
    });
    if (res.ok) {
      const data = await res.json();
      const normalized = (data.items || []).map(it => ({
        _id: String(it.productId),
        title: it.title,
        price: it.price,
        image: it.image,
        quantity: it.quantity
      }));
      saveCartLS(normalized);
      return normalized;
    }
  } catch {}
  return null;
}
