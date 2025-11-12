// /admin/idverify.js
(function () {
  const API = window.API || "http://localhost:3000";

  // ---------- Elements ----------
  const tbody   = document.getElementById("idsBody");
  const filter  = document.getElementById("idvFilterStatus");
  const search  = document.getElementById("idvSearch");
  const clear   = document.getElementById("idvClear");
  const refresh = document.getElementById("idvRefresh");
  const btnPrev = document.getElementById("idvPrev");
  const btnNext = document.getElementById("idvNext");
  const countEl = document.getElementById("idsCount");

  // Preview modal bits (IDs exist in your HTML)
  const modal     = document.getElementById("idPreviewModal");
  const mClose    = document.getElementById("idPreviewClose");
  const mMeta     = document.getElementById("idvMeta");
  const mImg      = document.getElementById("idvImg");
  const mPdf      = document.getElementById("idvPdf");
  const mApprove  = document.getElementById("idvApprove");
  const mDecline  = document.getElementById("idvDecline");

  // Prefer #idvView, fallback to the .idv-view inside modal
  const view = document.getElementById("idvView") || document.querySelector("#idPreviewModal .idv-view");

  if (!tbody) return; // tab not present

  // ---------- Helpers ----------
  const authHeader = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fmt = (d) => {
    if (!d) return "—";
    const x = new Date(d);
    if (isNaN(x)) return "—";
    const pad = (n)=> String(n).padStart(2,"0");
    return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  };

  const badge = (s) => {
    const st = String(s || "").toLowerCase();
    const m = {
      pending:  'badge text-bg-warning',
      approved: 'badge text-bg-success',
      rejected: 'badge text-bg-danger',
      declined: 'badge text-bg-danger'
    };
    const cls = m[st] || 'badge text-bg-secondary';
    const title = st === 'rejected' ? 'Declined' : (st.charAt(0).toUpperCase()+st.slice(1));
    return `<span class="${cls}">${title}</span>`;
  };

  const debounce = (fn, ms=350) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };

  // ---------- Client state ----------
  let page = 1;
  const limit = 10;
  let total = 0;
  let query = "";
  let status = "pending";
  let lastData = [];   // for modal actions

  // ===== Preview state =====
  let currentUrl = null;

  const TOOL_IDS = {
    canvas:  'idvCanvas',
    tools:   'idvToolsBar'   // kept so old nodes can be removed if they exist
  };

  // Canvas wrapper: keep (for future zoom if you ever re-enable)
  function ensureCanvasWrapper() {
    if (!view) return null;
    let canvas = document.getElementById(TOOL_IDS.canvas);
    if (!canvas) {
      canvas = document.createElement('div');
      canvas.id = TOOL_IDS.canvas;
      canvas.style.transformOrigin = 'top left';
      if (mImg && mImg.parentElement === view) canvas.appendChild(mImg);
      if (mPdf && mPdf.parentElement === view) canvas.appendChild(mPdf);
      if (!canvas.parentElement) view.appendChild(canvas);
    }
    return canvas;
  }

  // ---- Toolbar: HARD DISABLE (remove if present, never create) ----
  function ensureToolbar() {
    // If an old toolbar exists (from cached HTML/JS), remove it.
    const existing = document.getElementById(TOOL_IDS.tools);
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
    return null;
  }

  // ---------- Data fetch / render ----------
  async function fetchIds(goPage = page) {
    page = goPage;

    tbody.innerHTML = `<tr><td colspan="6" class="text-muted py-3">Loading…</td></tr>`;
    btnPrev.disabled = true;
    btnNext.disabled = true;

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
      });
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`${API}/id-verifications?${params.toString()}`, {
        headers: { "Content-Type": "application/json", ...authHeader() }
      });

      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error(text || `HTTP ${res.status}`); }
      if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);

      lastData = data.items || [];
      total = data.total || 0;

      renderRows(lastData);
      updatePager();
      updateCount();
    } catch (err) {
      console.error("ID Verify fetch error:", err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Failed to load submissions<br>${err.message}</td></tr>`;
      if (window.tErr) tErr('ID Verification', 'Failed to load submissions.');
    }
  }

  function renderRows(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted py-3">No submissions found</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    items.forEach((it, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.idx = String(idx);

      const fileBtn =
        it.fileUrl
          ? `<a href="${it.fileUrl}" target="_blank" class="btn btn-sm btn-outline-secondary">Open</a>`
          : `<span class="text-muted">—</span>`;

      tr.innerHTML = `
        <td class="text-nowrap">${fmt(it.submittedAt)}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <img src="${it.avatarUrl || '/images/default-user.png'}" alt="" class="rounded-circle" style="width:36px;height:36px;object-fit:cover;">
            <div class="small">
              <div class="fw-semibold">${it.userName || '—'}</div>
              <div class="text-muted">UID: ${it.userId || '—'}</div>
            </div>
          </div>
        </td>
        <td>${it.userEmail || '—'}</td>
        <td>${fileBtn}</td>
        <td>${badge(it.status)}</td>
        <td class="text-end">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary act-preview">Preview</button>
            <button class="btn btn-sm btn-success act-approve">Approve</button>
            <button class="btn btn-sm btn-outline-danger act-decline">Decline</button>
          </div>
        </td>
      `;

      tr.querySelector('.act-preview')?.addEventListener('click', () => openPreview(idx));
      tr.querySelector('.act-approve')?.addEventListener('click', () => approveIdx(idx));
      tr.querySelector('.act-decline')?.addEventListener('click', () => declineIdx(idx));

      tbody.appendChild(tr);
    });
  }

  function updatePager() {
    const maxPage = Math.max(1, Math.ceil(total / limit));
    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= maxPage;
  }

  function updateCount() {
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(total, page * limit);
    if (countEl) countEl.textContent = `Showing ${from}–${to} of ${total}`;
  }

  // ---------- Open / close preview ----------
  function openPreview(idx) {
    const it = lastData[idx];
    if (!it) return;

    // Remove any existing custom toolbar (and DO NOT create one)
    ensureToolbar();
    const canvas = ensureCanvasWrapper();

    const when = fmt(it.submittedAt);
    if (mMeta) mMeta.textContent = `${it.userName || 'User'} • ${it.userEmail || ''} • ${when}`;

    // Reset view
    if (view) {
      view.classList.remove('is-error');
      view.classList.remove('is-loading');
    }
    if (mImg) { mImg.style.display = 'none'; mImg.removeAttribute('src'); }
    if (mPdf) { mPdf.style.display = 'none'; mPdf.removeAttribute('src'); }

    currentUrl = it.fileUrl || null;

    if (it.fileUrl && /\.pdf(\?|$)/i.test(it.fileUrl)) {
      mPdf.src = it.fileUrl;
      mPdf.style.display = 'block';
      if (mPdf.parentElement !== canvas) canvas.appendChild(mPdf);
    } else if (it.fileUrl) {
      mImg.src = it.fileUrl;
      mImg.style.display = 'block';
      if (mImg.parentElement !== canvas) canvas.appendChild(mImg);
    } else {
      view && view.classList.add('is-error');
    }

    if (mApprove) mApprove.onclick = () => approveIdx(idx, true);
    if (mDecline) mDecline.onclick = () => declineIdx(idx, true);

    // Show modal
    modal.style.removeProperty('display');
    modal.classList.add('show');
  }

  function closePreview() {
    modal.classList.remove('show');
    modal.style.removeProperty('display');
    if (mImg) mImg.removeAttribute('src');
    if (mPdf) mPdf.removeAttribute('src');
    currentUrl = null;
  }

  mClose?.addEventListener('click', closePreview);
  window.addEventListener('click', (e) => { if (e.target === modal) closePreview(); });

  // ---------- Approve / Decline ----------
  async function approveIdx(idx, fromModal=false) {
    const it = lastData[idx];
    if (!it) return;
    try {
      const res = await fetch(`${API}/id-verifications/${it.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
      if (fromModal) closePreview();
      if (window.tOK) tOK('ID Approved', `${it.userName || 'User'} is now verified.`);
      fetchIds(page);
    } catch (e) {
      console.error(e);
      if (window.tErr) tErr('Approve failed', e.message);
    }
  }

  async function declineIdx(idx, fromModal=false) {
    const it = lastData[idx];
    if (!it) return;

    let note = "";
    if (window.Toast?.promptToast) {
      note = await window.Toast.promptToast({ title: 'Decline reason (optional)' }).catch(()=> "");
    } else {
      note = prompt("Decline reason (optional):", "") || "";
    }

    try {
      const res = await fetch(`${API}/id-verifications/${it.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ note })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);

      if (fromModal) closePreview();
      if (window.tOK) tOK('ID Declined', `${it.userName || 'User'} has been declined.`);
      fetchIds(page);
    } catch (e) {
      console.error(e);
      if (window.tErr) tErr('Decline failed', e.message);
    }
  }

  // ---------- Events ----------
  btnPrev?.addEventListener('click', () => fetchIds(page - 1));
  btnNext?.addEventListener('click', () => fetchIds(page + 1));
  refresh?.addEventListener('click', () => fetchIds(1));

  filter?.addEventListener('change', () => {
    status = filter.value || 'pending';
    fetchIds(1);
  });

  const doSearch = debounce(() => { query = search.value || ""; fetchIds(1); }, 350);
  search?.addEventListener('input', doSearch);
  clear?.addEventListener('click', () => { search.value = ""; query = ""; fetchIds(1); });

  // ---------- Init (only when the tab is shown) ----------
  const boot = () => fetchIds(1);

  const hash = (location.hash || '').slice(1);
  const last = (()=>{ try { return localStorage.getItem('admin_last_section'); } catch { return null; } })();
  if (hash === 'id-verify' || last === 'id-verify') boot();

  document.querySelectorAll('.section-btn').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.section === 'id-verify') boot();
    });
  });
})();
