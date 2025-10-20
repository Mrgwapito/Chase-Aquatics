document.addEventListener('DOMContentLoaded', async () => {
  const productGrid = document.getElementById('product-grid');
  console.log("🧩 Product Links Generated:", 
  [...document.querySelectorAll('.view-details')].map(a => a.href)
);

  const categoryLinks = document.querySelectorAll('#category-list a[data-category]');
  const toggleBtn = document.querySelector('.nav-toggle');
  const navlinks = document.getElementById('navlinks');

  // ✅ Navbar toggle (mobile)
  if (toggleBtn && navlinks) {
    toggleBtn.addEventListener('click', () => {
      const open = navlinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ✅ Load products dynamically
  try {
    const res = await fetch('http://localhost:3000/api/products');
    const products = await res.json();

    console.log("🧩 Loaded products:", products);

    if (!Array.isArray(products) || products.length === 0) {
      productGrid.innerHTML = `<p class="text-center text-muted py-5">No products found.</p>`;
      return;
    }

    // Render all products
    productGrid.innerHTML = products.map(p => `
      <div class="product-card" data-id="${p._id}" data-category="${p.category}">
        <img src="${p.image}" alt="${p.alt || p.title}">
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

    initializeCartButtons();
    initializeCategoryFilter();
  } catch (err) {
    console.error('❌ Failed to load products:', err);
    productGrid.innerHTML = `<p class="text-center text-danger py-5">Error loading products.</p>`;
  }

  // 🛒 CART HANDLER
  function initializeCartButtons() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    addToCartButtons.forEach(button => {
      button.addEventListener('click', () => {
        const card = button.closest('.product-card');
        const id = Number(card.dataset.id);
        const title = card.querySelector('h3').textContent.trim();
        const priceText = card.querySelector('p').textContent.trim();
        const price = parseFloat(priceText.replace(/[₱,/a-z\s]/gi, "")) || 0;
        const image = card.querySelector('img').src;

        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existing = cart.find(item => item._id === id);

        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({ _id: id, title, price, image, quantity: 1 });
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        alert(`${title} added to cart!`);
      });
    });
  }

  // 🧩 CATEGORY FILTER
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
