document.addEventListener("DOMContentLoaded", () => {
  emailjs.init("hhTpOoi07kd04LwsH");

  const forgotContainer = document.getElementById("forgotContainer");
  const showForgotPassword = document.getElementById("showForgotPassword");
  const closeForgot = document.getElementById("closeForgot");
  const backToLoginFromForgot = document.getElementById("backToLoginFromForgot");

  // Inputs and buttons
  const forgotEmailInput = document.getElementById("forgotEmail");
  const forgotSendBtn = document.getElementById("forgotSendBtn");
  const otpInput = document.getElementById("forgotOtp");
  const newPassInput = document.getElementById("forgotNewPass");
  const confirmPassInput = document.getElementById("forgotConfirmPass");
  const resetBtn = document.getElementById("forgotResetBtn");

  let currentEmail = "";
  let generatedOtp = "";

  // ✅ Show Forgot Password Popup
  if (showForgotPassword) {
    showForgotPassword.addEventListener("click", () => {
      const loginContainer = document.getElementById("loginContainer");
      if (loginContainer) loginContainer.style.display = "none";
      forgotContainer.style.display = "block";
    });
  }

  // ✅ Close Popup (just hides forgot password)
  if (closeForgot) {
    closeForgot.addEventListener("click", () => {
      forgotContainer.style.display = "none";
    });
  }

  // ✅ Back to Login (closes forgot password and opens login)
  if (backToLoginFromForgot) {
    backToLoginFromForgot.addEventListener("click", () => {
      forgotContainer.style.display = "none";
      const loginContainer = document.getElementById("loginContainer");
      if (loginContainer) {
        loginContainer.style.display = "block";
      }
    });
  }

  // ✅ Send OTP
  if (forgotSendBtn) {
    forgotSendBtn.addEventListener("click", async () => {
      const email = forgotEmailInput.value.trim();
      if (!email) {
        alert("Please enter your email.");
        return;
      }

      try {
        const res = await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });

        const data = await res.json();
        if (data.success) {
          generatedOtp = data.otp;
          currentEmail = email;

          emailjs.send("service_2bfbogr", "template_bcfsv7i", {
            to_email: email,
            name: "Life in a Box User",
            otp_code: generatedOtp,
            message: `Your password reset code is: ${generatedOtp}`
          });

          alert("✅ OTP sent to your email!");
          document.getElementById("forgotStep2").style.display = "block";
        } else {
          alert(`⚠️ ${data.message}`);
        }
      } catch (err) {
        console.error("Error:", err);
        alert("❌ Failed to send OTP.");
      }
    });
  }

  // ✅ Reset Password
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const otp = otpInput.value.trim();
      const newPassword = newPassInput.value.trim();
      const confirmPassword = confirmPassInput.value.trim();

      if (!otp || !newPassword || !confirmPassword) {
        alert("Please fill in all fields.");
        return;
      }

      if (newPassword.length < 8) {
        alert("Password must be at least 8 characters long.");
        return;
      }

      if (newPassword !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      try {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentEmail, otp, newPassword })
        });

        const data = await res.json();
        if (data.success) {
          alert("✅ Password reset successfully!");
          forgotContainer.style.display = "none";
          const loginContainer = document.getElementById("loginContainer");
          if (loginContainer) loginContainer.style.display = "block"; // 👈 show login popup again
        } else {
          alert(`⚠️ ${data.message}`);
        }
      } catch (err) {
        console.error("Error:", err);
        alert("❌ Failed to reset password.");
      }
    });
  }
});
