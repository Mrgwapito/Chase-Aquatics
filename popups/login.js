  // ================================================================
  // 🌊 CHASE AQUATICS FRONTEND AUTH SCRIPT (FULLY FIXED + PERSISTENT LOGIN)
  // ================================================================

// ✅ Backend base URL (works on localhost + Render)
const API =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:3000"
    : "https://chase-aquatics.onrender.com";

// ✅ Expose globally so other scripts can reuse the same base
window.__API_BASE__ = window.__API_BASE__ || API;
// ======================= LOGIN SECTION (FIXED & MERGED) =======================
document.addEventListener('DOMContentLoaded', () => {
  const signBtn   = document.getElementById('signInBtn');
  if (!signBtn) return; // button not on this page

  // If your button lives inside a <form id="loginForm">...</form>,
  // prevent the native submit so the page doesn't reload.
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    signBtn.click();
  });

  signBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // stop native submit / hash jumps

    const email      = document.getElementById('loginEmail')?.value?.trim() || '';
    const password   = document.getElementById('password')?.value?.trim() || '';
    const rememberMe = !!document.getElementById('remember')?.checked;

    if (!email || !password) {
      notify({
        title: 'Missing info',
        message: 'Please enter both email and password.',
        type: 'error',
        duration: 6000,
        position: 'top'
      });
      return;
    }

    try {
const res = await fetch(`${API}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});


      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await res.text();
        console.log('Response is not JSON:', textResponse);
        notify({
          title: 'Unexpected response',
          message: String(textResponse).slice(0, 180),
          type: 'error',
          duration: 6000,
          position: 'top'
        });
        return;
      }

      const data = await res.json();

      if (data.success && data.token) {
        // === your existing success logic (unchanged) ===
        if (rememberMe) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('isLoggedIn', 'true');
        } else {
          sessionStorage.setItem('token', data.token);
          sessionStorage.setItem('user', JSON.stringify(data.user));
          sessionStorage.setItem('isLoggedIn', 'true');
        }
        // also mirror to localStorage for safety
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');

        try {
          const u = data.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

          if (u && u.role === 'admin') {
            window.location.href = './admin/admin.html';
            return;
          }

          // close modal for regular users
          const loginContainer = document.getElementById('loginContainer');
          if (loginContainer) loginContainer.style.display = 'none';

          // ---- your broadcast + welcome + cart sync block (unchanged) ----
          if (!window.__AUTH_LOGIN_FIRED) {
            window.__AUTH_LOGIN_FIRED = true;

            const user = u || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
            const userId = user?.id || user?._id;
            const firstName = user?.firstName || user?.name || '';
            const firstKey = userId ? `first_login_seen_${userId}` : null;
            const isFirstLoginOnThisDevice = firstKey ? !localStorage.getItem(firstKey) : true;

            const WELCOME_MS = 2200;
            const GAP_MS = 200;
            let cartSynced = false;

            function onCartSynced(e2) {
              window.removeEventListener('cart:synced', onCartSynced);
              cartSynced = true;
              const count = e2?.detail?.itemCount ?? 0;
              if (isFirstLoginOnThisDevice && count > 0) {
                setTimeout(() => {
                  notify({
                    title: firstName ? `Hi ${firstName}` : 'Hi there',
                    message: 'We saved your cart from last time. Ready to check out?',
                    type: 'success',
                    duration: 3200,
                    position: 'br'
                  });
                  if (firstKey) localStorage.setItem(firstKey, '1');
                }, WELCOME_MS + GAP_MS);
              }
            }
            window.addEventListener('cart:synced', onCartSynced, { once: true });

            window.dispatchEvent(new CustomEvent('auth:login', {
              detail: { token: data.token, user: u }
            }));

            notify({
              title: 'Welcome!',
              message: 'Login successful.',
              type: 'success',
              duration: WELCOME_MS,
              position: 'br'
            });

            setTimeout(() => {
              if (cartSynced) return;
              try {
                const lsUserCart = JSON.parse(localStorage.getItem(`cart_${userId}`) || '[]');
                const guestCart  = JSON.parse(localStorage.getItem('cart_guest') || '[]');
                const src = lsUserCart.length ? lsUserCart : guestCart;
                const count = (src || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);

                const canShow = mkCanShow(userId, 30);
                if ((isFirstLoginOnThisDevice || canShow) && count > 0) {
                  const itemWord = count === 1 ? 'item' : 'items';
                  const msg = count > 1
                    ? `You still have ${count} ${itemWord} waiting in your cart. Want to take a look?`
                    : `We saved your cart from last time. Ready to check out?`;

                  notify({
                    title: firstName ? `Hi ${firstName}` : 'Hi there',
                    message: msg,
                    type: 'success',
                    duration: 3600,
                    position: 'br'
                  });
                  if (firstKey) localStorage.setItem(firstKey, '1');
                  mkMarkShown(userId);
                }
              } catch {}
            }, WELCOME_MS + GAP_MS + 1000);
          }
        } catch (e) {
          const loginContainer = document.getElementById('loginContainer');
          if (loginContainer) loginContainer.style.display = 'none';

          try {
            const u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
            const t = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (t && !window.__AUTH_LOGIN_FIRED) {
              window.__AUTH_LOGIN_FIRED = true;
              window.dispatchEvent(new CustomEvent('auth:login', { detail: { token: t, user: u } }));
              setTimeout(() => {
                notify({
                  title: 'Welcome!',
                  message: 'Login successful.',
                  type: 'success',
                  duration: 2200,
                  position: 'br'
                });
              }, 2000);
            }
          } catch {}
        }
      } else {
        notify({
          title: 'Login failed',
          message: data.message || 'Please check your email and password.',
          type: 'error',
          duration: 6000,
          position: 'top'
        });
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      notify({
        title: 'Server unreachable',
message: `Make sure the backend is running on ${API}`,
        type: 'error',
        duration: 6000,
        position: 'top'
      });
    }
  });
});




  // === Show marketing toast on any page if already logged in (robust & frequency-capped) ===
  (function marketingToastOnPageLoad() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    // Skip pages where a promo would be annoying
    const path = location.pathname.toLowerCase();
    const SKIP = ['/admin', '/checkout', '/order', '/order/order_summary.html'];
    if (SKIP.some(p => path.startsWith(p))) return;

    let u = null;
    try { u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'); } catch {}
    const userId = u?.id || u?._id;
    if (!userId) return;

    const firstKey  = `first_login_seen_${userId}`;
    const firstName = u?.firstName || u?.name || '';
    const canShowFreq = mkCanShow(userId, 30); // 30-day cool-down

    let shown = false;
    const show = (count) => {
      if (shown) return;

      const firstTime = !localStorage.getItem(firstKey);
      const eligible = (firstTime || canShowFreq) && count > 0;
      if (!eligible) return;

      shown = true;

      const itemWord = count === 1 ? 'item' : 'items';
      const msg = count > 1
        ? `You still have ${count} ${itemWord} waiting in your cart. Want to take a look?`
        : `We saved your cart from last time. Ready to check out?`;

      notify({
        title: firstName ? `Hi ${firstName}` : 'Hi there',
        message: msg,
        type: 'success',
        duration: 3600,
        position: 'br'
      });

      localStorage.setItem(firstKey, '1');  // device-first flag
      mkMarkShown(userId);                  // frequency cap timestamp

      // Optional: tiny CTA bar (auto-disappears)
      try {
        const bar = document.createElement('div');
        bar.style.position = 'fixed';
        bar.style.right = '16px';
        bar.style.bottom = '76px';
        bar.style.padding = '10px 12px';
        bar.style.borderRadius = '10px';
        bar.style.background = 'rgba(0,0,0,0.7)';
        bar.style.backdropFilter = 'blur(6px)';
        bar.style.display = 'flex';
        bar.style.gap = '8px';
        bar.style.zIndex = '9999';

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View cart';
        viewBtn.style.padding = '8px 10px';
        viewBtn.style.border = 'none';
        viewBtn.style.borderRadius = '8px';
        viewBtn.style.cursor = 'pointer';
        viewBtn.onclick = () => goWithFlashToCart();

        const checkoutBtn = document.createElement('button');
        checkoutBtn.textContent = 'Checkout';
        checkoutBtn.style.padding = '8px 10px';
        checkoutBtn.style.border = 'none';
        checkoutBtn.style.borderRadius = '8px';
        checkoutBtn.style.cursor = 'pointer';
        checkoutBtn.onclick = () => goWithFlashToCheckout();

        bar.append(viewBtn, checkoutBtn);
        document.body.appendChild(bar);
        setTimeout(() => bar.remove(), 4200);
      } catch {}

      window.removeEventListener('cart:synced', onSynced); // stop after success
    };

    function onSynced(ev) {
      const count = ev?.detail?.itemCount ?? 0;
      show(count);
    }

    // keep listening (no `{ once: true }`), so later events can still show it
    window.addEventListener('cart:synced', onSynced);

    // Fallback: peek at LS shortly after load in case we missed early dispatch
    setTimeout(() => {
      if (shown || localStorage.getItem(firstKey)) return;
      try {
        const lsUserCart = JSON.parse(localStorage.getItem(`cart_${userId}`) || '[]');
        const guestCart  = JSON.parse(localStorage.getItem('cart_guest') || '[]');
        const src = lsUserCart.length ? lsUserCart : guestCart;
        const count = (src || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        show(count);
      } catch {}
    }, 1000);

    // 🔧 Debug helpers so you can test from console without reload juggling
    window.__forceMarketingToast = (n = 3) => {
      try { localStorage.removeItem(firstKey); } catch {}
      shown = false;
      show(Number(n) || 0);
    };
    window.__rearmMarketingListener = () => {
      shown = false;
      try { window.removeEventListener('cart:synced', onSynced); } catch {}
      window.addEventListener('cart:synced', onSynced);
    };
  })();



  // ======================= EMAIL VERIFICATION SECTION =======================
let emailVerified = false;

  // =======================================
  // ✅ SEND OTP (generate via backend, send via EmailJS)
  // =======================================
  document.getElementById("sendOtpBtn")?.addEventListener("click", async () => {
    const emailEl = document.getElementById("regEmail");
    const email = (emailEl?.value || "").trim();

    if (!email) {
      notify({
        title: 'Missing email',
        message: 'Please enter your email first.',
        type: 'error',
        duration: 5000,
        position: 'top'
      });
      return;
    }

    try {
const res = await fetch(`${API}/api/send-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});


      const data = await res.json();
      if (!data.success) {
        notify({
          title: 'OTP error',
          message: data.message || 'Failed to generate OTP.',
          type: 'error',
          duration: 6000,
          position: 'top'
        });
        return;
      }

      // Backend already emailed the OTP. We just inform and enable input.
      notify({
        title: 'OTP sent',
        message: `We sent a code to ${email}. Please check your inbox.`,
        type: 'info',
        duration: 5000,
        position: 'top'
      });

      const otpInput = document.getElementById("emailOtp");
      const verifyBtn = document.getElementById("verifyOtpBtn");
      if (otpInput)  otpInput.disabled = false;
      if (verifyBtn) verifyBtn.disabled = false;

    } catch (err) {
      console.error("OTP error:", err);
      notify({
        title: 'Send failed',
        message: 'Please check backend connection.',
        type: 'error',
        duration: 6000,
        position: 'top'
      });
    }
  });

  document.getElementById("verifyOtpBtn")?.addEventListener("click", async () => {
    const emailEl = document.getElementById("regEmail");
    const otpEl   = document.getElementById("emailOtp");

    const email = (emailEl?.value || "").trim();
    const enteredOtp = (otpEl?.value || "").trim();

    if (!email) {
      notify({
        title: 'Missing email',
        message: 'Please enter your email above first.',
        type: 'error',
        duration: 5000,
        position: 'top'
      });
      return;
    }

    if (!enteredOtp) {
      notify({
        title: 'Missing OTP',
        message: 'Please enter the code we sent to your email.',
        type: 'error',
        duration: 5000,
        position: 'top'
      });
      return;
    }

    try {
const res = await fetch(`${API}/api/verify-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, otp: enteredOtp }),
});


      const data = await res.json();
      if (!data.success) {
        notify({
          title: 'OTP error',
          message: data.message || 'Invalid or expired code.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return;
      }

      // ✅ Verified on backend
      emailVerified = true;

      notify({
        title: 'Email verified',
        message: 'You can now complete your registration.',
        type: 'success',
        duration: 2200,
        position: 'br'
      });

      const regBtn    = document.getElementById("registerBtn");
      const sendBtn   = document.getElementById("sendOtpBtn");
      const verifyBtn = document.getElementById("verifyOtpBtn");

      if (regBtn)    regBtn.disabled = false;
      if (sendBtn)   sendBtn.disabled = true;
      if (verifyBtn) verifyBtn.disabled = true;
      if (otpEl)     otpEl.disabled = true;

    } catch (err) {
      console.error("Verify OTP error:", err);
      notify({
        title: 'Server error',
        message: 'Could not verify OTP. Please try again.',
        type: 'error',
        duration: 5000,
        position: 'top'
      });
    }
  });


  
// ======================= REGISTER SECTION (hands off to OTP page) =======================
(function () {
  // 🔸 Your original backend call (unchanged)
  async function doBackendRegister({ firstName, lastName, email, password }) {
    try {
const res = await fetch(`${API}/register-fix`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName, lastName, email, password })
});


      if (!res.ok) {
        if (res.status === 400) {
          const data = await res.json();
          if (data.message?.includes('User already exists')) {
            notify({ title:'Registration error', message:'This email is already registered. Try logging in.', type:'error', duration:6000, position:'top' });
          } else {
            notify({ title:'Registration failed', message:data.message || 'Please try again.', type:'error', duration:6000, position:'top' });
          }
        } else {
          throw new Error(`Failed to register. Status: ${res.status}`);
        }
        return;
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          notify({ title:'Registration successful!', type:'success', duration:2200, position:'br' });
          document.getElementById('registerContainer').style.display = 'none';
          document.getElementById('loginContainer').style.display = 'block';
        } else {
          alert(`⚠️ Registration failed: ${data.message}`);
        }
      } else {
        throw new Error('Expected JSON response, but received something else.');
      }
    } catch (err) {
      notify({ title:'Registration failed', message:String(err.message || err), type:'error', duration:6000, position:'top' });
    }
  }
  window.__doBackendRegister = doBackendRegister;

  // Helpers
  const $ = (id) => document.getElementById(id);
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function clearInvalid(...els){
    els.forEach(el => el && el.classList.remove('is-invalid'));
  }
  function markInvalid(el){
    if (!el) return;
    el.classList.add('is-invalid');
    try { el.focus({ preventScroll: true }); } catch {}
    try { el.scrollIntoView({ block:'center', behavior:'smooth' }); } catch {}
  }

 // ✅ Robustly attach the Register click even if DOM wasn’t ready when script ran
function attachRegisterHandler() {
  const $ = (id) => document.getElementById(id);
  const btn = $('registerBtn');
  if (!btn || btn.__wired) return;

  // 0) Make sure it's actually clickable even if HTML had disabled/submit
  try {
    // force-enable even if markup has "disabled"
    btn.disabled = false;
    btn.removeAttribute('disabled');
    if (getComputedStyle(btn).pointerEvents === 'none') {
      btn.style.pointerEvents = 'auto';
    }
    // prevent native form submit
    if (btn.tagName === 'BUTTON') btn.type = 'button';
    if (btn.tagName === 'INPUT' && String(btn.type).toLowerCase() === 'submit') {
      btn.type = 'button';
    }
    // if the button lives inside a <form>, kill the form's native submit
    const regForm = btn.closest('form') || document.getElementById('registerForm');
    regForm?.addEventListener('submit', (e) => { e.preventDefault(); btn.click(); });
  } catch {}

  btn.__wired = true;

  // --- your existing validation + toasts (unchanged) ---
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const clearInvalid = (...els) => els.forEach(el => el && el.classList.remove('is-invalid'));
  const markInvalid = (el) => {
    if (!el) return;
    el.classList.add('is-invalid');
    try { el.focus({ preventScroll: true }); } catch {}
    try { el.scrollIntoView({ block:'center', behavior:'smooth' }); } catch {}
  };

  btn.addEventListener('click', () => {
    const firstNameEl = $('regFirstName');
    const lastNameEl  = $('regLastName');
    const emailEl     = $('regEmail');
    const passEl      = $('regPassword');
    const confirmEl   = $('regConfirmPassword');
    const agreeTerms  = $('agreeTerms');

    clearInvalid(firstNameEl, lastNameEl, emailEl, passEl, confirmEl, agreeTerms);

    const firstName       = firstNameEl?.value.trim();
    const lastName        = lastNameEl?.value.trim();
    const email           = emailEl?.value.trim();
    const password        = passEl?.value || '';
    const confirmPassword = confirmEl?.value || '';

    // 1) Missing fields → red toast
    const missing = [];
    if (!firstName)        missing.push('First name');
    if (!lastName)         missing.push('Last name');
    if (!email)            missing.push('Email');
    if (!password)         missing.push('Password');
    if (!confirmPassword)  missing.push('Confirm password');

    if (missing.length) {
      [firstNameEl, lastNameEl, emailEl, passEl, confirmEl]
        .filter((el, i) => [!firstName, !lastName, !email, !password, !confirmPassword][i])
        .forEach(el => el?.classList.add('is-invalid'));

      notify({
        title: 'Complete the form',
        message: `Please fill out all required fields: ${missing.join(', ')}.`,
        type: 'error', duration: 6000, position: 'top'
      });

      const firstMissingEl = [firstNameEl, lastNameEl, emailEl, passEl, confirmEl]
        .find((el, i) => [!firstName, !lastName, !email, !password, !confirmPassword][i]);
      markInvalid(firstMissingEl);
      return;
    }

    // 2) Email format
    if (!isValidEmail(email)) {
      notify({
        title: 'Invalid email',
        message: 'Please enter a valid email address. You’ll verify it via OTP next.',
        type: 'error', duration: 6000, position: 'top'
      });
      markInvalid(emailEl);
      return;
    }

    // 3) Password policy
    if (password.length < 8) {
      notify({
        title: 'Weak password',
        message: 'Your password must be at least 8 characters.',
        type: 'error', duration: 6000, position: 'top'
      });
      markInvalid(passEl);
      return;
    }

    // 4) Confirm must match
    if (password !== confirmPassword) {
      notify({
        title: 'Passwords do not match',
        message: 'Please make sure password and confirmation are identical.',
        type: 'error', duration: 6000, position: 'top'
      });
      markInvalid(confirmEl);
      return;
    }

    // 5) Terms checkbox (button stays enabled; fail with red toast if unchecked)
    if (agreeTerms && !agreeTerms.checked) {
      notify({
        title: 'Please accept Terms',
        message: 'Kindly check the Terms & Privacy Policy to continue.',
        type: 'error', duration: 6000, position: 'top'
      });
      markInvalid(agreeTerms);
      return;
    }

    // ✅ All good → stash + go OTP
    try {
      sessionStorage.setItem('pending_registration', JSON.stringify({ firstName, lastName, email, password }));
      sessionStorage.removeItem('otp_verified');

      // used by otpverification.js
      sessionStorage.setItem('pendingEmail', email);
      sessionStorage.setItem('pendingName', firstName || 'User');
      sessionStorage.setItem('verifyReturnTo', location.pathname + location.search);
    } catch {}

    notify({
      title: 'Almost there',
      message: 'We’ll send a verification code to your email next.',
      type: 'info', duration: 2000, position: 'br'
    });

    window.location.href = '/popups/otpverification.html?from=register&email=' + encodeURIComponent(email);
  });
}


  // Attach now / on DOM ready / when modal content appears
  if (document.readyState !== 'loading') attachRegisterHandler();
  else document.addEventListener('DOMContentLoaded', attachRegisterHandler);

  // Expose so other blocks (like the modal “Show Register” click) can force-attach
  window.__attachRegisterHandler = attachRegisterHandler;

  // If the modal is injected later, observe and attach when it appears
  const regContainer = document.getElementById('registerContainer');
  if (regContainer) {
    const mo = new MutationObserver(() => attachRegisterHandler());
    mo.observe(regContainer, { childList: true, subtree: true, attributes: true });
  }

  // ✅ Complete-after-OTP hook
  const qs = new URLSearchParams(location.search);
  if (qs.get('complete') === '1' && sessionStorage.getItem('otp_verified') === '1') {
    const saved = sessionStorage.getItem('pending_registration');
    if (saved) {
      const data = JSON.parse(saved);
      sessionStorage.removeItem('otp_verified');
      doBackendRegister(data);
    }
  }
})();


 // ======================= LOGIN & REGISTER MODALS =======================
document.addEventListener("DOMContentLoaded", function () {
  const loginTrigger      = document.getElementById("loginTrigger");
  const loginContainer    = document.getElementById("loginContainer");
  const closeLogin        = document.getElementById("closeLogin");
  const showRegister      = document.getElementById("showRegister");
  const registerContainer = document.getElementById("registerContainer");
  const backToLogin       = document.getElementById("backToLogin");
  const closeRegister     = document.getElementById("closeRegister");

  // ✅ Auto-hide login popup if already logged in
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  if (isLoggedIn === "true" && loginContainer) {
    loginContainer.style.display = "none";
  }

  if (loginTrigger) {
    const onIconClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        window.AccountQuick?.open?.();
      } else {
        loginContainer.style.display = "block";
      }
    };

    // Capture=true to beat any other listeners that may redirect
    loginTrigger.addEventListener("click", onIconClick, true);

    const parentBtn = loginTrigger.closest('button');
    if (parentBtn && parentBtn !== loginTrigger) {
      parentBtn.addEventListener('click', onIconClick, true);
    }

    closeLogin?.addEventListener("click", () => {
      loginContainer.style.display = "none";
    });

    // 🔓 No disabling here—just open and wire the handler
    showRegister?.addEventListener("click", () => {
      loginContainer.style.display = "none";
      registerContainer.style.display = "block";
      // make sure the Register button click handler is attached
      window.__attachRegisterHandler?.();
    });

    backToLogin?.addEventListener("click", () => {
      registerContainer.style.display = "none";
      loginContainer.style.display = "block";
    });

    closeRegister?.addEventListener("click", () => {
      registerContainer.style.display = "none";
    });
  }

  if (loginContainer) loginContainer.style.display = "none";
});


  // ======================= OUTSIDE CLICK CLOSE (SAFE) =======================
  window.addEventListener("click", function (e) {
    const loginContainer   = document.getElementById("loginContainer");
    const registerContainer= document.getElementById("registerContainer");
    const loginBox         = document.querySelector(".login-box");
    const registerBox      = document.querySelector(".register-box");
    const loginTrigger     = document.getElementById("loginTrigger");
    const showRegister     = document.getElementById("showRegister");

    if (
      loginContainer &&
      loginBox &&
      loginContainer.style.display === "block" &&
      !loginBox.contains(e.target) &&
      (!loginTrigger || !loginTrigger.contains(e.target))
    ) {
      loginContainer.style.display = "none";
    }

    if (
      registerContainer &&
      registerBox &&
      registerContainer.style.display === "block" &&
      !registerBox.contains(e.target) &&
      (!showRegister || !showRegister.contains(e.target))
    ) {
      registerContainer.style.display = "none";
    }
  });



  // --- Toast helpers (fallback to alert if toast not loaded yet)
  function notify({ title='Notice', message='', type='info', duration=2200, position='br' } = {}) {
    if (window.Toast?.showToast) {
      window.Toast.showToast({ title, message, type, duration, position });
    } else {
      alert(`${title}\n${message}`);
    }
  }

  function flashThenNavigate(opts, href) {
    if (window.Toast && typeof window.Toast.queueFlashToast === 'function') {
      window.Toast.queueFlashToast(opts);
      window.location.href = href;
    } else {
      notify(opts);
      window.location.href = href;
    }
  }

  // ---- Marketing frequency cap (30 days) + cross-tab dedupe ----
  function mkLastShownKey(userId) { return userId ? `mk_last_shown_${userId}` : null; }
  function mkCanShow(userId, days = 30) {
    const k = mkLastShownKey(userId);
    if (!k) return false;
    const last = Number(localStorage.getItem(k) || 0);
    return Date.now() - last > days * 24 * 60 * 60 * 1000;
  }
  function mkMarkShown(userId) {
    const k = mkLastShownKey(userId);
    if (k) localStorage.setItem(k, String(Date.now()));
    // notify other tabs to suppress their own marketing toasts
    try { localStorage.setItem('__mk_broadcast', String(Date.now())); } catch {}
  }
;

  // ---- Tiny CTA helpers that survive navigation ----
  function goWithFlashToCart() {
    flashThenNavigate({
      title: 'Opening your cart…',
      type: 'info',
      duration: 1600,
      position: 'br'
    }, '/order/order_summary.html');
  }
  function goWithFlashToCheckout() {
    flashThenNavigate({
      title: 'Heading to checkout…',
      type: 'info',
      duration: 1600,
      position: 'br'
    }, '/checkout/checkout.html');
  }


// ===== Password strength meter (Register + Forgot) — NEW (mirror profile.js) =====
(function(){
  // same scoring as profile.js (0..4)
  function scorePassword(pw){
    let score = 0;
    if (!pw) return 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    const variety = [
      /[a-z]/.test(pw),
      /[A-Z]/.test(pw),
      /\d/.test(pw),
      /[^A-Za-z0-9]/.test(pw)
    ].filter(Boolean).length;
    if (variety >= 2) score++;
    if (variety >= 3) score++;
    return Math.max(0, Math.min(4, score));
  }

  // same UI map as profile.js
  function strengthToUI(score){
    const map = [
      { pct: 12,  color: '#dc3545', label: 'Very weak' },
      { pct: 35,  color: '#fd7e14', label: 'Weak' },
      { pct: 62,  color: '#0d6efd', label: 'Good' },
      { pct: 85,  color: '#198754', label: 'Strong' },
      { pct: 100, color: '#157347', label: 'Very strong' }
    ];
    return map[score];
  }

function paintLikeProfile({inputEl, meterEl, labelEl, confirmEl, messageEl}){
  const val = inputEl?.value || '';
  const confirmVal = confirmEl?.value || '';
  const score = scorePassword(val);
  const ui = strengthToUI(score);

  // Update password strength meter
  const fill = meterEl?.querySelector('.fill');
  if (fill) {
    fill.style.width = val ? (ui.pct + '%') : '0%';
    fill.style.backgroundColor = ui.color;
  }

  // Update password strength label
  if (labelEl) {
    labelEl.textContent = val
      ? (val.length < 8 ? 'Must be at least 8 characters' : ui.label)
      : 'Enter a strong password (min 8 chars)';
  }

  // Update confirm password validation and message
  if (confirmEl && messageEl) {
    const hasConfirmValue = confirmVal.length > 0;
    const passwordsMatch = hasConfirmValue && confirmVal === val;
    
    // Update input field styles
    confirmEl.classList.toggle('is-valid', passwordsMatch);
    confirmEl.classList.toggle('is-invalid', hasConfirmValue && !passwordsMatch);
    
    // Update message text and styling
    if (!hasConfirmValue) {
      messageEl.textContent = 'Please confirm your password';
      messageEl.className = 'pw-confirm-message';
    } else if (passwordsMatch) {
      messageEl.textContent = '✓ Passwords match';
      messageEl.className = 'pw-confirm-message valid';
    } else {
      messageEl.textContent = 'Passwords do not match'; // Removed the "✗"
      messageEl.className = 'pw-confirm-message invalid';
    }
  }
}

function bindMeter(opts){
  const inputEl   = document.getElementById(opts.inputId);
  const meterEl   = document.getElementById(opts.meterId);
  const labelEl   = document.getElementById(opts.labelId);
  const confirmEl = opts.confirmId ? document.getElementById(opts.confirmId) : null;
  const messageEl = opts.messageId ? document.getElementById(opts.messageId) : null;
  
  if (!inputEl || !meterEl || !labelEl) return;

  const render = () => paintLikeProfile({inputEl, meterEl, labelEl, confirmEl, messageEl});
  inputEl.addEventListener('input', render);
  if (confirmEl) confirmEl.addEventListener('input', render);
  render(); // initial render for prefilled cases
}
// Register page fields
bindMeter({
  inputId:  'regPassword',
  confirmId:'regConfirmPassword',
  meterId:  'regPwMeter',
  labelId:  'regPwLabel',
  messageId: 'regConfirmMessage' // Add this
});

// Forgot password popup fields
bindMeter({
  inputId:  'forgotNewPass',
  confirmId:'forgotConfirmPass',
  meterId:  'forgotPwMeter',
  labelId:  'forgotPwLabel',
  messageId: 'forgotConfirmMessage' // Add this
});
})();
