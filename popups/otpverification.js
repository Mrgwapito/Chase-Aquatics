// ===== EmailJS + toast helper =====
if (typeof emailjs !== 'undefined') {
  emailjs.init('hhTpOoi07kd04LwsH');
}

function toast(title, message = '', type = 'info') {
  if (window.Toast?.showToast) {
    window.Toast.showToast({ title, message, type, duration: 2400, position: 'top' });
  } else {
    alert(`${title}\n${message}`);
  }
}

// ===== Pull pending info from sessionStorage =====
const pendingEmail = (sessionStorage.getItem('pendingEmail') || '').trim().toLowerCase();
const pendingName  = sessionStorage.getItem('pendingName')  || 'User';
const returnTo     = sessionStorage.getItem('verifyReturnTo') || '/index.html';

// ===== Get registration data =====
const pendingReg = sessionStorage.getItem('pending_registration');
const registrationData = pendingReg ? JSON.parse(pendingReg) : null;

console.log('🔍 SessionStorage debug:', {
  pendingEmail,
  pendingReg,
  registrationData
});

// ===== DOM Elements =====
const inputs       = Array.from(document.querySelectorAll('.otp-box'));
const card         = document.getElementById('otpCard');
const verifyBtn    = document.getElementById('verifyBtn');
const resendBtn    = document.getElementById('resendBtn');
const timerEl      = document.getElementById('otpTimer');
const emailDisplay = document.getElementById('emailDisplay');

let currentOTP = ''; // Store OTP locally for fallback
let countdown  = 180; // 3:00
let ticking    = null;

// Display the email being verified
if (emailDisplay && pendingEmail) {
  emailDisplay.textContent = maskEmail(pendingEmail);
}

// ===== Helpers =====
function maskEmail(email) {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? local.substring(0, 2) + '*'.repeat(local.length - 2)
    : local;
  return `${maskedLocal}@${domain}`;
}

const pad = n => String(n).padStart(2, '0');

function updateTimer() {
  if (!timerEl || !resendBtn) return;
  const m = Math.floor(countdown / 60);
  const s = countdown % 60;
  timerEl.textContent = `Resend code in ${m}:${pad(s)}`;
  resendBtn.disabled = countdown > 0;

  if (countdown <= 0) {
    if (ticking) {
      clearInterval(ticking);
      ticking = null;
    }
    timerEl.textContent = 'You can resend a new code now.';
  } else {
    countdown--;
  }
}

function startTimer() {
  if (!timerEl || !resendBtn) return;
  countdown = 180;
  timerEl.textContent = 'Resend code in 3:00';
  resendBtn.disabled = true;
  if (ticking) clearInterval(ticking);
  ticking = setInterval(updateTimer, 1000);
}

function randomOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

function otpFromInputs() {
  return inputs.map(i => i.value.trim()).join('');
}

function clearInputs() {
  inputs.forEach(i => {
    i.value = '';
    i.classList.remove('filled');
  });
  if (inputs[0]) inputs[0].focus();
}

function toggleVerify() {
  if (!verifyBtn) return;
  verifyBtn.disabled = otpFromInputs().length !== 6;
}

// ===== OTP SEND (client-side EmailJS + store on server) =====
async function sendOtpEmail() {
  if (!pendingEmail) {
    toast('Error', 'No email found. Please try registering again.', 'error');
    return;
  }

  if (!resendBtn || !timerEl) return;

  resendBtn.disabled = true;
  const originalText = resendBtn.textContent;
  resendBtn.textContent = 'Sending...';

  try {
    // Generate OTP locally
    currentOTP = String(randomOTP());
    console.log('Generated OTP:', currentOTP);

    // Send via EmailJS
    const emailResult = await emailjs.send('service_2bfbogr', 'template_bcfsv7i', {
      to_name: pendingName || pendingEmail.split('@')[0],
      to_email: pendingEmail,
      email: pendingEmail,
      otp: currentOTP,
      otp_window_minutes: '10',
      brand: 'Life in a Box',
      submitted_at: new Date().toLocaleString(),
      logo_url: '',
      verify_url: ''
    });

    if (emailResult.status === 200) {
      // Store OTP server-side for verification
      try {
        await fetch('/api/store-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pendingEmail,
            otp: currentOTP
          })
        });
      } catch (e) {
        console.log('Server OTP storage failed, using client OTP as fallback only');
      }

      startTimer();
      toast('OTP Sent', `Verification code sent to ${maskEmail(pendingEmail)}`, 'success');
    } else {
      throw new Error('EmailJS failed');
    }
  } catch (err) {
    console.error('EmailJS error:', err);
    toast('Send Failed', 'Could not send OTP email. Please try again.', 'error');
    if (ticking) {
      clearInterval(ticking);
      ticking = null;
    }
    timerEl.textContent = 'Failed to send. Click to retry.';
    resendBtn.disabled = false;
  } finally {
    setTimeout(() => {
      if (resendBtn.textContent === 'Sending...') {
        resendBtn.textContent = originalText || 'Resend Code';
      }
    }, 1500);
  }
}

// ===== Input Events =====
inputs.forEach((box, idx) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 1);
    box.classList.toggle('filled', !!box.value);

    if (box.value && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }

    toggleVerify();
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && idx > 0) {
      inputs[idx - 1].value = '';
      inputs[idx - 1].classList.remove('filled');
      inputs[idx - 1].focus();
      toggleVerify();
    }

    if (e.key === 'Enter' && otpFromInputs().length === 6 && !verifyBtn.disabled) {
      verifyBtn.click();
    }
  });
});

// ===== Verify Button Handler (SINGLE CALL) =====
verifyBtn.addEventListener('click', async () => {
  const otp = otpFromInputs();
  if (otp.length !== 6) return;

  if (!pendingEmail) {
    toast('Error', 'Session expired. Please register again.', 'error');
    return;
  }

  const originalText = verifyBtn.textContent;
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    console.log('🚀 Sending verification request with:', {
      email: pendingEmail,
      otp,
      hasRegistrationData: !!registrationData,
      registrationData
    });

    const response = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingEmail,
        otp,
        registrationData // { firstName, lastName, password } from session
      })
    });

    const result = await response.json();
    console.log('📥 /api/verify-otp response:', result);

    if (response.ok && result.success) {
      handleVerificationSuccess(result); // <-- use server token here
    } else {
      // fallback: compare with local OTP if set
      if (otp === currentOTP) {
        console.log('✅ Using local OTP fallback (dev mode).');
        handleVerificationSuccess({ 
          token: null, 
          user: null, 
          message: 'Email verified (dev fallback). Please log in.' 
        });
      } else {
        throw new Error(result.message || 'Invalid OTP');
      }
    }
  } catch (err) {
    console.error('Verification error:', err);
    if (card) {
      card.classList.add('error');
      setTimeout(() => card.classList.remove('error'), 380);
    }
    clearInputs();
    toggleVerify();
    toast('Invalid Code', err.message || 'Unable to verify code. Please try again.', 'error');
  } finally {
    verifyBtn.textContent = originalText;
    toggleVerify();
  }
});

// ===== Successful Verification Handler (AUTO-LOGIN HERE) =====
function handleVerificationSuccess(data = {}) {
  const { token, user, message } = data;

  console.log('✅ handleVerificationSuccess payload:', data);

  // If backend returned token + user → auto-login
  if (token && user) {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isLoggedIn', 'true');

      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('isLoggedIn', 'true');

      // Let other scripts (cart/profile/etc.) react
      window.dispatchEvent(new CustomEvent('auth:login', {
        detail: { token, user }
      }));

      toast(
        'Welcome!',
        `Hello ${user.firstName || user.fullName || 'User'}! You are now logged in.`,
        'success'
      );
    } catch (err) {
      console.error('Storage error on auto-login:', err);
      toast('Verified', 'Your email is verified. Please log in.', 'info');
    }
  } else {
    // Verified but no token (dev/fallback)
    toast('Verified', message || 'Your email is verified. Please log in.', 'success');
  }

  // Cleanup + redirect
  setTimeout(() => {
    sessionStorage.removeItem('pendingEmail');
    sessionStorage.removeItem('pendingName');
    sessionStorage.removeItem('verifyReturnTo');
    sessionStorage.removeItem('pending_registration');
    window.location.href = returnTo || '/index.html';
  }, 1500);
}

// ===== Optional notify helper (not used but kept) =====
function notify({ title='Notice', message='', type='info', duration=2200, position='br' } = {}) {
  if (window.Toast?.showToast) {
    window.Toast.showToast({ title, message, type, duration, position });
  } else {
    alert(`${title}\n${message}`);
  }
}

// ===== Resend Button =====
if (resendBtn) {
  resendBtn.addEventListener('click', () => {
    if (countdown <= 0) {
      sendOtpEmail();
    }
  });
}

// ===== Page Load =====
window.addEventListener('DOMContentLoaded', () => {
  if (!pendingEmail) {
    toast('Error', 'No email found for verification. Please register again.', 'error');
    setTimeout(() => {
      window.location.href = '/register.html';
    }, 3000);
    return;
  }

  if (inputs[0]) inputs[0].focus();
  sendOtpEmail(); // auto-send on load
});

// ===== Visibility: allow resend when back & timer done =====
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pendingEmail && countdown <= 0 && resendBtn && timerEl) {
    timerEl.textContent = 'You can resend a new code now.';
    resendBtn.disabled = false;
  }
});
