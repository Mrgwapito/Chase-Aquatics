// ================================================================
// 📦 ADMIN DASHBOARD — ORDERS, APPOINTMENTS, LOGOUT, NAV
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📦 Admin Order Management Loaded");

  const API = "http://localhost:3000";
  const PAGE_SIZE = 10;

  const ordersBody = document.getElementById("ordersBody");
  const statSales = document.getElementById("statSales");
  const statOrders = document.getElementById("statOrders");
  const statPending = document.getElementById("statPending");
  const pager = document.getElementById("ordersPagination"); // <— add this in HTML

  const modal = document.getElementById("orderModal");
  const closeModal = modal.querySelector(".close");
  const mOrderId = document.getElementById("mOrderId");
  const mCustomer = document.getElementById("mCustomer");
  const mPayment = document.getElementById("mPayment");
  const mTotal = document.getElementById("mTotal");
  const mStatus = document.getElementById("mStatus");
  const btnPaid = document.getElementById("modalPaid");
  const btnDone = document.getElementById("modalDone");

/* ==== GLOBAL toast helpers (usable everywhere) ==== */
(function () {
  const show = (type, title, message = '', position = 'top') =>
    window.Toast?.showToast?.({ title, message, type, position });

  window.tOK   = window.tOK   || ((title, message = '', position = 'top') => show('success', title, message, position));
  window.tInfo = window.tInfo || ((title, message = '', position = 'top') => show('info',    title, message, position));
  window.tErr  = window.tErr  || ((title, message = '', position = 'top') => show('error',   title, message, position));
  window.tAsk  = window.tAsk  || ((title, message = '', ok = 'OK', cancel = 'Cancel') =>
    window.Toast?.confirmToast
      ? window.Toast.confirmToast({ title, message, okText: ok, cancelText: cancel })
      : Promise.resolve(confirm(`${title}\n\n${message}`))
  );
})();



  // client state
  let orders = [];
  let currentPage = 1;
  let currentPaymentFilter = ""; // "", "COD", "wallet"
  let currentStatusFilter = "";  // optional future use

  



/* ================================================================
   🌐 GLOBAL HELPERS (one set only)
   ================================================================ */
window.API = 'http://localhost:3000';

/** Build a simple pager into containerEl */
window.buildPager = function buildPager(containerEl, totalPages, currentPage, onGo) {
  if (!containerEl) return;
  if (!totalPages || totalPages <= 1) {
    containerEl.innerHTML = "";
    return;
  }
  containerEl.innerHTML = "";

  const mk = (label, target, disabled=false, active=false) => {
    const b = document.createElement("button");
    b.className = `pg-btn${active ? " active" : ""}`;
    b.textContent = label;
    b.disabled = disabled;
    if (!disabled) b.addEventListener("click", () => onGo(target));
    return b;
  };

  containerEl.appendChild(mk("‹", Math.max(1, currentPage - 1), currentPage === 1));
  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize/2));
  let end   = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  for (let p = start; p <= end; p++) {
    containerEl.appendChild(mk(String(p), p, false, p === currentPage));
  }
  containerEl.appendChild(mk("›", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
};

/** JSON fetch with readable console logs + error surfacing */
window.fetchJSON = async function fetchJSON(url, options = {}) {
  console.log("🌐 fetchJSON →", url, options);
  const res = await fetch(url, options);
  const raw = await res.text();
  console.log("📥 fetchJSON status:", res.status, res.ok ? "OK" : "ERR", "→ raw:", raw);

  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; }
  catch (e) { throw new Error(`Non-JSON response (HTTP ${res.status})`); }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data;
};



  // =======================================================
  // 🟩 Fetch Orders (paged)
  // =======================================================
  async function fetchOrders(page = 1) {
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (currentPaymentFilter) params.set("payment", currentPaymentFilter);
      if (currentStatusFilter)  params.set("status", currentStatusFilter);

      const res = await fetch(`${API}/api/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      orders = data.orders || [];
      currentPage = data.page || 1;
      renderOrders(orders);
      renderPagination(data.totalPages || 1, currentPage);
      updateStats(orders); // note: stats reflect current page/filter

      console.log(`✅ Page ${currentPage}: ${orders.length} orders of ${PAGE_SIZE}`);
    } catch (err) {
console.error("❌ Error loading orders:", err);
ordersBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Failed to load orders</td></tr>`;
if (pager) pager.innerHTML = "";
tErr('Orders', 'Failed to load orders.');

    }
  }

  // =======================================================
  // 🟩 Render Orders
  // =======================================================
  function renderOrders(orderList) {
    ordersBody.innerHTML = "";

    if (!orderList.length) {
      ordersBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted py-3">No orders found 💤</td></tr>`;
      return;
    }

    orderList.forEach((order) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.orderId}</td>
        <td>${order.name || "Unknown"}</td>
        <td>${order.paymentMethod || "N/A"}</td>
        <td>₱${(order.totalAmount || 0).toFixed(2)}</td>
        <td><span class="status ${String(order.status || "").toLowerCase()}">${order.status || ""}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-btn" data-id="${order._id}">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      `;
      ordersBody.appendChild(row);
    });

    // attach view button events
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.id));
    });
  }

  // =======================================================
  // 🟩 Pagination UI
  // =======================================================
  function renderPagination(totalPages, page) {
    if (!pager) return;
    if (totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }

    const makeBtn = (label, targetPage, disabled = false, active = false) => {
      const b = document.createElement("button");
      b.className = `pg-btn${active ? " active" : ""}`;
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener("click", () => {
        if (!disabled && targetPage !== currentPage) fetchOrders(targetPage);
      });
      return b;
    };

    pager.innerHTML = "";

    // Prev
    pager.appendChild(makeBtn("‹", Math.max(1, page - 1), page === 1));

    // Numbers (simple window)
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    for (let p = start; p <= end; p++) {
      pager.appendChild(makeBtn(String(p), p, false, p === page));
    }

    // Next
    pager.appendChild(makeBtn("›", Math.min(totalPages, page + 1), page === totalPages));
  }

  // =======================================================
  // 🟩 Stats for current page view
  // =======================================================
  function updateStats(orderList) {
    const totalSales = orderList.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingCount = orderList.filter((o) => o.status === "Pending").length;

    statSales.textContent = `₱${totalSales.toFixed(2)}`;
    statOrders.textContent = orderList.length;
    statPending.textContent = pendingCount;
  }

  // =======================================================
  // 🟩 Modal Functions (Orders) — unchanged logic
  // =======================================================
  function openModal(orderId) {
  const order = orders.find((o) => o._id === orderId);
  if (!order) return;

  mOrderId.textContent = order.orderId;
  mCustomer.textContent = order.name;
  mPayment.textContent = order.paymentMethod || "N/A";
  mTotal.textContent = `₱${Number(order.totalAmount || 0).toFixed(2)}`;

  // 👉 Show status as plain word only (no badge styling)
  mStatus.textContent = order.status || "";
  mStatus.className = ""; // strip any badge classes just in case

  const elFulfillment = document.getElementById("mFulfillment");
  const elCod         = document.getElementById("mCod");
  const elAmt         = document.getElementById("mAmt");
  const elReceipt     = document.getElementById("mReceipt");

  if (elFulfillment) elFulfillment.textContent = order.fulfillment || "—";
  if (elCod)         elCod.textContent         = order.codLandmark || "—";
  if (elAmt) {
    const amt = order?.paymentMeta?.amountSent;
    elAmt.textContent = (typeof amt === "number")
      ? `₱${Number(amt).toFixed(2)}`
      : "—";
  }
  if (elReceipt) {
    const url = order?.paymentMeta?.receiptUrl;
    elReceipt.innerHTML = url
      ? `<a href="${url}" target="_blank" rel="noopener">View receipt</a>`
      : "—";
  }

  const ul = document.getElementById("mItemsList");
  if (ul) {
    ul.innerHTML = "";
    (order.cart || []).forEach(it => {
      const li = document.createElement("li");
      const price = Number(it.price) || 0;
      const qty   = Number(it.quantity) || 1;
      li.textContent = `${it.title} — ₱${price.toFixed(2)} × ${qty}`;
      ul.appendChild(li);
    });
  }

  // ✅ Center + show (clear any inline display first)
  modal.style.removeProperty('display');
  modal.classList.add("show");

  btnPaid.onclick = () => updateOrderStatus(order._id, "Paid");
  btnDone.onclick = () => updateOrderStatus(order._id, "Completed");
}

// Close (never set inline display; just remove the class)
const hideOrderModal = () => {
  modal.classList.remove("show");
  modal.style.removeProperty('display'); // ensure no leftover inline styles
};

closeModal.onclick = hideOrderModal;
window.addEventListener("click", (e) => { if (e.target === modal) hideOrderModal(); });


  async function updateOrderStatus(orderId, newStatus) {
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} – ${text.slice(0, 200)}`);

      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Server did not return JSON."); }
      if (!data.success) throw new Error(data.message || "Update failed");

tOK(`Order ${newStatus}`, `Order status updated successfully.`);
modal.classList.remove("show");
fetchOrders(currentPage);
    } catch (err) {
console.error("❌ Failed to update order:", err);
tErr('Could not update order', brief(err.message));

    }
  }

  // =======================================================
  // 🟩 Filter Tabs (server-side filter) — reset to page 1
  // =======================================================
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const filter = tab.dataset.filter; // "all" | "wallet" | "cod"
      if (filter === "all")    currentPaymentFilter = "";
      if (filter === "cod")    currentPaymentFilter = "COD";
      if (filter === "wallet") currentPaymentFilter = "wallet";

      fetchOrders(1); // reset to first page on filter change
    });
  });

  // =======================================================
  // 🚀 Load Orders Initially
  // =======================================================
  fetchOrders(1);
});

// ================================================================
// 🧩 ADMIN DROPDOWN + LOGOUT HANDLER (match profile.js UX)
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn   = document.getElementById("adminMenuBtn");
  const menu      = document.getElementById("adminMenu");
  const logoutBtn = document.getElementById("adminLogoutBtn");

  // Keep the same dropdown behavior
  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (menu && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.style.display = "none";
    }
  });

  // Small notify helper (same feel as profile.js)
  const notify = ({
    title = "Notice",
    message = "",
    type = "info",
    duration = 2200,
    position = "top"
  } = {}) => {
    if (window.Toast?.showToast) {
      window.Toast.showToast({ title, message, type, duration, position });
    } else {
      alert(`${title}\n${message}`);
    }
  };

  // 🔐 Logout (same UX as profile.js)
  logoutBtn?.addEventListener("click", async () => {
    let confirmLogout;

    if (window.Toast?.confirmToast) {
      confirmLogout = await window.Toast.confirmToast({
        title: "Log out?",
        message: "Are you sure you want to log out?",
        okText: "Log out",
        cancelText: "Stay signed in",
        type: "error"
      });
    } else {
      confirmLogout = confirm("Are you sure you want to log out?");
    }

    if (!confirmLogout) return;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    sessionStorage.clear();

    notify({
      title: "Logged out",
      message: "See you next time 👋",
      type: "info",
      duration: 2200,
      position: "br"
    });

    window.location.href = "../index.html";
  });
});


// ================================================================
// 🧩 ADMIN NAVIGATION HANDLER (Sections)
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
const sectionMap = {
  orders: "admin-orders",
  appointments: "section-appointments",
  inventory: "section-inventory",
  "id-verify": "section-id-verify",  // <-- add this
  logs: "section-logs",
};


  const btns = Array.from(document.querySelectorAll(".section-btn"));
  const panels = Array.from(document.querySelectorAll(".admin-section"));

  const show = (key) => {
    btns.forEach((b) => b.classList.toggle("active", b.dataset.section === key));

    const targetId = sectionMap[key] || sectionMap.orders;
    panels.forEach((p) => {
      p.style.display = p.id === targetId ? "block" : "none";
      p.classList.toggle("active", p.id === targetId);
    });

    // ✅ Refresh Inventory when shown
    if (key === "inventory") {
      try { loadProductsIntoTable(); } catch (e) { console.warn('Inventory refresh error:', e); }
    }

    // ✅ Optional: refresh Appointments when shown
    if (key === "appointments") {
      try {
        typeof window._fetchAppointments === 'function' && window._fetchAppointments();
      } catch (e) { console.warn('Appointments refresh error:', e); }
    }

    history.replaceState(null, "", `#${key}`);
    try { localStorage.setItem("admin_last_section", key); } catch (e) {}
  };

  btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.section)));

  const fromHash = (location.hash || "").replace("#", "");
  const fromStore = (() => {
    try { return localStorage.getItem("admin_last_section"); } catch (e) { return null; }
  })();
  const startKey = sectionMap[fromHash] ? fromHash : sectionMap[fromStore] ? fromStore : "orders";
  show(startKey);

  // ✅ If we landed on Inventory initially, load it immediately (startKey is in scope here)
  if (startKey === 'inventory') {
    try { loadProductsIntoTable(); } catch (e) { console.warn('Initial inventory load failed:', e); }
  }
});



// ================================================================
// 📅 ADMIN — FETCH & MANAGE APPOINTMENTS (Guests/Notes hidden in table)
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  const apptBody = document.getElementById("appointmentsBody");
  const apptModal = document.getElementById("apptModal");
  const apptClose = document.getElementById("apptClose");

  // modal fields
  const aName = document.getElementById("aName");
  const aEmail = document.getElementById("aEmail");
  const aService = document.getElementById("aService"); // NEW
  const aGuests = document.getElementById("aGuests");
  const aNotes = document.getElementById("aNotes");
  const aDate = document.getElementById("aDate");
  const aTime = document.getElementById("aTime");
  const aStatus = document.getElementById("aStatus");


  // buttons
  const btnConfirm = document.getElementById("btnConfirmAppt");
  const btnResched = document.getElementById("btnRescheduleAppt");
  const btnCancel = document.getElementById("btnCancelAppt");

  // reschedule
  const reschedFields = document.getElementById("reschedFields");
  const newDate = document.getElementById("newDate");
  const newTime = document.getElementById("newTime");
  const saveResched = document.getElementById("saveResched");
  const cancelResched = document.getElementById("cancelResched");

  let appointments = [];
  let currentAppt = null;

  // =======================================================
  // 🔁 Fetch All Appointments
  // =======================================================
const APPT_PAGE_SIZE = 10;
let apptPage = 1;

async function fetchAppointments(page = 1) {
  try {
    const params = new URLSearchParams({ limit: String(APPT_PAGE_SIZE), page: String(page) });
    const url = `${API}/api/bookings?${params.toString()}`;
    const data = await fetchJSON(url);

    if (!data.success) throw new Error(data.message || "Failed to load appointments");

    appointments = data.bookings || [];
    apptPage = data.page || 1;

    renderAppointments(appointments);

    const apptPager = document.getElementById("appointmentsPagination");
    buildPager(apptPager, data.totalPages || 1, apptPage, (go) => fetchAppointments(go));

    console.log(`✅ Appointments page ${apptPage}: ${appointments.length}`);
  } catch (err) {
    console.error("❌ Error loading appointments:", err);
    apptBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Failed to load appointments<br>${err.message}</td></tr>`;
    const apptPager = document.getElementById("appointmentsPagination");
    if (apptPager) apptPager.innerHTML = "";
  }
}
window._fetchAppointments = fetchAppointments;



  // =======================================================
  // 🧾 Render Appointments Table (Guests/Notes hidden)
  // =======================================================
  function renderAppointments(list) {
    apptBody.innerHTML = "";

    if (!list.length) {
      apptBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted py-3">No appointments found 💤</td></tr>`;
      return;
    }

    list.forEach((b) => {
      const tr = document.createElement("tr");
      tr.dataset.id = b._id;
      tr.dataset.status = b.status || "Pending";

      tr.innerHTML = `
  <td>${b.name}</td>
  <td>${b.email}</td>
  <td>${b.service || "General Consultation"}</td>
  <td>${b.date}</td>
  <td>${b.time}</td>
  <td class="status">${b.status || "Pending"}</td>
  <td>
    <button class="editAppt btn btn-sm btn-outline-primary" data-id="${b._id}">Edit</button>
  </td>
`;

      apptBody.appendChild(tr);
    });

    document.querySelectorAll(".editAppt").forEach((btn) => {
      btn.addEventListener("click", () => openApptModal(btn.dataset.id));
    });
  }

  // =======================================================
  // 🪟 Open Appointment Modal (Guests + Notes shown)
  // =======================================================
  function openApptModal(id) {
    const appt = appointments.find((a) => a._id === id);
    if (!appt) return;

    currentAppt = appt;

aName.textContent = appt.name;
aEmail.textContent = appt.email;
aService.textContent = appt.service || "General Consultation"; // NEW
aGuests.textContent = appt.guests && appt.guests.length
  ? (Array.isArray(appt.guests) ? appt.guests.join(", ") : appt.guests)
  : "—";
aNotes.textContent = appt.notes || "—";
aDate.textContent = appt.date;
aTime.textContent = appt.time;
aStatus.textContent = appt.status || "Pending";


    reschedFields.hidden = true;
    newDate.value = "";
    newTime.value = "";

    apptModal.style.display = "block";
  }

  // =======================================================
  // 🔒 Close Modal
  // =======================================================
  const closeApptModal = () => {
    apptModal.style.display = "none";
    currentAppt = null;
  };
  apptClose.addEventListener("click", closeApptModal);
  window.addEventListener("click", (e) => {
    if (e.target === apptModal) closeApptModal();
  });

// =======================================================
// ✅ Update Appointment Status
// =======================================================
// ✅ Update Appointment Status (hits /status and guards non-JSON errors)
async function updateAppointmentStatus(status) {
  if (!currentAppt) return;
  try {
    const res = await fetch(
      `http://localhost:3000/api/bookings/${currentAppt._id}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );

    const text = await res.text();                      // handle HTML error pages
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${text.slice(0,200)}`);

    let data;
    try { data = JSON.parse(text); }                    // server should return JSON
    catch { throw new Error("Server did not return JSON."); }

    if (!data.success) throw new Error(data.message || "Update failed");

tOK(`Appointment ${status}`, 'Status updated successfully.');
closeApptModal();
fetchAppointments();
  } catch (err) {
console.error("❌ Failed to update appointment:", err);
tErr('Appointments', 'Could not update status.');

  }
}



// =======================================================
// 🔁 Reschedule Appointment
// =======================================================
// 🔁 Reschedule Appointment
async function rescheduleAppointment(newD, newT) {
  if (!currentAppt) return;
  try {
    const res = await fetch(
      `http://localhost:3000/api/bookings/${currentAppt._id}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate: newD, newTime: newT })   // ✅ correct payload
      }
    );

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${text.slice(0,200)}`);

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Server did not return JSON."); }

    if (!data.success) throw new Error(data.message || "Reschedule failed");

tOK('Appointment rescheduled', 'New date/time saved.');
closeApptModal();
fetchAppointments();

  } catch (err) {
console.error("❌ Failed to reschedule:", err);
tErr('Appointments', 'Could not reschedule.');

  }
}




  // =======================================================
  // 🎛️ Button Actions
  // =======================================================
  btnConfirm.addEventListener("click", () => updateAppointmentStatus("Confirmed"));
  btnCancel.addEventListener("click", () => updateAppointmentStatus("Cancelled"));
  btnResched.addEventListener("click", () => {
    reschedFields.hidden = false;
  });
  saveResched.addEventListener("click", () => {
    const nd = newDate.value;
    const nt = newTime.value;
    if (!nd || !nt) return alert("⚠️ Please select a new date & time");
    rescheduleAppointment(nd, nt);
  });
  cancelResched.addEventListener("click", () => (reschedFields.hidden = true));

  // =======================================================
  // 🚀 Load Appointments
  // =======================================================
  fetchAppointments();
});



document.addEventListener('DOMContentLoaded', () => {
  const invTable   = document.getElementById('inventoryTable');
  const invBody    = document.getElementById('inventoryBody');

  // modal refs
  const addModal   = document.getElementById('addProductModal');
  const addForm    = document.getElementById('addProductForm');
  const addClose   = document.getElementById('addProdClose');
  const addCancel  = document.getElementById('cancelAddProduct');

  // fields
  const titleEl    = document.getElementById('addEditTitle');
  const pId        = document.getElementById('pId');
  const pName      = document.getElementById('pName');
  const pImage     = document.getElementById('pImage');
  const pPrice     = document.getElementById('pPrice');
  const pStock     = document.getElementById('pStock');
  const pCategory  = document.getElementById('pCategory');
  const pDesc      = document.getElementById('pDesc');
  const btnDelete  = document.getElementById('deleteProduct');

  let mode = 'add';
  let editRow = null;

  const openModal  = () => addModal.classList.add('show');
  const closeModal = () => { addModal.classList.remove('show'); editRow = null; };

  function setAddMode() {
    mode = 'add';
    if (titleEl) titleEl.textContent = 'Add Product';
    btnDelete.style.display = 'none';
    pId.value = '';
    addForm.reset();
  }
  function setEditMode(row) {
    mode = 'edit';
    if (titleEl) titleEl.textContent = 'Edit Product';
    btnDelete.style.display = 'inline-block';
    editRow = row;

    const name = row.children[0].textContent.trim();
    const priceText = row.children[1].textContent.replace(/[₱,\s]/g, '').trim();
    const category = row.children[2].textContent.trim();
    const stock = row.children[3].textContent.trim();

    pId.value = row.dataset.id || '';
    pName.value = name;
    pPrice.value = priceText || 0;
    pCategory.value = category;
    pStock.value = parseInt(stock || '0', 10);
    pDesc.value = row.dataset.desc || '';
    pImage.value = ''; // leave empty unless re-uploading
  }

  // ✅ DELEGATED CLICKS — WORKS EVEN IF BUTTONS ARE RE-RENDERED OR HIDDEN INITIALLY
  document.addEventListener('click', (e) => {
    // Add Product button
    if (e.target.closest('#btnAddProduct')) {
      setAddMode();
      openModal();
    }
    // Edit button in table
    if (e.target.closest('.invEdit')) {
      const row = e.target.closest('tr');
      if (!row) return;
      setEditMode(row);
      openModal();
    }
    // Close modal X
    if (e.target.closest('#addProdClose')) closeModal();
    // Cancel button
    if (e.target.closest('#cancelAddProduct')) closeModal();
    // Click outside modal content
    if (e.target === addModal) closeModal();
  });


// Save (Add or Edit)
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name  = pName.value.trim();
  const price = parseFloat(pPrice.value || '0');
  const cat   = pCategory.value.trim();
  const stock = parseInt(pStock.value || '0', 10);
  const desc  = pDesc.value.trim();

  if (!name || isNaN(price)) {
    alert('Please complete the required fields.');
    return;
  }

  try {
    const fd = new FormData();
    fd.append('title', name);
    fd.append('price', String(price));
    fd.append('stock', String(stock));
    fd.append('category', cat);
    fd.append('description', desc);
    if (pImage.files && pImage.files[0]) fd.append('image', pImage.files[0]);

    if (mode === 'add') {
      await apiCreateProductFD(fd);                    // 🔵 CREATE (logs PRODUCT_CREATED)
    } else {
      const id = pId.value || editRow?.dataset.id;
      if (!id) throw new Error('Missing product id for update');
      await apiUpdateProductFD(id, fd);                // 🟢 UPDATE (already logs PRODUCT_UPDATED)
    }

await loadProductsIntoTable();
tOK(mode === 'add' ? 'Product added' : 'Product updated',
    mode === 'add' ? 'Item was added to inventory.' : 'Changes saved.');
closeModal();
addForm.reset();
return;

  } catch (apiErr) {
console.warn('⚠️ API save failed; falling back to local row:', apiErr);
tErr('Save failed', 'Using local fallback row (not persisted).');

  }

  // Fallback only if API failed (keeps UX responsive)
  if (mode === 'add') {
    const tr = document.createElement('tr');
    tr.dataset.status = stock === 0 ? 'OOS' : (stock <= 5 ? 'LOW' : 'OK');
    tr.dataset.desc = desc;
    tr.innerHTML = `
      <td>${name}</td>
      <td>₱${price.toFixed(2)}</td>
      <td>${cat}</td>
      <td class="stock">${stock}</td>
      <td><button class="invEdit">Edit</button></td>
    `;
invBody.prepend(tr);
tInfo('Local preview only', 'Row added locally. Sync later.');

  } else if (editRow) {
    editRow.children[0].textContent = name;
    editRow.children[1].textContent = `₱${price.toFixed(2)}`;
    editRow.children[2].textContent = cat;
    editRow.querySelector('.stock').textContent = stock;
    editRow.dataset.desc = desc;
    editRow.dataset.status = stock === 0 ? 'OOS' : (stock <= 5 ? 'LOW' : 'OK');
  }

  closeModal();
  addForm.reset();
});



  // Delete (with confirm)
  btnDelete.addEventListener('click', () => {
    if (!editRow) return;
    const name = editRow.children[0].textContent.trim();
tAsk('Delete product?', `Remove "${name}" permanently?`, 'Delete', 'Cancel').then((ok) => {
  if (!ok) return;
  // TODO: call backend DELETE here when wired; for now remove locally:
  editRow.remove();
  tOK('Product deleted', `"${name}" removed from table.`);
  closeModal();
});

  });

  // 🔄 REMOVED: initial DB fetch on page load (you asked not to include DB items yet)
  // try { refreshInventoryFromServer && refreshInventoryFromServer(); } catch (e) {}
});

// === Inventory API helpers (ADD + LIST) ===
const API_BASE = 'http://localhost:3000';

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiCreateProductFD(formData) {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: { ...authHeader() }, // 👈 add token so logs can attribute the admin
    body: formData
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || 'Save failed');
  return json.product; // created product document
}

async function apiUpdateProductFD(id, formData) {
  const res = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'PUT',
    headers: { ...authHeader() }, // 👈 token for logging
    body: formData                // keep multipart for optional image change
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || 'Update failed');
  return json.product;
}


// These helpers are kept for later use but NOT called right now.
async function apiListProducts() {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

function renderInvFromServer(products) {
  const invBody = document.getElementById('inventoryBody');
  if (!invBody) return;
  if (!products.length) {
    invBody.innerHTML = `<tr><td colspan="5" class="text-muted">No products yet</td></tr>`;
    return;
  }
  invBody.innerHTML = products.map(p => `
    <tr data-id="${p._id}" data-desc="${(p.description||'').replace(/"/g,'&quot;')}"
        data-status="${(p.stock||0)===0 ? 'OOS' : ((p.stock||0)<=5 ? 'LOW' : 'OK')}">
      <td>${p.title ?? '-'}</td>               <!-- ✅ correct key -->
      <td>₱${Number(p.price||0).toFixed(2)}</td>
      <td>${p.category ?? '-'}</td>
      <td class="stock">${p.stock ?? 0}</td>
      <td><button class="invEdit">Edit</button></td>
    </tr>
  `).join('');
}


async function refreshInventoryFromServer() {
  try {
    const list = await apiListProducts();
    renderInvFromServer(list);
  } catch (e) {
    console.error('Inventory load error:', e);
  }
}
// ========= Admin Logs (client) =========
(function () {
  const tbody = document.getElementById('logsBody');
  const modal = document.getElementById('logModal');
  const mClose = document.getElementById('logClose');
  const mTitle = document.getElementById('logTitle');
  const mMeta  = document.getElementById('logMeta');
  const mMsg   = document.getElementById('logMessage');

  if (!tbody) return;

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return { date: '—', time: '—' };
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };
  const esc = (s = '') => s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const LOGS_PAGE_SIZE = 10;
let logsPage = 1;

async function fetchLogs(page = 1) {
  try {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Loading…</td></tr>`;
    const params = new URLSearchParams({ limit: String(LOGS_PAGE_SIZE), page: String(page) });
    const res = await fetch(`${API}/api/admin-logs?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed');

    render(data.logs || []);

    const pager = document.getElementById('logsPagination'); // 👈 add in HTML
    logsPage = data.page || 1;
    buildPager(pager, data.totalPages || 1, logsPage, (go) => fetchLogs(go));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Failed to load logs</td></tr>`;
    console.error(e);
    const pager = document.getElementById('logsPagination');
    if (pager) pager.innerHTML = "";
  }
}


  function render(list) {
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted">No logs yet</td></tr>`;
      return;
    }
    tbody.innerHTML = '';
    list.forEach((log) => {
      const { date, time } = fmt(log.createdAt);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${date}</td>
        <td>${time}</td>
        <td class="log-snippet" title="${esc(log.message)}">${esc(log.message)}</td>
        <td style="text-align:right">
          <button class="viewLog invEdit" data-id="${log._id}">Edit</button>
        </td>
      `;
      tr.querySelector('.viewLog').addEventListener('click', () => openModal(log));
      tbody.appendChild(tr);
    });
  }

  function openModal(log) {
    const { date, time } = fmt(log.createdAt);
    mTitle.textContent = log.action.replaceAll('_', ' ');
    const who = [log.admin?.name, log.admin?.email].filter(Boolean).join(' • ');
    const tgt = [log.target?.type, log.target?.id, log.target?.name].filter(Boolean).join(' • ');
    mMeta.textContent = `${date} • ${time}${who ? ' • ' + who : ''}${tgt ? ' • ' + tgt : ''}`;

    mMsg.textContent = log.message + (log.meta ? `\n\nDetails:\n${JSON.stringify(log.meta, null, 2)}` : '');

    // ✅ center via flex
    modal.style.removeProperty('display');
    modal.classList.add('show');
    document.body.classList.add('modal-open'); // optional (prevents page scroll)
  }

  function closeModal() {
    modal.classList.remove('show');
    modal.style.removeProperty('display'); // clean up any inline
    document.body.classList.remove('modal-open');
  }

  mClose.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });


  // Load when switching to Logs tab
  document.querySelectorAll('.section-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.section === 'logs') fetchLogs();
    });
  });

  // If already on #logs
  const hash = (location.hash || '').slice(1);
  const last = (() => { try { return localStorage.getItem('admin_last_section'); } catch { return null; } })();
  if (hash === 'logs' || last === 'logs') fetchLogs();
})();

const PROD_PAGE_SIZE = 10;
let prodPage = 1;

async function loadProductsIntoTable(page = 1) {
  const tbody = document.getElementById('inventoryBody');
  const pager = document.getElementById('inventoryPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Loading...</td></tr>`;

  try {
    const params = new URLSearchParams({ limit: String(PROD_PAGE_SIZE), page: String(page) });
    const url = `${API}/api/products?${params.toString()}`;
    const data = await fetchJSON(url);

    const products = Array.isArray(data.products) ? data.products
                     : (Array.isArray(data) ? data : []);
    const totalPages = data.totalPages || 1;
    prodPage = data.page || 1;

    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No products yet</td></tr>`;
      if (pager) pager.innerHTML = "";
      return;
    }

    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.id = p._id;
      tr.dataset.desc = p.description || '';
      tr.innerHTML = `
        <td>${p.title ?? '-'}</td>
        <td>₱${Number(p.price || 0).toFixed(2)}</td>
        <td>${p.category || ''}</td>
        <td class="stock">${Number(p.stock || 0)}</td>
        <td><button class="invEdit">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });

    buildPager(pager, totalPages, prodPage, (go) => loadProductsIntoTable(go));
  } catch (err) {
console.error('❌ loadProducts error:', err);
tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Failed to load products<br>${err.message}</td></tr>`;
if (pager) pager.innerHTML = "";
tErr('Inventory', 'Failed to load products.');

  }
}


// call this when the Inventory tab is activated
// and optionally at page init if Inventory is active by default







// /js/admin-calendar.js
document.addEventListener('DOMContentLoaded', () => {
  const calEl = document.getElementById('adminCalendar');
  if (!calEl) return;

  // --------- Simple persistence (swap with your API later) ---------
  const STORAGE_KEY = 'admin_unavailable_events_v1';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  };
  const save = (events) => localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  const snapshot = () => calendar.getEvents().map(e => ({
    id: e.id,
    title: e.title,
    start: e.startStr,
    end: e.endStr,
    allDay: e.allDay,
    note: e.extendedProps?.note || ''
  }));

  // --------- Modal controls ---------
  const dlg = document.getElementById('availabilityModal');
  const blockAllDay = document.getElementById('blockAllDay');
  const selectedDate = document.getElementById('selectedDate');
  const eventId = document.getElementById('eventId');
  const availStart = document.getElementById('availStart');
  const availEnd = document.getElementById('availEnd');
  const availNote = document.getElementById('availNote');
  const timeRow = document.querySelector('[data-time-range]');
  const btnSave = document.getElementById('saveBlock');
  const btnDelete = document.getElementById('deleteBlock');
  
  const toggleTimeRow = () => {
    timeRow.style.display = blockAllDay.checked ? 'none' : '';
  };
  blockAllDay.addEventListener('change', toggleTimeRow);

  // Helpers
  const toISODate = (d) => d.toISOString().slice(0,10); // YYYY-MM-DD
  const addDays = (dateStr, n) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISODate(d);
  };
// Local YYYY-MM-DD (no UTC conversion)
const toLocalYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Add days to a YYYY-MM-DD string in local time
const addDaysYMD = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n); // local
  return toLocalYMD(dt);
};

  let currentSelection = null; // FullCalendar selection for new blocks
  let editingEvent = null;     // FullCalendar EventApi for edit/delete

  const calendar = new FullCalendar.Calendar(calEl, {
  timeZone: 'local',
  initialView: 'dayGridMonth',
  headerToolbar: false,          // we use external Prev/Today/Next buttons
  firstDay: 0,                   // Sunday
  height: 'auto',
  fixedWeekCount: false,
  selectable: true,
  selectMirror: true,
  editable: true,                // allow drag/resize

  // Make timed events render as pills and use your red
  eventDisplay: 'block',
  eventColor: '#ef4444',         // pill background
  eventTextColor: '#ffffff',     // pill text

  // Show both an all-day block and a timed block on the same date
  dayMaxEventRows: 2,
  // Prefer showing timed blocks before all-day when both exist
  eventOrder: '-allDay,start,title',

  // Hide FC’s automatic leading time (“8a …”) — we’ll render our own label
  displayEventTime: false,

  // Render chip text:
  // - for TIMED blocks → "8 am to 10 am"
  // - for ALL-DAY blocks → use the event title (e.g., "Not Available")
  eventContent(arg) {
    const e = arg.event;
    if (!e.allDay && e.start && e.end) {
      const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      const s = fmt.format(e.start).toLowerCase().replace(' ', '');
      const t = fmt.format(e.end).toLowerCase().replace(' ', '');
      const el = document.createElement('div');
      el.textContent = `${s} to ${t}`;
      return { domNodes: [el] };
    }
    // fallback: just show the title (for all-day)
    return { html: e.title || '' };
  },

  // Replace the overflow label
  moreLinkContent(arg) {
    const hidden = arg.hiddenSegs || [];
    if (hidden.length === 1) {
      const t = hidden[0]?.eventRange?.def?.title || arg.text;
      return { text: t };                 // shows the hidden event’s actual title
    }
    return { text: arg.text };            // keep default “+N more”
  },
  // Keep the link clickable (opens FullCalendar popover)
  moreLinkClick: 'popover',

  events: load(),    

    // Create NEW block (open modal)
    select: (info) => {
      currentSelection = info;
      editingEvent = null;

      // Default: in month view we block full day(s)
      blockAllDay.checked = (calendar.view.type === 'dayGridMonth') || info.allDay;
      toggleTimeRow();

      // Prefill date/time
      selectedDate.value = toLocalYMD(info.start);
      availStart.value = '08:00';
      availEnd.value   = '16:00';
      availNote.value  = '';
      eventId.value    = '';

      dlg.showModal();
    },

    // Edit existing block (open modal prefilled)
    eventClick: (clickInfo) => {
      currentSelection = null;
      editingEvent = clickInfo.event;

      blockAllDay.checked = editingEvent.allDay;
      toggleTimeRow();

      selectedDate.value = toLocalYMD(editingEvent.start);
      eventId.value = editingEvent.id || '';
      availNote.value = editingEvent.extendedProps?.note || '';

      if (!editingEvent.allDay) {
        const fmt = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        availStart.value = fmt(editingEvent.start);
        // if end missing, fall back to +1 hour
        const end = editingEvent.end || new Date(editingEvent.start.getTime() + 60*60*1000);
        availEnd.value = fmt(end);
      }

      dlg.showModal();
    },

    // Persist when dragging/resizing
    eventDrop: () => save(snapshot()),
    eventResize: () => save(snapshot())
  });

  calendar.render();

  // --------- External toolbar wiring ---------
  document.querySelector('[data-cal-prev]')?.addEventListener('click', () => calendar.prev());
  document.querySelector('[data-cal-next]')?.addEventListener('click', () => calendar.next());
  document.querySelector('[data-cal-today]')?.addEventListener('click', () => calendar.today());

  // Optional: dynamic title if you included [data-cal-title]
  const titleEl = document.querySelector('[data-cal-title]');
  const updateTitle = () => { if (titleEl) titleEl.textContent = calendar.view.title; };
  calendar.on('datesSet', updateTitle);
  updateTitle();

  // --------- Modal buttons ---------
btnSave?.addEventListener('click', () => {
  const dateStr = selectedDate.value;     // local YYYY-MM-DD
  const note = availNote.value.trim();

  if (blockAllDay.checked) {
    // ✅ ALL-DAY (use local helpers; end is exclusive)
    const startYMD = dateStr;
    const ev = {
      id: eventId.value || crypto.randomUUID(),
      title: 'Not Available',
      start: startYMD,                      // local date, no UTC shift
      end: addDaysYMD(startYMD, 1),         // next local day (exclusive)
      allDay: true,
      backgroundColor: '#ef4444',
      note
    };

    if (editingEvent) editingEvent.remove();
    calendar.addEvent(ev);
save(snapshot());
tOK('Block added', 'Marked as Not Available (all day).');
dlg.close();
calendar.unselect();
return;

  }

  // ⏱️ TIMED RANGE (still local because we build YYYY-MM-DDTHH:mm)
  const startT = availStart.value || '08:00';
  const endT   = availEnd.value   || '16:00';
  if (endT <= startT) {
    alert('End time must be after start time.');
    return;
  }

  const ev = {
    id: eventId.value || crypto.randomUUID(),
    title: 'Not Available',
    start: `${dateStr}T${startT}`,
    end:   `${dateStr}T${endT}`,
    allDay: false,
    backgroundColor: '#ef4444',
    note
  };

  if (editingEvent) editingEvent.remove();
  calendar.addEvent(ev);
save(snapshot());
tOK('Block added', 'Marked as Not Available (time range).');
dlg.close();
calendar.unselect();

});


  btnDelete?.addEventListener('click', () => {
if (!editingEvent) { dlg.close(); return; }
tAsk('Remove block?', 'Delete this Not Available block?', 'Remove', 'Cancel').then((ok) => {
  if (!ok) return;
  editingEvent.remove();
  save(snapshot());
  tOK('Block removed', 'Availability restored.');
  dlg.close();
});
  });

  dlg?.addEventListener('close', () => {
    currentSelection = null;
    editingEvent = null;
  });
});
