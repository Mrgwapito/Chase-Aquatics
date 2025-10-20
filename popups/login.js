// ================================================================
// 🌊 CHASE AQUATICS FRONTEND AUTH SCRIPT (FULLY FIXED + PERSISTENT LOGIN)
// ================================================================

// ======================= LOGIN SECTION (FIXED & MERGED) =======================
document.getElementById('signInBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('password').value.trim();
  const rememberMe = document.getElementById('remember')?.checked;

  if (!email || !password) {
    alert("⚠️ Please enter both email and password.");
    return;
  }

  try {
    const res = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await res.text();
      console.log('Response is not JSON:', textResponse);
      alert(`Unexpected response: ${textResponse}`);
      return;
    }

    const data = await res.json();

    if (data.success && data.token) {
      alert('✅ Login successful!');

      // ✅ Store token and user info (persistent or session)
      if (rememberMe) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("isLoggedIn", "true");
      } else {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify(data.user));
        sessionStorage.setItem("isLoggedIn", "true");
      }

      // ✅ Sync localStorage & sessionStorage for safety
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("isLoggedIn", "true");

      // ✅ Redirect based on role (admin vs user)
      try {
        const u = data.user || JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
        if (u && u.role === "admin") {
          alert("👑 Welcome, Admin!");
          window.location.href = "./admin/admin.html";
        } else {
          window.location.href = "./profile/profile.html";
        }
      } catch {
        window.location.href = "./profile/profile.html";
      }

    } else {
      alert(`⚠️ Login failed: ${data.message}`);
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    alert("⚠️ Unable to connect to the server. Please ensure your backend is running on http://localhost:3000");
  }
});

// ======================= EMAIL VERIFICATION SECTION =======================
let generatedOtp = null;
let emailVerified = false;

// =======================================
// ✅ FRONTEND EMAILJS SENDER
// =======================================
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js";
document.head.appendChild(script);

script.onload = () => {
  emailjs.init("hhTpOoi07kd04LwsH"); // your Public Key
};

function sendEmailWithEmailJS(email, otp) {
  const serviceID = "service_2bfbogr";
  const templateID = "template_bcfsv7i";

  const params = {
    to_email: email,
    otp_code: otp,
    name: "Life in a Box",
  };

  return emailjs.send(serviceID, templateID, params);
}

// =======================================
// ✅ SEND OTP (generate via backend, send via EmailJS)
// =======================================
document.getElementById("sendOtpBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("regEmail").value.trim();
  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!data.success) {
      alert(`❌ Failed to generate OTP: ${data.message}`);
      return;
    }

    const otp = data.otp;
    await sendEmailWithEmailJS(email, otp);

    alert(`✅ OTP sent to ${email}. Please check your inbox.`);
    generatedOtp = otp;
    document.getElementById("emailOtp").disabled = false;
    document.getElementById("verifyOtpBtn").disabled = false;
  } catch (err) {
    console.error("OTP error:", err);
    alert("⚠️ Failed to send OTP. Please check EmailJS setup or backend connection.");
  }
});

// ✅ VERIFY OTP (frontend check for now)
document.getElementById("verifyOtpBtn")?.addEventListener("click", () => {
  const enteredOtp = document.getElementById("emailOtp").value.trim();
  if (!generatedOtp) {
    alert("⚠️ Please send an OTP first.");
    return;
  }
  if (enteredOtp === generatedOtp.toString()) {
    alert("✅ Email verified successfully!");
    emailVerified = true;
    document.getElementById("registerBtn").disabled = false;
    document.getElementById("sendOtpBtn").disabled = true;
    document.getElementById("verifyOtpBtn").disabled = true;
    document.getElementById("emailOtp").disabled = true;
  } else {
    alert("❌ Incorrect OTP. Try again.");
  }
});

// ======================= REGISTER SECTION =======================
document.getElementById('registerBtn').addEventListener('click', async () => {
  // 🔹 Updated: Split into first & last name
  const firstName = document.getElementById('regFirstName')?.value.trim();
  const lastName = document.getElementById('regLastName')?.value.trim();
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  if (!emailVerified) {
    alert('⚠️ Please verify your email before registering.');
    return;
  }

  if (!firstName || !lastName) {
    alert('⚠️ Please enter both your first and last name.');
    return;
  }

  if (password.length < 8) {
    alert('⚠️ Password must be at least 8 characters long.');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match!');
    return;
  }

  const fullName = `${firstName} ${lastName}`; // 👈 Merge names before sending

  try {
const res = await fetch('http://localhost:3000/register-fix', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName, lastName, email, password })
});


    if (!res.ok) {
      if (res.status === 400) {
        const data = await res.json();
        if (data.message.includes('User already exists')) {
          alert('⚠️ This email is already registered. Try logging in.');
        } else {
          alert(`⚠️ Registration failed: ${data.message}`);
        }
      } else {
        throw new Error(`Failed to register. Status: ${res.status}`);
      }
      return;
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (data.success) {
        alert('✅ Registration successful!');
        document.getElementById('registerContainer').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'block';
      } else {
        alert(`⚠️ Registration failed: ${data.message}`);
      }
    } else {
      throw new Error('Expected JSON response, but received something else.');
    }
  } catch (err) {
    alert(`⚠️ Registration failed: ${err.message}`);
  }
});

// ======================= LOGIN & REGISTER MODALS =======================
document.addEventListener("DOMContentLoaded", function () {
  const loginTrigger = document.getElementById("loginTrigger");
  const loginContainer = document.getElementById("loginContainer");
  const closeLogin = document.getElementById("closeLogin");
  const showRegister = document.getElementById("showRegister");
  const registerContainer = document.getElementById("registerContainer");
  const backToLogin = document.getElementById("backToLogin");
  const closeRegister = document.getElementById("closeRegister");

  // ✅ Auto-hide login popup if already logged in
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  if (isLoggedIn === "true") {
    if (loginContainer) loginContainer.style.display = "none";
  }

  if (loginTrigger) {
    loginTrigger.addEventListener("click", () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        let u = null;
        try {
          u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
        } catch (e) {
          u = null;
        }

        if (u && u.role === "admin") {
          window.location.href = "./admin/admin.html";
        } else {
          window.location.href = "./profile/profile.html";
        }
      } else {
        loginContainer.style.display = "block";
      }
    });
    closeLogin.addEventListener("click", () => {
      loginContainer.style.display = "none";
    });
    showRegister.addEventListener("click", () => {
      loginContainer.style.display = "none";
      registerContainer.style.display = "block";
    });
    backToLogin.addEventListener("click", () => {
      registerContainer.style.display = "none";
      loginContainer.style.display = "block";
    });
    closeRegister.addEventListener("click", () => {
      registerContainer.style.display = "none";
    });
  }
});

// ======================= OUTSIDE CLICK CLOSE =======================
window.addEventListener("click", function (e) {
  const loginContainer = document.getElementById("loginContainer");
  const registerContainer = document.getElementById("registerContainer");
  const loginTrigger = document.getElementById("loginTrigger");
  const showRegister = document.getElementById("showRegister");

  if (
    loginContainer.style.display === "block" &&
    !document.querySelector(".login-box").contains(e.target) &&
    !loginTrigger.contains(e.target)
  ) {
    loginContainer.style.display = "none";
  }

  if (
    registerContainer.style.display === "block" &&
    !document.querySelector(".register-box").contains(e.target) &&
    !showRegister.contains(e.target)
  ) {
    registerContainer.style.display = "none";
  }
});

// ================================================================
// 🔁 FORGOT PASSWORD LOGIC (UNCHANGED, FIXED URLS)
// ================================================================
document.getElementById("forgotPasswordLink")?.addEventListener("click", () => {
  document.getElementById("forgotPasswordContainer").style.display = "block";
});

document.getElementById("closeForgotPassword")?.addEventListener("click", () => {
  document.getElementById("forgotPasswordContainer").style.display = "none";
});

let forgotOtpGenerated = false;

// 1️⃣ Send OTP for password reset
document.getElementById("sendForgotOtpBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) return alert("Please enter your email.");

  try {
    const res = await fetch("http://localhost:3000/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ OTP sent to ${email}. Please check your inbox.`);
      forgotOtpGenerated = true;
      document.getElementById("forgotOtp").disabled = false;
      document.getElementById("newPassword").disabled = false;
      document.getElementById("resetPasswordBtn").disabled = false;
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Failed to send OTP. Try again.");
  }
});

// 2️⃣ Verify OTP + Reset Password
document.getElementById("resetPasswordBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("forgotEmail").value.trim();
  const otp = document.getElementById("forgotOtp").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();

  if (!email || !otp || !newPassword)
    return alert("⚠️ Please fill all fields.");

  if (newPassword.length < 8)
    return alert("⚠️ Password must be at least 8 characters long.");

  try {
    const res = await fetch("http://localhost:3000/api/verify-reset-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, newPassword })
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ Password reset successfully! You can now log in with your new password.");
      document.getElementById("forgotPasswordContainer").style.display = "none";
    } else {
      alert(`❌ Failed to reset password: ${data.message}`);
    }
  } catch (err) {
    console.error("Reset error:", err);
    alert("⚠️ Failed to reset password. Please try again.");
  }
});
