// ================================================================
// 🌊 CHASE AQUATICS - USER AUTH HANDLER (DEFAULT COLOR + ACTIVE PAGE)
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 Auth Status Checker Loaded");

  const loginTrigger = document.getElementById("loginTrigger");
  const loginContainer = document.getElementById("loginContainer");

  // ✅ Get stored user info
  const token = localStorage.getItem("token");
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    console.warn("⚠️ Corrupted user data in localStorage.");
    user = null;
  }

  const isProfilePage = window.location.pathname.includes("/profile/profile.html");

  // ✅ Default icon color
  const defaultColor = "#335A02";
  const activeColor = "#2b4d02"; // slightly darker only for "active" page look

  // ✅ If logged in
  if (token && user) {
    // ✅ Ensure compatibility with new backend (handle first + last name)
    if (!user.fullName && (user.firstName || user.lastName)) {
      user.fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }

    console.log("✅ User logged in:", user.fullName || user.email);

    if (loginTrigger) {
      loginTrigger.classList.add("logged-in");
      loginTrigger.title = "My Account";
      loginTrigger.style.color = isProfilePage ? activeColor : defaultColor;

      // Open the Account Quick Menu (navigation happens from the menu)
      loginTrigger.onclick = (e) => {
        e.preventDefault();
        window.AccountQuick?.open?.();
      };
    }

    if (loginContainer) loginContainer.style.display = "none"; // hide popup if logged in
  }

  // ✅ If not logged in
  else {
    console.log("⚠️ No active user session found.");
    if (loginTrigger) {
      loginTrigger.classList.remove("logged-in");
      loginTrigger.title = "Login";
      loginTrigger.style.color = defaultColor;

      loginTrigger.onclick = () => {
        const popup = document.getElementById("loginContainer");
        if (popup) popup.style.display = "block";
        else alert("⚠️ Login popup not found.");
      };
    }
  }
});

/* === Account Quick Menu (global, zero-HTML) — no logout, cart-sized === */
(function () {
  function injectQuickStyles() {
    if (document.getElementById("aq-inline-style")) return;

    const CART_BG   = "#F3EBDC"; // same as cart
    const HOVER_BG  = "#E9DDC6"; // a touch darker

    const css = `
      /* kill any default borders/lines/shadows */
      .account-quick .aq-panel,
      .account-quick .aq-actions,
      .account-quick .aq-btn {
        border: 10px;
        box-shadow: none !important;
        background: ${CART_BG} !important;
      }

      /* panel container (no white card look) */
      .account-quick .aq-panel {
        border-radius: 16px;
        padding: 10px;
      }

      /* header — same bg, no divider */
      .account-quick .aq-head {
        padding: 14px 16px;
        font-weight: 600;
        background: ${CART_BG} !important;
        border: 14px;
      }

      /* actions area */
      .account-quick .aq-actions {
        padding: 8px;
      }

      /* buttons — flat, no lines; only darken on hover */
      .account-quick .aq-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 14px 16px;
        color: #1b1b1b;
        border-radius: 14px;
        transition: background-color .16s ease;
      }
      .account-quick .aq-btn + .aq-btn { margin-top: 8px; }
      .account-quick .aq-btn i { width: 20px; text-align: center; color: #335A02; }
      .account-quick .aq-btn:hover { background: ${HOVER_BG} !important; }

      /* keep the overlay itself transparent (no beige screen) */
      #accountQuick { background: transparent !important; }
    `;

    const style = document.createElement("style");
    style.id = "aq-inline-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureQuickUI(){
    if (document.getElementById('accountQuick')) return;

    const wrap = document.createElement('div');
    wrap.id = 'accountQuick';
    wrap.className = 'account-quick';
    wrap.hidden = true;

    wrap.innerHTML = `
      <div class="aq-backdrop" data-close></div>
      <aside class="aq-panel" role="dialog" aria-modal="true" aria-label="Account">
        <header class="aq-head">My Account</header>
        <nav class="aq-actions"></nav>
      </aside>`;

    document.body.appendChild(wrap);
    injectQuickStyles();   // ✅ <— added
    renderButtons();       // ✅ initial render of both items
    observeButtons();      // ✅ keep them alive

    // outside click + ESC
    wrap.addEventListener('click', (e)=>{
      if (e.target.matches('[data-close]')) closeQuick();
    });
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') closeQuick();
    });

    // single delegated handler (safe even if nodes are recreated)
    wrap.addEventListener('click', (e)=>{
      const btn = e.target.closest('.aq-btn');
      if (!btn) return;
      const where = btn.getAttribute('data-goto');
      if (!where) return;
      closeQuick();
      if (where === 'profile') location.href = '/profile/profile.html';
      if (where === 'orders')  location.href = '/profile/trackorder.html';
    });
  }
  // === Close "My Account" popup on scroll (wheel/touch/scroll) ===
(function () {
  let onScroll = null;

  function attachScrollClose() {
    if (onScroll) return;
    onScroll = () => {
      const el = document.getElementById('accountQuick');
      if (el && !el.hidden) {
        // Close immediately on any scroll
        window.AccountQuick?.close?.();
      }
    };
    // Listen to multiple inputs for reliability
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
  }

  function detachScrollClose() {
    if (!onScroll) return;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onScroll);
    window.removeEventListener('touchmove', onScroll);
    onScroll = null;
  }

  function patchWhenReady() {
    if (!window.AccountQuick) {
      // Wait until the menu script defines AccountQuick
      setTimeout(patchWhenReady, 50);
      return;
    }
    const _open  = window.AccountQuick.open;
    const _close = window.AccountQuick.close;

    window.AccountQuick.open = function () {
      _open && _open.apply(this, arguments);
      attachScrollClose();
    };
    window.AccountQuick.close = function () {
      _close && _close.apply(this, arguments);
      detachScrollClose();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchWhenReady);
  } else {
    patchWhenReady();
  }
})();

  // ✅ Always render BOTH buttons (overwrites partial DOM if some other code changed it)
  function renderButtons(){
    const nav = document.querySelector('#accountQuick .aq-actions');
    if (!nav) return;
    nav.innerHTML = `
      <button class="aq-btn" data-goto="profile">
        <i class="fa-solid fa-user"></i><span>My Profile</span>
      </button>
      <button class="aq-btn" data-goto="orders">
        <i class="fa-solid fa-box"></i><span>My Orders</span>
      </button>
    `;
  }

  // ✅ If some script/css mutates/removes the second button, re-render instantly
  function observeButtons(){
    const nav = document.querySelector('#accountQuick .aq-actions');
    if (!nav) return;
    const mo = new MutationObserver(() => {
      const prof = nav.querySelector('[data-goto="profile"]');
      const orders = nav.querySelector('[data-goto="orders"]');
      if (!prof || !orders) renderButtons();
    });
    mo.observe(nav, { childList: true, subtree: true });
  }

  function openQuick(){
    ensureQuickUI();
    renderButtons(); // ✅ re-assert both on open
    const el = document.getElementById('accountQuick');
    if (!el) return;
    el.hidden = false;

    // Keep the page scrollable (avoid hiding the main scrollbar)
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
  }
  function closeQuick(){
    const el = document.getElementById('accountQuick');
    if (!el) return;
    el.hidden = true;

    // Return to site defaults
    document.documentElement.style.overflowY = '';
    document.body.style.overflowY = '';
  }
  function toggleQuick(){
    ensureQuickUI();
    const el = document.getElementById('accountQuick');
    if (!el) return;
    el.hidden ? openQuick() : closeQuick();
  }

  // Expose a safe rebuild if ever needed (keeps old keys)
  function rebuildQuick(){
    try { document.getElementById('accountQuick')?.remove(); } catch {}
    ensureQuickUI();
  }

  window.AccountQuick = { open: openQuick, close: closeQuick, toggle: toggleQuick, rebuild: rebuildQuick };
})();
