document.addEventListener("DOMContentLoaded", () => {
  // Local toast helper (falls back to alert if toast not loaded yet)
  function notify({ title = 'Notice', message = '', type = 'info', duration = 2200, position = 'top' } = {}) {
    if (window.Toast?.showToast) {
      window.Toast.showToast({ title, message, type, duration, position });
    } else {
      alert(`${title}\n${message}`);
    }
  }

  // You don't actually need EmailJS on the client because the server sends the email,
  // but keeping init here won't hurt anything.
  try { emailjs.init("hhTpOoi07kd04LwsH"); } catch {}

  // ✅ Backend base URL (works on localhost + Render, and reuses global if already set)
  const API_BASE =
    window.__API_BASE__ ||
    ((window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost")
      ? "http://127.0.0.1:3000"
      : "https://chase-aquatics.onrender.com");

  // Expose globally so other scripts (login.js, booking.js, etc.) can share it
  window.__API_BASE__ = window.__API_BASE__ || API_BASE;


  // Popup containers & controls
  const forgotContainer        = document.getElementById("forgotContainer");
  const showForgotPassword     = document.getElementById("showForgotPassword");
  const closeForgot            = document.getElementById("closeForgot");
  const backToLoginFromForgot  = document.getElementById("backToLoginFromForgot");

  // Fields & buttons
  const forgotEmailInput   = document.getElementById("forgotEmail");
  const forgotSendBtn      = document.getElementById("forgotSendBtn");
  const otpInput           = document.getElementById("forgotOtp");
  const newPassInput       = document.getElementById("forgotNewPass");
  const confirmPassInput   = document.getElementById("forgotConfirmPass");
  const resetBtn           = document.getElementById("forgotResetBtn");
  const forgotStep2        = document.getElementById("forgotStep2");

  let currentEmail = "";
  let otpRequested = false;

  // Open popup
  if (showForgotPassword) {
    showForgotPassword.addEventListener("click", () => {
      const loginContainer = document.getElementById("loginContainer");
      if (loginContainer) loginContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  // Close popup
  if (closeForgot) {
    closeForgot.addEventListener("click", () => {
      if (forgotContainer) forgotContainer.style.display = "none";
    });
  }

  // Back to login
  if (backToLoginFromForgot) {
    backToLoginFromForgot.addEventListener("click", () => {
      if (forgotContainer) forgotContainer.style.display = "none";
      const loginContainer = document.getElementById("loginContainer");
      if (loginContainer) loginContainer.style.display = "block";
    });
  }

  // Send OTP
  if (forgotSendBtn) {
    forgotSendBtn.addEventListener("click", async () => {
      const email = (forgotEmailInput?.value || "").trim();
      if (!email) {
        notify({
          title: 'Missing email',
          message: 'Please enter your email.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return; // stop here
      }

      try {
        forgotSendBtn.disabled = true;

        const res = await fetch(`${API_BASE}/api/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          notify({
            title: 'OTP error',
            message: data.message || 'Failed to send OTP.',
            type: 'error',
            duration: 6000,
            position: 'top'
          });
          return;
        }

      // Success: show step 2 (OTP + new password fields)
currentEmail = email;
otpRequested = true;

if (forgotStep2) forgotStep2.style.display = "block";
if (otpInput) otpInput.disabled = false;
if (newPassInput) newPassInput.disabled = false;
if (resetBtn) resetBtn.disabled = false;

// If your backend returns the OTP for DEV: send via EmailJS too
// (In production, prefer the server to send and don't expose the OTP.)
if (data.otp) {
  try {
    await sendResetOtpEmail({
      to_email: email,
      to_name: email,
      otp: data.otp,
      reset_url: `https://lifeinabox.com/reset?email=${encodeURIComponent(email)}`
    });
  } catch (e) {
    console.warn("EmailJS reset send failed (continuing):", e);
  }
}

notify({
  title: 'OTP sent',
  message: `We sent a code to ${email}. Check your inbox.`,
  type: 'info',
  duration: 5000,
  position: 'top'
});


      } catch (err) {
        console.error("Forgot OTP error:", err);
        notify({
          title: 'Send failed',
          message: 'Could not send OTP. Please try again.',
          type: 'error',
          duration: 6000,
          position: 'top'
        });
      } finally {
        forgotSendBtn.disabled = false;
      }
    });
  }

  // Reset Password (verify OTP)
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const email        = currentEmail;
      const otp          = (otpInput?.value || "").trim();
      const newPassword  = (newPassInput?.value || "").trim();
      const confirmPwd   = (confirmPassInput?.value || "").trim();

      if (!email || !otp || !newPassword || !confirmPwd) {
        notify({
          title: 'Missing info',
          message: 'Please fill in all fields.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return;
      }
      if (newPassword.length < 8) {
        notify({
          title: 'Weak password',
          message: 'Password must be at least 8 characters long.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return;
      }
      if (newPassword !== confirmPwd) {
        notify({
          title: 'Passwords do not match',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return;
      }
      if (!otpRequested) {
        notify({
          title: 'No OTP yet',
          message: 'Please request an OTP first.',
          type: 'error',
          duration: 5000,
          position: 'top'
        });
        return;
      }

      try {
        resetBtn.disabled = true;

        const res = await fetch(`${API_BASE}/api/verify-reset-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, newPassword })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          notify({
            title: 'Reset failed',
            message: data.message || 'Failed to reset password.',
            type: 'error',
            duration: 6000,
            position: 'top'
          });
          return;
        }

        notify({
          title: 'Password reset',
          message: 'You can now log in with your new password.',
          type: 'success',
          duration: 2200,
          position: 'br'
        });

        if (forgotContainer) forgotContainer.style.display = "none";
        const loginContainer = document.getElementById("loginContainer");
        if (loginContainer) loginContainer.style.display = "block";
      } catch (err) {
        console.error("Reset error:", err);
        notify({
          title: 'Reset failed',
          message: 'Could not reset your password. Please try again.',
          type: 'error',
          duration: 6000,
          position: 'top'
        });
      } finally {
        resetBtn.disabled = false;
      }
    });
  }
});


const EMAILJS_SERVICE_ID = "service_2bfbogr";
const EMAILJS_TEMPLATE_ID = "template_bcfsv7i";

function sendResetOtpEmail({ to_email, to_name, otp, reset_url }) {
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    show_contact: "none",
    show_reg: "none",
    show_reset: "block",

    brand: "Life In A Box",
    logo_url: location.origin + "/logo.png",
    support_email: "support@lifeinabox.com",
    year: new Date().getFullYear(),
    sent_at: new Date().toLocaleString(),

    to_name,
    to_email,
    otp,
    otp_window_minutes: 10,
    reset_url,

    email_subject: `Reset code: ${otp} — Life In A Box`,
  });
}


// ===== Password strength meter (Register + Forgot) =====
(function(){
  function scorePassword(p){
    if(!p) return 0;
    let s = 0;
    if(p.length >= 8)  s++;
    if(p.length >= 12) s++;
    const sets = [
      /[a-z]/.test(p), /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)
    ].filter(Boolean).length;
    if(sets >= 2) s++;
    if(sets >= 3) s++;
    return Math.max(0, Math.min(4, s)); // 0..4
  }

  function paintStrength(inputEl, meterEl, labelEl){
    const s   = scorePassword(inputEl.value);
    const pct = [8, 25, 50, 75, 100][s];
    // colors: 0/1 red, 2 orange, 3 green, 4 darker green (like screenshot)
    const col = ['#dc3545', '#dc3545', '#fd7e14', '#198754', '#157347'][s];
    const txt = ['Too short','Weak','Fair','Strong','Very strong'][s];

    const fill = meterEl?.querySelector('.fill');
    if(fill){
      fill.style.width = pct + '%';
      fill.style.backgroundColor = col;
    }
    if(labelEl){
      labelEl.textContent = txt;
      labelEl.style.color = (s<=2 ? (s<=1 ? '#c0392b' : '#b06d00') : '#335A02');
    }
  }

  function checkMatch(pwEl, confirmEl){
    if(!pwEl || !confirmEl) return;
    const same = pwEl.value.length > 0 && confirmEl.value === pwEl.value;
    confirmEl.classList.toggle('is-valid',  same);
    confirmEl.classList.toggle('is-invalid', !same && confirmEl.value.length>0);
  }

  function bindMeter({input, meter, label, confirm}){
    const i = document.getElementById(input);
    const m = document.getElementById(meter);
    const l = document.getElementById(label);
    const c = confirm ? document.getElementById(confirm) : null;
    if(!i || !m || !l) return;

    const render = () => paintStrength(i, m, l);
    i.addEventListener('input', () => { render(); if(c) checkMatch(i,c); });
    if(c) c.addEventListener('input', () => checkMatch(i,c));
    render(); // initial render for prefilled cases
  }

  // Register
  bindMeter({ input:'regPassword',    meter:'regPwMeter',    label:'regPwLabel',    confirm:'regConfirmPassword' });
  // Forgot
  bindMeter({ input:'forgotNewPass',  meter:'forgotPwMeter', label:'forgotPwLabel', confirm:'forgotConfirmPass' });
})();
