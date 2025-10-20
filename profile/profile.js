// ================================================================
// 🌊 CHASE AQUATICS - PROFILE SCRIPT (LOCALHOST/127.0.0.1 AUTO FIXED)
// ================================================================

// ✅ Auto-detect backend URL
const BACKEND_URL =
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "http://localhost:3000";

// ======= Initialize EmailJS =======
if (typeof emailjs !== "undefined") {
  emailjs.init("hhTpOoi07kd04LwsH");
}

// ======= DOM Elements =======
const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");
const inputs = document.querySelectorAll(".edit-input");
const emailOtpSection = document.getElementById("emailOtpSection");
const sendEmailOtpBtn = document.getElementById("sendEmailOtp");
const verifyEmailOtpBtn = document.getElementById("verifyEmailOtp");
const emailInput = document.getElementById("emailInput");
const emailOtpInput = document.getElementById("emailOtp");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const changePasswordSection = document.getElementById("changePasswordSection");
const savePasswordBtn = document.getElementById("savePasswordBtn");
const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");

// ✅ Added references for first/last name fields
const firstNameInput = document.getElementById("firstNameInput");
const lastNameInput = document.getElementById("lastNameInput");

// ======= OTP & Verification Variables =======
let generatedEmailOtp = null;
let otpSent = false;
let emailVerified = false;
let originalEmail = ""; // assigned after profile load

// ======= AUTO GENERATE USER ID =======
function generateUserId() {
  const prefix = "USR";
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${randomNum}`;
}

// ======= EDIT PROFILE =======
if (editBtn) {
  editBtn.addEventListener("click", () => {
    inputs.forEach((input) => (input.disabled = false));
    if (firstNameInput) firstNameInput.disabled = false;
    if (lastNameInput) lastNameInput.disabled = false;
    if (!emailVerified) emailInput.disabled = false;
    editBtn.style.display = "none";
    saveBtn.style.display = "inline-block";
    emailOtpSection.style.display = "block";
  });
}

// ======= SAVE PROFILE (Update MongoDB) =======
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in again.");
      window.location.href = "../index.html";
      return;
    }

    if (emailInput.value.trim() !== originalEmail.trim() && !emailVerified) {
      alert("❌ You changed your email! Please verify it before saving.");
      return;
    }

    // ✅ Updated to include firstName & lastName
    const firstName = firstNameInput?.value.trim() || "";
    const lastName = lastNameInput?.value.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();

    const updatedData = {
      firstName,
      lastName,
      fullName,
      phone: document.getElementById("phoneInput").value.trim(),
      address: document.getElementById("addressInput").value.trim(),
      gender: document.getElementById("genderInput").value.trim(),
      birthday: document.getElementById("birthdayInput").value.trim(),
    };

    try {
      console.log("📤 Sending update to:", `${BACKEND_URL}/api/update-profile`);
      console.log("📦 Body:", updatedData);

      const res = await fetch(`${BACKEND_URL}/api/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      });

      // ✅ Safe JSON parse with fallback
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Response is not JSON (check backend route).");
      }

      console.log("📩 Update response:", data);

      if (!res.ok || !data.success) {
        alert(`⚠️ Update failed: ${data.message || "Server error."}`);
        return;
      }

      alert("✅ Profile updated successfully!");
      document.querySelector(".user-name").textContent = fullName;
      inputs.forEach((input) => (input.disabled = true));
      if (firstNameInput) firstNameInput.disabled = true;
      if (lastNameInput) lastNameInput.disabled = true;
      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      emailOtpSection.style.display = "none";
      originalEmail = emailInput.value;
    } catch (err) {
      console.error("❌ Error updating profile:", err);
      alert(`❌ Failed to update profile: ${err.message}`);
    }
  });
}

// ======= SEND EMAIL OTP =======
if (sendEmailOtpBtn) {
  sendEmailOtpBtn.addEventListener("click", () => {
    const userEmail = emailInput.value.trim();
    const userName = document.querySelector(".user-name").textContent;

    if (!userEmail) {
      alert("Please enter your email before sending an OTP.");
      return;
    }

    generatedEmailOtp = Math.floor(100000 + Math.random() * 900000);
    otpSent = true;
    emailVerified = false;

    emailjs
      .send("service_2bfbogr", "template_bcfsv7i", {
        to_email: userEmail,
        name: userName,
        otp_code: generatedEmailOtp,
        time: new Date().toLocaleString(),
        message: `Your OTP for Life in a Box: ${generatedEmailOtp}`,
      })
      .then(() => {
        alert(`✅ OTP sent to ${userEmail}!`);
        console.log("OTP Sent:", generatedEmailOtp);
      })
      .catch((err) => {
        console.error("EmailJS Error:", err);
        alert("❌ Failed to send OTP. Check console for details.");
      });
  });
}

// ======= VERIFY EMAIL OTP =======
if (verifyEmailOtpBtn) {
  verifyEmailOtpBtn.addEventListener("click", () => {
    if (!otpSent) {
      alert("Please send the OTP first!");
      return;
    }

    const enteredOtp = emailOtpInput.value.trim();
    if (enteredOtp === generatedEmailOtp.toString()) {
      alert("✅ Email verified successfully!");
      otpSent = false;
      emailVerified = true;
      emailInput.disabled = true;
      emailOtpInput.value = "";
    } else {
      alert("❌ Invalid OTP. Please try again.");
    }
  });
}

// ======= CHANGE PASSWORD =======
if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", () => {
    changePasswordSection.style.display = "block";
    changePasswordBtn.style.display = "none";
  });
}

if (savePasswordBtn) {
  savePasswordBtn.addEventListener("click", async () => {
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    if (!newPassword || !confirmPassword) {
      alert("Please fill out both password fields.");
      return;
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("❌ Passwords do not match!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BACKEND_URL}/api/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Response is not JSON (check backend route).");
      }

      if (data.success) {
        alert("✅ Password successfully updated!");
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
        changePasswordSection.style.display = "none";
        changePasswordBtn.style.display = "inline-block";
      } else {
        alert(`⚠️ ${data.message}`);
      }
    } catch (err) {
      console.error("Error updating password:", err);
      alert(`❌ Failed to update password: ${err.message}`);
    }
  });
}

if (cancelPasswordBtn) {
  cancelPasswordBtn.addEventListener("click", () => {
    changePasswordSection.style.display = "none";
    changePasswordBtn.style.display = "inline-block";
  });
}

// ======= LOAD USER PROFILE =======
(async function loadProfile() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in first.");
    window.location.href = "../index.html";
    return;
  }

  try {
    console.log("📡 Fetching profile with token:", token);

    const res = await fetch(`${BACKEND_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Response is not JSON (check backend /api/profile).");
    }

    console.log("📩 Received profile data:", data);

    if (!res.ok || !data.success) {
      alert("⚠️ Session expired or connection failed. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
      return;
    }

    const user = data.user;

    // ✅ Display full name, first & last name
    document.querySelector(".user-name").textContent =
      user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "New User";
    if (firstNameInput) firstNameInput.value = user.firstName || "";
    if (lastNameInput) lastNameInput.value = user.lastName || "";

    document.getElementById("emailInput").value = user.email || "";
    document.getElementById("userIdValue").textContent = user.userId || generateUserId();
    document.getElementById("phoneInput").value = user.phone || "";
    document.getElementById("addressInput").value = user.address || "";
    document.getElementById("genderInput").value = user.gender || "";
    document.getElementById("birthdayInput").value = user.birthday || "";

    originalEmail = user.email || "";
  } catch (err) {
    console.error("Profile load error:", err);
    alert(`⚠️ Failed to load profile: ${err.message}`);
  }
})();

// ======= NAV TOGGLE =======
const toggleBtn = document.querySelector(".nav-toggle");
const navlinks = document.getElementById("navlinks");

if (toggleBtn && navlinks) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = navlinks.classList.toggle("open");
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

// ======= LOGOUT FUNCTION =======
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const confirmLogout = confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("isLoggedIn");
      sessionStorage.clear();
      alert("👋 You have been logged out successfully.");
      window.location.href = "../index.html";
    }
  });
}
