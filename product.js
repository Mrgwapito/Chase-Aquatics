// product.js  (FINAL — no add-to-cart logic here)
import { showToast, queueFlashToast } from '/assets/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const productGrid = document.getElementById('product-grid');
  const categoryLinks = document.querySelectorAll('#category-list a[data-category]');
  const toggleBtn = document.querySelector('.nav-toggle');
  const navlinks = document.getElementById('navlinks');

  // Helper: ensure image paths work for /uploads/...
  const fixImg = (src) => {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    // your server serves /uploads at http://localhost:3000/uploads/...
    return `http://localhost:3000${src.startsWith('/') ? '' : '/'}${src}`;
  };

  // ✅ Navbar toggle (mobile)
  if (toggleBtn && navlinks) {
    toggleBtn.addEventListener('click', () => {
      const open = navlinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ✅ Load products dynamically
  try {
    // ask for ALL products (server treats limit=0 as "no limit" per our route)
    const res = await fetch('http://localhost:3000/api/products?limit=0');
    const payload = await res.json();

    // Server returns an object; extract the array robustly
    const products = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.products)
        ? payload.products
        : [];

    if (!Array.isArray(products) || products.length === 0) {
      productGrid.innerHTML = `<p class="text-center text-muted py-5">No products found.</p>`;
      return;
    }

    // Render all products — SAME MARKUP / STYLES AS BEFORE
productGrid.innerHTML = products.map(p => `
  <div 
    class="product-card"
    data-id="${p._id}"
    data-category="${p.category}"
    data-stock="${p.stock ?? 0}"
  >
    <img src="${fixImg(p.image)}" alt="${p.alt || p.title}">
    <div class="product-info">
      <h3>${p.title}</h3>
      <div class="card-buttons">
        <a href="product_shop.html?id=${encodeURIComponent(p._id)}" class="view-details">
          <i class="fas fa-eye"></i>
        </a>
        <button class="add-to-cart">
          <i class="fas fa-shopping-cart"></i>
        </button>
      </div>
    </div>
    <p>₱${p.price}${p.price_unit ? '/' + p.price_unit : ''}</p>
  </div>
`).join('');


    // Let cart.js own the add-to-cart click via event delegation
    makeCardsClickable();
    initializeCategoryFilter();
  } catch (err) {
    console.error('❌ Failed to load products:', err);
    productGrid.innerHTML = `<p class="text-center text-danger py-5">Error loading products.</p>`;
  }

  // 🔗 Card-level navigation (click anywhere except the buttons)
  function makeCardsClickable() {
    productGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;

      // Don’t steal clicks from the cart button or the eye link
      if (e.target.closest('.add-to-cart') || e.target.closest('.view-details')) return;

      const id = card.dataset.id;
      window.location.href = `product_shop.html?id=${encodeURIComponent(id)}`;
    });

    // Optional: keyboard support
    productGrid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = card.dataset.id;
        window.location.href = `product_shop.html?id=${encodeURIComponent(id)}`;
      }
    });
  }

  // 🧩 CATEGORY FILTER (unchanged)
  function initializeCategoryFilter() {
    const productCards = document.querySelectorAll('.product-card');
    categoryLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const cat = link.dataset.category;
        categoryLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        productCards.forEach(card => {
          card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
        });
      });
    });
  }
});
