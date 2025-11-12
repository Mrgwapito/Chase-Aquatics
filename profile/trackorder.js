// ===============================================
// 🧭 CLIENT ORDER TRACKER — 3 steps + counters
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
  const API = 'http://localhost:3000';

  // DOM
  const listEl   = document.getElementById('ordersList');
  const emptyEl  = document.getElementById('ordersEmpty');
  const btnRef   = document.getElementById('refreshOrders');

  const dlg      = document.getElementById('orderDetails');
  const odTitle  = document.getElementById('odTitle');
  const odBody   = document.getElementById('odBody');


  const searchEl   = document.getElementById('orderSearch');
  const filterBtns = Array.from(document.querySelectorAll('.orders-filter-btn'));

  // Counters (must exist in your left filter)
  const spanAll        = document.getElementById('count-all');
  const spanToPay      = document.getElementById('count-to-pay');
  const spanProcessing = document.getElementById('count-processing');
  const spanCompleted  = document.getElementById('count-completed');
  const spanCancelled  = document.getElementById('count-cancelled');

  // NEW: modal close handlers
// keep this so clicking the dim backdrop closes:
dlg?.addEventListener('click', (e) => {
  const r = dlg.getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (outside) dlg.close();
});


// Optional: click the backdrop to close (for native <dialog/>)
dlg?.addEventListener('click', (e) => {
  const r = dlg.getBoundingClientRect();
  const clickedOutside =
    e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (clickedOutside) dlg.close();
});


  // Auth
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const toast = (type, title, msg='') =>
    window.Toast?.showToast
      ? window.Toast.showToast({ type, title, message: msg, position: 'top' })
      : console.log(`[${type}] ${title} ${msg}`);

  if (!token) toast('error','Please log in','You must be signed in to view your orders.');

  // State
  let allOrders = [];
  let currentFilter = 'all'; // 'all' | 'to-pay' | 'processing' | 'completed' | 'cancelled'
  let searchTerm = '';

  // NEW: centralize how we switch tabs (filter) from code
function setFilterByStatus(status='all') {
  currentFilter = status;
  filterBtns.forEach(b => {
    const isActive = (b.dataset.status || 'all') === status;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  renderList();
  // optional: jump to list top
  listEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function badgeClass(s=''){
  const ui = mapUIStatus(s);
  return ui === 'to-pay'   ? 'is-pay'   :
         ui === 'processing' ? 'is-proc' :
         ui === 'completed'  ? 'is-comp' :
         ui === 'cancelled'  ? 'is-cancel' : '';
}

  // Helpers
  const mapUIStatus = (s='') => {
    s = String(s).toLowerCase();
    if (['cancelled','canceled'].includes(s)) return 'cancelled';
    if (['completed','delivered'].includes(s)) return 'completed';
    if (['to pay','to-pay','unpaid','pending payment','awaiting payment'].includes(s)) return 'to-pay';
    // everything in-flight (paid, confirmed, packed, shipping, out for delivery, etc.) → processing
    if (['paid','confirmed','processing','packed','preparing','shipping','in transit','out for delivery','out-for-delivery'].includes(s)) return 'processing';
    // default safe fallback
    return 'processing';
  };

  const labelFor = (k) => ({
    'to-pay': 'To Pay',
    'processing': 'Processing',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  }[k] || k);

  const fmtPeso = (n) => `₱${Number(n||0).toFixed(2)}`;
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString();
  };
  const escapeHTML = (s='') => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // OPTIONAL: Lazada/Shopee-style thumbs (uses o.cart[] if present)
  function renderThumbs(o) {
    const arr = Array.isArray(o.cart) ? o.cart : [];
    if (!arr.length) return ''; // fallback to text if no cart array on list endpoint
    const thumbs = arr.slice(0, 4).map(it => {
      const src = it.image || it.img || it.thumbnail || it.photo || it.photoUrl || '/assets/placeholder.png';
      const alt = it.title || it.name || 'Item';
      return `<img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" class="order-thumb" loading="lazy">`;
    }).join('');
    const more = arr.length > 4 ? `<span class="order-more">+${arr.length - 4} more</span>` : '';
    return `<div class="order-thumbs">${thumbs}${more}</div>`;
  }

  // Fetch + render pipeline
  async function fetchMyOrders() {
    try {
      listEl.innerHTML = '';
      emptyEl.hidden = true;

      const res = await fetch(`${API}/api/my-orders?limit=50&page=1`, { headers: { ...authHeader }});
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);

      allOrders = (data.orders || []).map(o => ({ ...o, uiStatus: mapUIStatus(o.status) }));
      updateCounters(allOrders);
      renderList();
    } catch (e) {
      console.error('❌ Failed to load orders:', e);
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.innerHTML = `<div class="orders-empty-title" style="color:#c00">Failed to load your orders.</div>`;
    }
  }

  function updateCounters(orders) {
    const counts = { all: orders.length, 'to-pay': 0, 'processing': 0, 'completed': 0, 'cancelled': 0 };
    orders.forEach(o => counts[o.uiStatus]++);
    if (spanAll)        spanAll.textContent        = counts.all;
    if (spanToPay)      spanToPay.textContent      = counts['to-pay'];
    if (spanProcessing) spanProcessing.textContent = counts['processing'];
    if (spanCompleted)  spanCompleted.textContent  = counts['completed'];
    if (spanCancelled)  spanCancelled.textContent  = counts['cancelled'];
  }

  function filteredOrders() {
    const s = searchTerm.trim().toLowerCase();
    return allOrders.filter(o => {
      const byFilter = currentFilter === 'all' ? true : o.uiStatus === currentFilter;
      if (!s) return byFilter;
      const hay = `${o.code || ''} ${o.items || ''}`.toLowerCase();
      return byFilter && hay.includes(s);
    });
  }

  function renderList() {
    const list = filteredOrders();
    listEl.innerHTML = '';
    if (!list.length) { emptyEl.hidden = false; return; }
    emptyEl.hidden = true;
    list.forEach(renderOrderCard);
  }

function renderOrderCard(o) {
  const ui = o.uiStatus || mapUIStatus(o.status);
  const steps = ['to-pay','processing','completed'];
  const activeIdx = ui === 'cancelled' ? -1 : steps.indexOf(ui);

  const showStepper = (typeof currentFilter !== 'undefined')
    ? currentFilter === 'all'
    : true;

  const stepHTML = ui === 'cancelled'
    ? `<div class="step cancelled"><span class="dot"></span><label>Cancelled</label></div>`
    : steps.map((k, i) => `
        <div class="step ${i < activeIdx ? 'done' : ''} ${i === activeIdx ? 'current' : ''}">
          <span class="dot"></span><label>${labelFor(k)}</label>
        </div>
      `).join('');

  const compactStatus = `
    <div class="order-status-row">
      <span class="status-small ${ui}">${labelFor(ui)}</span>
    </div>
  `;

  const card = document.createElement('article');
  card.className = 'order-card';
  card.dataset.status = ui; // for clicks to know target tab
  card.innerHTML = `
    <div class="order-top">
      <div class="order-code">Order #${o.code}</div>
      <div class="order-meta">${fmtDate(o.dateISO)} • ${o.paymentMethod || 'Payment'}</div>
    </div>

    <div class="order-items">${escapeHTML(o.items || '')}</div>

    <div class="order-bottom">
      <div class="order-total"><span class="badge">Total: ${fmtPeso(o.total)}</span></div>
      <div class="order-actions">
        <button class="btn btn-sm btn-outline" data-view="${o.id}">View details</button>
      </div>
    </div>

    ${ showStepper ? `<div class="stepper">${stepHTML}</div>` : compactStatus }
  `;

  // Stop card-click when "View details" is pressed
  const viewBtn = card.querySelector('[data-view]');
  viewBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openDetails(o.id, o.code);
  });

  // Clicking anywhere else on the card jumps to that tab/status
  card.addEventListener('click', () => {
    setFilterByStatus(ui);  // 'to-pay' | 'processing' | 'completed' | 'cancelled'
  });

  listEl.appendChild(card);
}



async function openDetails(id, code) {
  if (!dlg) return;
  odTitle.textContent = `Order #${code || id}`;
  odBody.innerHTML = `<p>Loading…</p>`;

  try {
    const res = await fetch(`${API}/api/my-orders/${id}`, { headers: { ...authHeader }});
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);

    const o = data.order;

    const itemsHTML = (o.cart || []).map(it => {
      const img = it.image || it.img || it.thumbnail || it.photo || it.photoUrl || '/assets/placeholder.png';
      const title = it.title || it.name || 'Item';
      const price = Number(it.price || 0);
      const qty   = Number(it.quantity || 1);
      const line  = price * qty;
      return `
        <li class="od-item">
          <img class="od-thumb" src="${escapeHTML(img)}" alt="${escapeHTML(title)}" loading="lazy">
          <div class="od-meta">
            <div class="od-title">${escapeHTML(title)}</div>
            <div class="od-sub">Unit: ${fmtPeso(price)} × ${qty} = <strong>${fmtPeso(line)}</strong></div>
          </div>
        </li>
      `;
    }).join('');

    odBody.innerHTML = `
      <div class="od-summary">
        <p><strong>Status:</strong>
  <span class="od-badge ${badgeClass(o.status)}">${escapeHTML(o.status || '')}</span>
</p>

        <p><strong>Fulfillment:</strong> ${escapeHTML(o.fulfillment || '—')}</p>
        <p><strong>Address:</strong> ${escapeHTML(o.address || '—')}</p>
        <p><strong>Payment Method:</strong> ${escapeHTML(o.paymentMethod || '—')}</p>
        <p><strong>Subtotal:</strong> ${fmtPeso(o.subtotal)}<br>
           <strong>Shipping:</strong> ${fmtPeso(o.shipping)}<br>
           <strong>Total:</strong> ${fmtPeso(o.totalAmount)}</p>
      </div>

      <h4 class="od-h">Items</h4>
      <ul class="od-items">${itemsHTML || '<li class="od-empty">—</li>'}</ul>

      <p style="margin-top:8px;"><strong>Receipt:</strong>
        ${ o.paymentMeta?.receiptUrl
            ? `<a href="${o.paymentMeta.receiptUrl}" target="_blank" rel="noopener">View receipt</a>`
            : '—' }
      </p>
    `;
  } catch (e) {
    console.error(e);
    odBody.innerHTML = `<p style="color:#c00">Failed to load details.</p>`;
  }

  dlg.showModal();
}


  // Filters
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setFilterByStatus(btn.dataset.status || 'all');
  });
});

  // Search
  searchEl?.addEventListener('input', () => { searchTerm = searchEl.value || ''; renderList(); });

  // Manual refresh
  btnRef?.addEventListener('click', fetchMyOrders);

  // Optional polling
  const POLL_MS = 30000;
  let poll = setInterval(fetchMyOrders, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(poll);
    else { fetchMyOrders(); poll = setInterval(fetchMyOrders, POLL_MS); }
  });

  // Initial
  fetchMyOrders();
});
