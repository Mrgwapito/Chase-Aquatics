document.addEventListener("DOMContentLoaded", async function () {
  console.log("🟢 product_shop.js loaded");

  await new Promise((resolve) => setTimeout(resolve, 100));

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");
  const cartPopup = document.querySelector(".cart-popup");
  const cartButton = document.getElementById("cart-btn");
  const cartBadge = document.querySelector(".cart-badge");

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
  const normalizedImage = product.image?.startsWith("http")
    ? product.image
    : `/${product.image?.replace(/^\//, "") || "images/placeholder.jpg"}`;

  // ✅ Populate product details
  document.getElementById("product-name").textContent =
    product.title || "Untitled Product";
  document.getElementById(
    "product-category"
  ).innerHTML = `<strong>Category:</strong> ${product.category || "Uncategorized"}`;
  document.getElementById(
    "product-price"
  ).innerHTML = `<strong>Price:</strong> ₱${product.price}${
    product.price_unit ? "/" + product.price_unit : ""
  }`;
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
      const resolvedImg = imgSrc?.startsWith("http")
        ? imgSrc
        : `/${imgSrc?.replace(/^\//, "")}`;
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
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    const existing = cart.find((item) => item._id === product._id);

    // ✅ Normalize image before storing to cart
    const normalizedImage = product.image?.startsWith("http")
      ? product.image
      : `/${product.image?.replace(/^\//, "") || "images/placeholder.jpg"}`;

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        _id: product._id,
        title: product.title,
        price: product.price,
        image: normalizedImage, // ✅ fixed path
        quantity,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    console.log("🛒 Cart updated:", cart);

    updateCartBadge();

    // Animate icon
    const icon = cartButton?.querySelector("i");
    if (icon) {
      icon.classList.add("cart-animate");
      setTimeout(() => icon.classList.remove("cart-animate"), 300);
    }

    showCartPopup();
    showToast(`${product.title} added to cart!`);
  }

  // ======================================================
  // 🔢 UPDATE CART BADGE COUNT
  // ======================================================
  function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  // ======================================================
  // ✨ TOAST NOTIFICATION
  // ======================================================
  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 500);
    }, 2000);
  }

  // Initialize badge count
  updateCartBadge();
});

/* ======================================================
   🧠 Helper: Fetch product with retry for slow responses
====================================================== */
async function fetchProductWithRetry(productId, retries = 1) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt} for product ID: ${productId}`);
      const res = await fetch(`/api/product/${productId}`);
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
    const res = await fetch(`/api/products`);
    if (!res.ok)
      throw new Error(`Failed to fetch related products (${res.status})`);
    const products = await res.json();

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
        const normalizedImage = p.image?.startsWith("http")
          ? p.image
          : `/${p.image?.replace(/^\//, "") || "images/placeholder.jpg"}`;
        return `
          <div class="col-md-3 col-sm-6">
            <div class="product-card shadow-sm p-3 border rounded text-center">
              <img src="${normalizedImage}" 
                   alt="${p.title}" 
                   class="img-fluid mb-2 rounded" 
                   style="height:180px; object-fit:cover;"
                   onerror="this.src='images/placeholder.jpg'">
              <h6 class="fw-semibold mt-2">${p.title}</h6>
              <p class="text-muted small mb-2">₱${p.price}${
          p.price_unit ? "/" + p.price_unit : ""
        }</p>
              <button class="btn btn-sm btn-outline-primary" onclick="viewProductDetails('${
                p._id
              }')">
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
