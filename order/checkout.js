document.addEventListener("DOMContentLoaded", async () => {
  console.log("🧾 Checkout Page Loaded");

  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const itemsContainer = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const shipping = 100;

  // ✅ Form fields
  const nameInput = document.getElementById("custName");
  const emailInput = document.getElementById("custEmail");
  const phoneInput = document.getElementById("custPhone");
  const addressInput = document.getElementById("custAddress");

  let userData = null;
  const token = localStorage.getItem("token");

  // =====================================================
  // 🟩 STEP 1: VERIFY LOGIN
  // =====================================================
  if (!token) {
    alert("⚠️ Please log in first before checking out.");
    window.location.href = "../index.html";
    return;
  }

  // =====================================================
  // 🟩 STEP 2: LOAD USER PROFILE INFO
  // =====================================================
  try {
    // 🔧 Always use localhost (not 127.0.0.1) to match CORS in your server.js
    const res = await fetch("http://localhost:3000/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Profile fetch failed:", errorText);
      alert("⚠️ Session expired or unauthorized. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
      return;
    }

    const data = await res.json();
    if (data.success && data.user) {
      userData = data.user;
      console.log("👤 Loaded user profile:", userData);

      // ✅ Pre-fill form fields with data from MongoDB
      nameInput.value = userData.fullName || "";
      emailInput.value = userData.email || "";
      phoneInput.value = userData.phone || "";
      addressInput.value = userData.address || "";
    } else {
      alert("⚠️ Unable to load user profile. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
    }
  } catch (err) {
    console.error("❌ Failed to load user info:", err);
    alert(
      "⚠️ Unable to connect to backend. Make sure:\n" +
      "1️⃣ Node.js server is running (npm run dev)\n" +
      "2️⃣ You're using Live Server (http://localhost:5500)\n" +
      "3️⃣ Port 3000 is not blocked by firewall"
    );
    return;
  }

  // =====================================================
  // 🟩 STEP 3: LOAD CART ITEMS
  // =====================================================
  if (!cart.length) {
    itemsContainer.innerHTML = `
      <p class="text-center text-muted py-4">Your cart is empty.</p>`;
    const btn = document.querySelector("button[type='submit']");
    if (btn) btn.disabled = true;
    return;
  }

  let subtotal = 0;
  itemsContainer.innerHTML = "";

  cart.forEach((item) => {
    const price = Number(item.price) || 0;
    const itemTotal = price * (item.quantity || 1);
    subtotal += itemTotal;

    const safeImg = item.image?.startsWith("http")
      ? item.image
      : `../${item.image.replace(/^\//, "")}`;

    const itemHTML = `
      <div class="order-item d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
        <div class="d-flex align-items-center">
          <img src="${safeImg}" alt="${item.title}"
               style="width:60px; height:60px; object-fit:cover; border-radius:8px; margin-right:12px;"
               onerror="this.src='../images/placeholder.jpg'">
          <div class="order-item-info">
            <h6 class="mb-0">${item.title}</h6>
            <p class="text-muted mb-0 small">₱${price.toFixed(2)} × ${item.quantity}</p>
          </div>
        </div>
        <strong>₱${itemTotal.toFixed(2)}</strong>
      </div>
    `;
    itemsContainer.insertAdjacentHTML("beforeend", itemHTML);
  });

  subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  totalEl.textContent = `₱${(subtotal + shipping).toFixed(2)}`;

  // =====================================================
  // 🟩 STEP 4: PLACE ORDER
  // =====================================================
  const checkoutForm = document.getElementById("checkout-form");
  if (!checkoutForm) {
    console.error("❌ checkout-form not found!");
    return;
  }

  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!userData) {
      alert("⚠️ Unable to confirm user information.");
      return;
    }

 const orderData = {
  userId: userData?._id || userData?.id || null, // ✅ supports both key types
  name: nameInput.value.trim(),
  email: emailInput.value.trim(),
  phone: phoneInput.value.trim(),
  address: addressInput.value.trim(),
  cart,
};

console.log("🧾 Sending order data:", orderData); // ✅ add this log too



    try {
      const res = await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert("✅ Order placed successfully!");
        localStorage.removeItem("cart");
        window.location.href = "thankyou.html";
      } else {
        console.error("❌ Failed to place order:", data);
        alert("❌ Failed to place order: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Checkout Error:", err);
      alert(
        "⚠️ Could not connect to backend. Please make sure your server is running (http://localhost:3000)"
      );
    }
  });
});
