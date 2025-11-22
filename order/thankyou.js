// ================================================================
// 📃 CHASE AQUATICS - THANK YOU RECEIPT PAGE
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("📃 Thank you page loaded.");

  // ------------------------------
  // 1. Pull summary from sessionStorage
  // ------------------------------
  const raw = sessionStorage.getItem("lastOrderSummary");
  if (!raw) {
    console.warn("No lastOrderSummary found in sessionStorage.");
    // you can redirect if you want:
    // window.location.href = "../product.html";
    return;
  }

  let summary;
  try {
    summary = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse lastOrderSummary:", e);
    return;
  }

  // ------------------------------
  // 2. DOM refs
  // ------------------------------
  const orderIdEl   = document.getElementById("headerOrderId");
  const placedOnEl  = document.getElementById("placedOn");

  const shipNameEl      = document.getElementById("shipName");
  const shipLine1El     = document.getElementById("shipLine1");
  const shipBarangayEl  = document.getElementById("shipBarangay");
  const shipCityEl      = document.getElementById("shipCity");
  const shipProvinceEl  = document.getElementById("shipProvince");
  const shipPostalEl    = document.getElementById("shipPostal");
  const shipRegionEl    = document.getElementById("shipRegion");

  const contactEmailEl = document.getElementById("contactEmail");
  const contactPhoneEl = document.getElementById("contactPhone");

  const paymentMethodEl   = document.getElementById("paymentMethod");
  const fulfillmentMethodEl = document.getElementById("fulfillmentMethod");

  const itemsListEl    = document.getElementById("itemsList");
  const subtotalEl     = document.getElementById("subtotalAmount");
  const vatEl          = document.getElementById("vatAmount");
  const shippingEl     = document.getElementById("shippingAmount");
  const totalEl        = document.getElementById("totalAmount");

  const pdfBtn         = document.getElementById("downloadPdfBtn");
  const printBtn       = document.getElementById("printBtn");
  const receiptSection = document.getElementById("receipt");

  // ------------------------------
  // 3. Fill header info
  // ------------------------------
  const customer = summary.customer || {};
  const shipping = summary.shipping || {};
  const totals   = summary.totals   || {};

  if (orderIdEl && summary.orderId) {
    orderIdEl.textContent = summary.orderId;
  }

  if (placedOnEl) {
    const dt = summary.placedAt ? new Date(summary.placedAt) : new Date();
    const opts = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    placedOnEl.textContent = dt.toLocaleString(undefined, opts);
  }

  // Shipping block
  const ship = shipping || {};

  // Prefer a more complete line1 if we ever store it differently
  const line1 =
    ship.line1 ||
    ship.fullAddress ||
    ship.addressLine1 ||
    ship.full ||
    "";

  const postal =
    ship.postal ||
    ship.postalCode ||
    "";

  if (shipNameEl)     shipNameEl.textContent     = customer.name  || "Customer";
  if (shipLine1El)    shipLine1El.textContent    = line1;
  if (shipBarangayEl) shipBarangayEl.textContent = ship.barangay ? ship.barangay + ", " : "";
  if (shipCityEl)     shipCityEl.textContent     = ship.city ? ship.city + ", " : "";
  if (shipProvinceEl) shipProvinceEl.textContent = ship.province ? ship.province + " " : "";
  if (shipPostalEl)   shipPostalEl.textContent   = postal;
  if (shipRegionEl)   shipRegionEl.textContent   = ship.region || "";


  // Contact
  if (contactEmailEl) contactEmailEl.textContent = customer.email || "";
  if (contactPhoneEl) contactPhoneEl.textContent = customer.phone || "";

  // Payment & delivery
  if (paymentMethodEl)   paymentMethodEl.textContent   = summary.paymentMethod || "COD";
  if (fulfillmentMethodEl) fulfillmentMethodEl.textContent = summary.fulfillment   || "Delivery";

  // ------------------------------
  // 4. Items list
  // ------------------------------
  if (itemsListEl && Array.isArray(summary.items)) {
    itemsListEl.innerHTML = "";

    summary.items.forEach((item) => {
      const price = Number(item.price) || 0;
      const qty   = Number(item.quantity) || 1;
      const lineTotal = price * qty;

      const rawImg = item.image || "";
      const safeImg = rawImg.startsWith("http")
        ? rawImg
        : `../${String(rawImg).replace(/^\//, "")}`;

      const li = document.createElement("li");
      li.className = "ty-item-row";

      li.innerHTML = `
        <div class="ty-item-left" style="display:flex;align-items:center;gap:10px;">
          <img src="${safeImg}"
               alt="${item.title || ""}"
               style="width:48px;height:48px;object-fit:cover;border-radius:8px;"
               onerror="this.src='../images/placeholder.jpg'">
          <div>
            <div>${item.title || "Item"}</div>
            <div class="small text-muted">₱${price.toFixed(2)} × ${qty}</div>
          </div>
        </div>
        <div class="ty-item-right" style="font-weight:600;">
          ₱${lineTotal.toFixed(2)}
        </div>
      `;

      itemsListEl.appendChild(li);
    });
  }

  // ------------------------------
  // 5. Totals
  // ------------------------------
  const fmt = (n) => `₱${(Number(n) || 0).toFixed(2)}`;

  if (subtotalEl) subtotalEl.textContent = fmt(totals.subtotal);
  if (vatEl)      vatEl.textContent      = fmt(totals.vat);
  if (shippingEl) shippingEl.textContent = fmt(totals.shipping);
  if (totalEl)    totalEl.textContent    = fmt(totals.total);

  // ------------------------------
  // 6. PDF + print actions
  // ------------------------------
  if (pdfBtn && receiptSection && window.html2pdf) {
    pdfBtn.addEventListener("click", () => {
      const fileId = summary.orderId || "receipt";
      const opt = {
        margin:       10,
        filename:     `chaseaquatics-order-${fileId}.pdf`,
        image:        { type: "jpeg", quality: 0.95 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
      };
      window.html2pdf().from(receiptSection).set(opt).save();
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  // ------------------------------
  // 7. Toast: confirmation email
  // ------------------------------
  try {
    if (window.Toast && window.Toast.showToast && customer.email) {
      window.Toast.showToast({
        title: "Order placed successfully",
        message: `We've successfully sent a confirmation email to ${customer.email}.`,
        type: "success",
        duration: 3200,
        position: "top",
      });
    }
  } catch (e) {
    console.warn("Toast failed:", e);
  }
});
