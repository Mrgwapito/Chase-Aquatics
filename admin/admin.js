// ================================================================
// 📦 ADMIN DASHBOARD — ORDERS, APPOINTMENTS, LOGOUT, NAV
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📦 Admin Order Management Loaded");

  const ordersBody = document.getElementById("ordersBody");
  const statSales = document.getElementById("statSales");
  const statOrders = document.getElementById("statOrders");
  const statPending = document.getElementById("statPending");

  const modal = document.getElementById("orderModal");
  const closeModal = modal.querySelector(".close");
  const mOrderId = document.getElementById("mOrderId");
  const mCustomer = document.getElementById("mCustomer");
  const mPayment = document.getElementById("mPayment");
  const mTotal = document.getElementById("mTotal");
  const mStatus = document.getElementById("mStatus");
  const btnPaid = document.getElementById("modalPaid");
  const btnDone = document.getElementById("modalDone");

  let orders = [];

  // =======================================================
  // 🟩 Fetch All Orders
  // =======================================================
  async function fetchOrders() {
    try {
      const res = await fetch("http://localhost:3000/api/orders");
      const data = await res.json();

      if (!data.success) throw new Error(data.message || "Failed to load orders.");

      orders = data.orders || [];
      renderOrders(orders);
      updateStats(orders);

      console.log(`✅ Loaded ${orders.length} orders.`);
    } catch (err) {
      console.error("❌ Error loading orders:", err);
      ordersBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Failed to load orders</td></tr>`;
    }
  }

  // =======================================================
  // 🟩 Render Orders into Table
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
        <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-btn" data-id="${order._id}">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      `;
      ordersBody.appendChild(row);
    });

    // Attach view button events
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.id));
    });
  }

  // =======================================================
  // 🟩 Update Dashboard Stats
  // =======================================================
  function updateStats(orderList) {
    const totalSales = orderList.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingCount = orderList.filter((o) => o.status === "Pending").length;

    statSales.textContent = `₱${totalSales.toFixed(2)}`;
    statOrders.textContent = orderList.length;
    statPending.textContent = pendingCount;
  }

  // =======================================================
  // 🟩 Modal Functions (Orders)
  // =======================================================
  function openModal(orderId) {
    const order = orders.find((o) => o._id === orderId);
    if (!order) return;

    mOrderId.textContent = order.orderId;
    mCustomer.textContent = order.name;
    mPayment.textContent = order.paymentMethod || "N/A";
    mTotal.textContent = `₱${order.totalAmount.toFixed(2)}`;
    mStatus.textContent = order.status;

    modal.style.display = "block";

    btnPaid.onclick = () => updateOrderStatus(order._id, "Paid");
    btnDone.onclick = () => updateOrderStatus(order._id, "Completed");
  }

  closeModal.onclick = () => (modal.style.display = "none");
  window.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  // =======================================================
  // 🟩 Update Order Status
  // =======================================================
async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    // handle non-JSON responses (e.g., HTML 404)
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error("Server did not return JSON.");
    }
    if (!data.success) throw new Error(data.message || "Update failed");

    alert(`✅ Order marked as ${newStatus}`);
    modal.style.display = "none";
    fetchOrders(); // refresh
  } catch (err) {
    console.error("❌ Failed to update order:", err);
    alert(`⚠️ Could not update order status. ${err.message}`);
  }
}


  // =======================================================
  // 🟩 Filter Tabs
  // =======================================================
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const filter = tab.dataset.filter;
      if (filter === "all") renderOrders(orders);
      else renderOrders(orders.filter((o) => (o.paymentMethod || "").toLowerCase() === filter));
    });
  });

  // =======================================================
  // 🚀 Load Orders Initially
  // =======================================================
  fetchOrders();
});

// ================================================================
// 🧩 ADMIN DROPDOWN + LOGOUT HANDLER
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("adminMenuBtn");
  const menu = document.getElementById("adminMenu");
  const logoutBtn = document.getElementById("adminLogoutBtn");

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.style.display = "none";
    }
  });

  logoutBtn.addEventListener("click", () => {
    const confirmLogout = confirm("Are you sure you want to log out?");
    if (!confirmLogout) return;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    sessionStorage.clear();

    alert("👋 Admin has been logged out successfully.");
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

    // 🔄 REMOVED CALL: do not auto-fetch products when opening Inventory
    // if (key === "inventory") {
    //   try { refreshInventoryFromServer && refreshInventoryFromServer(); } catch (e) {}
    // }

    history.replaceState(null, "", `#${key}`);
    try {
      localStorage.setItem("admin_last_section", key);
    } catch (e) {}
  };

  btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.section)));

  const fromHash = (location.hash || "").replace("#", "");
  const fromStore = (() => {
    try {
      return localStorage.getItem("admin_last_section");
    } catch (e) {
      return null;
    }
  })();
  const startKey =
    sectionMap[fromHash] ? fromHash : sectionMap[fromStore] ? fromStore : "orders";
  show(startKey);
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
  async function fetchAppointments() {
    try {
      const res = await fetch("http://localhost:3000/api/bookings");
      const data = await res.json();

      if (!data.success) throw new Error(data.message || "Failed to load appointments.");

      appointments = data.bookings || [];
      renderAppointments(appointments);

      console.log(`✅ Loaded ${appointments.length} appointments.`);
    } catch (err) {
      console.error("❌ Error loading appointments:", err);
      apptBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Failed to load appointments</td></tr>`;
    }
  }

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
    aGuests.textContent =
      appt.guests && appt.guests.length
        ? Array.isArray(appt.guests)
          ? appt.guests.join(", ")
          : appt.guests
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

    alert(`✅ Appointment marked as ${status}`);
    closeApptModal();
    fetchAppointments();                                // refresh table
  } catch (err) {
    console.error("❌ Failed to update appointment:", err);
    alert("⚠️ Could not update appointment status.");
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

    alert("✅ Appointment rescheduled successfully.");
    closeApptModal();
    fetchAppointments();
  } catch (err) {
    console.error("❌ Failed to reschedule:", err);
    alert("⚠️ Could not reschedule appointment.");
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

  let created = null;

  // 1) Try to save to the backend using FormData
  try {
    const fd = new FormData();
    // IMPORTANT: schema uses "title", not "name"
    fd.append('title', pName.value.trim());
    fd.append('price', pPrice.value || '0');
    fd.append('stock', pStock.value || '0');
    fd.append('category', pCategory.value.trim());
    fd.append('description', pDesc.value.trim() || '');
    // If you want to upload an image later, this will be picked by multer.none() as text unless you add file upload middleware
    // inside addForm submit handler
if (pImage.files && pImage.files[0]) fd.append('image', pImage.files[0]);

    created = await apiCreateProductFD(fd); // POST /api/products
  } catch (apiErr) {
    console.warn('⚠️ API save failed, but continuing with local row:', apiErr);
  }

  // 2) Always proceed with your original local DOM logic (unchanged UX)
  const name = pName.value.trim();
  const price = parseFloat(pPrice.value || '0');
  const cat = pCategory.value.trim();
  const stock = parseInt(pStock.value || '0', 10);
  const desc = pDesc.value.trim();
  if (!name || isNaN(price)) { alert('Please complete the required fields.'); return; }

  if (mode === 'add') {
    const tr = document.createElement('tr');
    tr.dataset.status = stock === 0 ? 'OOS' : (stock <= 5 ? 'LOW' : 'OK');
    tr.dataset.desc = desc;
    if (created && created._id) tr.dataset.id = created._id; // keep reference to DB id
    tr.innerHTML = `
      <td>${name}</td>
      <td>₱${price.toFixed(2)}</td>
      <td>${cat}</td>
      <td class="stock">${stock}</td>
      <td><button class="invEdit">Edit</button></td>
    `;
    invBody.prepend(tr);
  } else if (editRow) {
    editRow.children[0].textContent = name;
    editRow.children[1].textContent = `₱${price.toFixed(2)}`;
    editRow.children[2].textContent = cat;
    editRow.querySelector('.stock').textContent = stock;
    editRow.dataset.desc = desc;
    editRow.dataset.status = stock === 0 ? 'OOS' : (stock <= 5 ? 'LOW' : 'OK');
    // (Optional) PUT to backend later
  }

  closeModal();
  addForm.reset();
});


  // Delete (with confirm)
  btnDelete.addEventListener('click', () => {
    if (!editRow) return;
    const name = editRow.children[0].textContent.trim();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    editRow.remove();
    // TODO: DELETE to backend using pId.value when you want to wire it
    closeModal();
  });

  // 🔄 REMOVED: initial DB fetch on page load (you asked not to include DB items yet)
  // try { refreshInventoryFromServer && refreshInventoryFromServer(); } catch (e) {}
});

// === Inventory API helpers (ADD + LIST) ===
// 🔗 central API base
const API_BASE = 'http://localhost:3000';

async function apiCreateProductFD(formData) {
  const res = await fetch(`${API_BASE}/api/products`, { method: 'POST', body: formData });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || 'Save failed');
  return json.product; // created product document
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
      <td>${p.name ?? '-'}</td>
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

  async function fetchLogs() {
    try {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Loading…</td></tr>`;
      const res = await fetch('/api/admin-logs?limit=100');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed');
      render(data.logs || []);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Failed to load logs</td></tr>`;
      console.error(e);
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

    // Pretty print meta + message
    mMsg.textContent = log.message + (log.meta ? `\n\nDetails:\n${JSON.stringify(log.meta, null, 2)}` : '');
    modal.style.display = 'block';
  }

  function closeModal() { modal.style.display = 'none'; }
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
async function loadProductsIntoTable() {
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Loading...</td></tr>`;

  try {
    const res = await fetch('http://localhost:3000/api/products');
    const products = await res.json();

    if (!Array.isArray(products) || !products.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No products yet</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.title}</td>
        <td>₱${Number(p.price || 0).toFixed(2)}</td>
        <td>${p.category || ''}</td>
        <td class="stock">${Number(p.stock || 0)}</td>
        <td><button class="invEdit">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('❌ loadProducts error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Failed to load products</td></tr>`;
  }
}

// call this when the Inventory tab is activated
// and optionally at page init if Inventory is active by default
