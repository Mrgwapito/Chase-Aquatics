/* ================================================================
   🌐 GLOBAL HELPERS (define these FIRST, before any DOMContentLoaded)
   ================================================================ */
// ✅ Unified backend base URL (local dev vs deployed)
window.__API_BASE__ =
  window.__API_BASE__ ||
  ((window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost")
    ? "http://127.0.0.1:3000"                 // local dev API
    : "https://chase-aquatics.onrender.com"); // deployed API (Render)

window.API = window.__API_BASE__;


/* ==== GLOBAL toast helpers ==== */
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

/* ==== GLOBAL auth helper ==== */
window.authHeader = window.authHeader || function () {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* Shorten error strings */
window.brief = window.brief || function (s = '') {
  const t = String(s || '');
  return t.length > 160 ? t.slice(0, 157) + '…' : t;
};

/** Build pager */
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

/** JSON fetch helper */
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

// ================================================================
// 📦 ADMIN DASHBOARD — ORDERS, APPOINTMENTS, LOGOUT, NAV
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📦 Admin Order Management Loaded");

  const API = window.API; // Use the global API
  const PAGE_SIZE = 10;

  const ordersBody = document.getElementById("ordersBody");
  const statSales = document.getElementById("statSales");
  const statOrders = document.getElementById("statOrders");
  const statPending = document.getElementById("statPending");
  const pager = document.getElementById("ordersPagination");

  const modal = document.getElementById("orderModal");
  const closeModal = modal.querySelector(".close");
  const mOrderId = document.getElementById("mOrderId");
  const mCustomer = document.getElementById("mCustomer");
  const mPayment = document.getElementById("mPayment");
  const mTotal = document.getElementById("mTotal");
  const mStatus = document.getElementById("mStatus");
  const btnPaid = document.getElementById("modalPaid");
  const btnDone = document.getElementById("modalDone");

  // Remove the duplicate global helpers that were here

  // client state
  let orders = [];
  let currentPage = 1;
  let currentPaymentFilter = ""; // "", "COD", "wallet"
  let currentStatusFilter = "";  // optional future use

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
    "id-verify": "section-id-verify",
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
  const API = window.API; // Use global API
  const apptBody = document.getElementById("appointmentsBody");
  const apptModal = document.getElementById("apptModal");
  const apptClose = document.getElementById("apptClose");

  // modal fields
  const aName = document.getElementById("aName");
  const aEmail = document.getElementById("aEmail");
  const aService = document.getElementById("aService");
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
    aService.textContent = appt.service || "General Consultation";
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
  async function updateAppointmentStatus(status) {
    if (!currentAppt) return;
    try {
      const res = await fetch(
        `${API}/api/bookings/${currentAppt._id}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} – ${text.slice(0,200)}`);

      let data;
      try { data = JSON.parse(text); }
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
  async function rescheduleAppointment(newD, newT) {
    if (!currentAppt) return;
    try {
      const res = await fetch(
        `${API}/api/bookings/${currentAppt._id}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newDate: newD, newTime: newT })
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

// ================================================================
// 📦 INVENTORY MANAGEMENT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  const API = window.API; // Use global API
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
        await apiCreateProductFD(fd);
      } else {
        const id = pId.value || editRow?.dataset.id;
        if (!id) throw new Error('Missing product id for update');
        await apiUpdateProductFD(id, fd);
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

  // === Inventory API helpers (ADD + LIST) ===
  async function apiCreateProductFD(formData) {
    const res = await fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { ...window.authHeader() }, // Use window.authHeader directly
      body: formData
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Save failed');
    return json.product;
  }

  async function apiUpdateProductFD(id, formData) {
    const res = await fetch(`${API}/api/products/${id}`, {
      method: 'PUT',
      headers: { ...window.authHeader() }, // Use window.authHeader directly
      body: formData
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Update failed');
    return json.product;
  }

  async function apiListProducts() {
    const res = await fetch(`${API}/api/products`);
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
        <td>${p.title ?? '-'}</td>
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
});

// ========= Admin Logs (client) =========
(function () {
  const API = window.API; // Use global API
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

      const pager = document.getElementById('logsPagination');
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
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    modal.classList.remove('show');
    modal.style.removeProperty('display');
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

// ================================================================
// 📦 PRODUCTS TABLE LOADING
// ================================================================
const PROD_PAGE_SIZE = 10;
let prodPage = 1;

async function loadProductsIntoTable(page = 1) {
  const API = window.API; // Use global API
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

// ================================================================
// 📅 ADMIN CALENDAR MANAGEMENT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  const API = window.API; // Use global API
  const calEl = document.getElementById('adminCalendar');
  if (!calEl) return;

  // ---------- Helpers ----------
  const toLocalYMD = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const addDaysYMD = (ymd, n) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return toLocalYMD(dt);
  };

  const to24h = (s) => {
    s = String(s || '').trim().toLowerCase();
    if (/^\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{1}:\d{2}$/.test(s)) {
      const [h, m] = s.split(':').map(Number);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(a|p)m$/i);
    if (m) {
      let h = parseInt(m[1],10), mm = m[2], ap = m[3];
      if (ap === 'p' && h !== 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${mm}`;
    }
    if (/^\d{1,2}$/.test(s)) return `${String(parseInt(s,10)).padStart(2,'0')}:00`;
    return s;
  };

  const hhmmPlus = (hhmm, minutes = 60) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(2000,0,1,h,m,0,0);
    d.setMinutes(d.getMinutes() + minutes);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // ---------- API ----------
  async function apiListBlocks(startYMD, endYMD) {
    const qs = new URLSearchParams();
    if (startYMD) qs.set('start', startYMD);
    if (endYMD)   qs.set('end',   endYMD);
    const res = await fetch(`${API}/api/blocks?` + qs.toString(), { 
      headers: { ...window.authHeader() } // Use window.authHeader directly
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Load failed');
    return json.blocks || [];
  }

  async function apiListBookings(startYMD, endYMD) {
    const qs = new URLSearchParams();
    if (startYMD) qs.set('start', startYMD);
    if (endYMD)   qs.set('end',   endYMD);
    const res = await fetch(`${API}/api/bookings?` + qs.toString(), { 
      headers: { ...window.authHeader() } // Use window.authHeader directly
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Load failed');
    return json.bookings || [];
  }

  // ---------- Modal refs ----------
  const dlg         = document.getElementById('availabilityModal');
  const blockAllDay = document.getElementById('blockAllDay');
  const selectedDate= document.getElementById('selectedDate');
  const eventId     = document.getElementById('eventId');
  const availStart  = document.getElementById('availStart');
  const availEnd    = document.getElementById('availEnd');
  const availNote   = document.getElementById('availNote');
  const timeRow     = document.querySelector('[data-time-range]');
  const btnSave     = document.getElementById('saveBlock');
  const btnDelete   = document.getElementById('deleteBlock');

  const toggleTimeRow = () => { timeRow.style.display = blockAllDay.checked ? 'none' : ''; };
  blockAllDay.addEventListener('change', toggleTimeRow);

  let editingEvent = null;

  const calendar = new FullCalendar.Calendar(calEl, {
    timeZone: 'local',
    initialView: 'dayGridMonth',
    headerToolbar: false,
    firstDay: 0,
    height: 'auto',
    fixedWeekCount: false,
    selectable: true,
    selectMirror: true,
    editable: true,
    eventDisplay: 'block',
    displayEventTime: false,
    dayMaxEventRows: 2,
    eventOrder: '-allDay,start,title',

    dateClick(info) {
      editingEvent = null;
      eventId.value = '';
      selectedDate.value = toLocalYMD(info.date);
      blockAllDay.checked = true;
      toggleTimeRow();
      availStart.value = '08:00';
      availEnd.value   = '16:00';
      availNote.value  = '';
      dlg.showModal();
    },

    eventContent(arg) {
      const e = arg.event;
      const container = document.createElement('div');
      container.style.lineHeight = '1.1';

      if (!e.allDay && e.start && e.end) {
        const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        const s = fmt.format(e.start).toLowerCase().replace(' ', '');
        const t = fmt.format(e.end).toLowerCase().replace(' ', '');
        const timeLine = document.createElement('div');
        timeLine.textContent = `${s} – ${t}`;
        container.appendChild(timeLine);
      }

      const titleLine = document.createElement('div');
      titleLine.textContent = e.title || (e.extendedProps?.type === 'block' ? 'Not Available' : '');
      container.appendChild(titleLine);

      return { domNodes: [container] };
    },

    // Load BOTH: availability blocks + bookings
    async datesSet(info) {
      try {
        const startYMD = toLocalYMD(info.start);
        const endYMD   = toLocalYMD(info.end);

        const [blocks, bookings] = await Promise.all([
          apiListBlocks(startYMD, endYMD),
          apiListBookings(startYMD, endYMD)
        ]);

        calendar.removeAllEvents();

        // 1) Blocks (red)
        blocks.forEach(b => {
          if (b.allDay) {
            calendar.addEvent({
              id: b._id,
              title: 'Not Available',
              start: b.date,
              end: addDaysYMD(b.date, 1),
              allDay: true,
              color: '#ef4444',
              textColor: '#ffffff',
              extendedProps: { type: 'block', note: b.note }
            });
          } else {
            calendar.addEvent({
              id: b._id,
              title: 'Not Available',
              start: `${b.date}T${b.start}`,
              end:   `${b.date}T${b.end}`,
              allDay: false,
              color: '#ef4444',
              textColor: '#ffffff',
              extendedProps: { type: 'block', note: b.note }
            });
          }
        });

        // 2) Bookings (blue if Pending/Rescheduled, green if Confirmed)
        bookings.forEach(b => {
          if ((b.status || 'Pending') === 'Cancelled') return;
          const t = to24h(b.time);
          const start = `${b.date}T${t}`;
          const end   = `${b.date}T${hhmmPlus(t, 60)}`;

          calendar.addEvent({
            id: b._id,
            title: `${b.service || 'Booking'} — ${b.name}`,
            start, end, allDay: false,
            color: (b.status === 'Confirmed') ? '#22c55e' : '#3b82f6',
            textColor: '#ffffff',
            extendedProps: { type: 'booking', status: b.status, email: b.email }
          });
        });
      } catch (e) {
        console.error('Calendar load error:', e);
        tErr('Calendar', 'Failed to load items.');
      }
    },

    // Only blocks are draggable/resizable; bookings are not
    async eventDrop(info) {
      const e = info.event;
      if (e.extendedProps?.type !== 'block') {
        info.revert();
        return;
      }
      try {
        const payload = e.allDay
          ? { date: toLocalYMD(e.start), allDay: true }
          : {
              date: toLocalYMD(e.start),
              allDay: false,
              start: e.start.toTimeString().slice(0,5),
              end:   (e.end || new Date(e.start.getTime()+60*60*1000)).toTimeString().slice(0,5),
            };
        await apiUpdateBlock(e.id, payload);
        tOK('Availability', 'Block updated.');
      } catch (err) {
        info.revert();
        tErr('Availability', 'Could not update block.');
      }
    },

    async eventResize(info) {
      const e = info.event;
      if (e.extendedProps?.type !== 'block' || e.allDay) { info.revert(); return; }
      try {
        const payload = {
          date: toLocalYMD(e.start),
          allDay: false,
          start: e.start.toTimeString().slice(0,5),
          end:   (e.end || new Date(e.start.getTime()+60*60*1000)).toTimeString().slice(0,5),
        };
        await apiUpdateBlock(e.id, payload);
        tOK('Availability', 'Block resized.');
      } catch (err) {
        info.revert();
        tErr('Availability', 'Could not resize block.');
      }
    },

    // Optional: click to view
    eventClick(info) {
      const e = info.event;
      if (e.extendedProps?.type === 'booking') {
        tInfo('Booking', `${e.title}`);
      } else {
        // open your existing block modal
        editingEvent = e;
        eventId.value = e.id || '';
        selectedDate.value = toLocalYMD(e.start);
        blockAllDay.checked = e.allDay;
        toggleTimeRow();
        if (e.allDay) { availStart.value = '08:00'; availEnd.value = '16:00'; }
        else {
          const fmt = (d) => d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
          availStart.value = fmt(e.start);
          availEnd.value   = fmt(e.end || new Date(e.start.getTime()+60*60*1000));
        }
        availNote.value = e.extendedProps?.note || '';
        dlg.showModal();
      }
    }
  });

  calendar.render();

  // toolbar
  document.querySelector('[data-cal-prev]')?.addEventListener('click', () => calendar.prev());
  document.querySelector('[data-cal-next]')?.addEventListener('click', () => calendar.next());
  document.querySelector('[data-cal-today]')?.addEventListener('click', () => calendar.today());

  // Save/Delete block from modal
  btnSave?.addEventListener('click', async () => {
    const date = selectedDate.value;
    const note = availNote.value.trim();
    const id   = eventId.value || null;

    if (blockAllDay.checked) {
      const payload = { date, allDay: true, note };
      try {
        if (id) await apiUpdateBlock(id, payload);
        else {
          const created = await apiCreateBlock(payload);
          calendar.addEvent({
            id: created._id, title: 'Not Available',
            start: date, end: addDaysYMD(date,1), allDay: true,
            color: '#ef4444', textColor:'#fff', extendedProps:{ type:'block', note }
          });
        }
        tOK('Availability', 'Block saved.');
      } catch (e) { tErr('Availability', e.message || 'Save failed.'); }
      finally { dlg.close(); calendar.refetchEvents?.(); }
      return;
    }

    // timed
    const start = availStart.value;
    const end   = availEnd.value;
    if (!start || !end || end <= start) return alert('Please provide a valid time range.');
    const payload = { date, allDay:false, start, end, note };

    try {
      if (id) await apiUpdateBlock(id, payload);
      else {
        const created = await apiCreateBlock(payload);
        calendar.addEvent({
          id: created._id, title:'Not Available',
          start: `${date}T${start}`, end:`${date}T${end}`, allDay:false,
          color:'#ef4444', textColor:'#fff', extendedProps:{ type:'block', note }
        });
      }
      tOK('Availability', 'Block saved.');
    } catch (e) { tErr('Availability', e.message || 'Save failed.'); }
    finally { dlg.close(); calendar.refetchEvents?.(); }
  });

  btnDelete?.addEventListener('click', async () => {
    const id = eventId.value;
    if (!id) { dlg.close(); return; }
    const ok = await (window.Toast?.confirmToast
      ? window.Toast.confirmToast({ title:'Remove block?', message:'Delete this Not Available block?', okText:'Remove', cancelText:'Cancel' })
      : Promise.resolve(confirm('Delete this block?')));
    if (!ok) return;

    try {
      await apiDeleteBlock(id);
      calendar.getEventById(id)?.remove();
      tOK('Availability', 'Block removed.');
    } catch (e) { tErr('Availability', e.message || 'Delete failed.'); }
    finally { dlg.close(); }
  });

  dlg?.addEventListener('close', () => { editingEvent = null; });

  // ---- Blocks API (require admin token) ----
  async function apiCreateBlock(payload) {
    const res = await fetch(`${API}/api/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...window.authHeader() },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Create failed');
    return json.block;
  }

  async function apiUpdateBlock(id, payload) {
    const res = await fetch(`${API}/api/blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...window.authHeader() },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Update failed');
    return json.block;
  }

  async function apiDeleteBlock(id) {
    const res = await fetch(`${API}/api/blocks/${id}`, {
      method: 'DELETE',
      headers: { ...window.authHeader() }
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Delete failed');
    return true;
  }
});